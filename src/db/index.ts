import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";
import { newDb } from "pg-mem";
import fs from "fs";
import path from "path";

const { Pool } = pg;

// Path to persist data
const DB_FILE = path.join(process.cwd(), "src", "db.json");

let poolInstance: any = null;
let isInMemory = false;
let memDb: any = null;

export const createPool = () => {
  // If we already have a pool, return a wrapper that delegates to it
  const wrapperPool = {
    query: async function(text: any, params: any) {
      await ensurePoolInitialized();
      return poolInstance.query(text, params);
    },
    connect: async function() {
      await ensurePoolInitialized();
      return poolInstance.connect();
    },
    on: function(event: string, listener: any) {
      ensurePoolInitialized().then(() => {
        if (poolInstance && poolInstance.on) {
          poolInstance.on(event, listener);
        }
      }).catch(() => {});
      return this;
    },
    end: async function() {
      if (poolInstance && poolInstance.end) {
        await poolInstance.end().catch(() => {});
      }
    }
  };

  async function ensurePoolInitialized() {
    if (poolInstance) return;

    const hasSqlConfig = !!process.env.SQL_HOST;

    if (hasSqlConfig) {
      const host = process.env.SQL_HOST;
      const user = process.env.SQL_USER;
      const database = process.env.SQL_DB_NAME;
      const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432;

      try {
        console.log(`[GDCMS] Testing connection to Cloud SQL database (host: ${host}, user: ${user}, database: ${database}, port: ${port})...`);
        
        const poolConfig: pg.PoolConfig = {
          host,
          user,
          password: process.env.SQL_PASSWORD,
          database,
          port,
          connectionTimeoutMillis: 4000,
        };

        // Standard Cloud SQL setup often requires SSL (using rejectUnauthorized: false for secure container proxying)
        if (host && !host.startsWith("/")) {
          poolConfig.ssl = { rejectUnauthorized: false };
        }

        const realPool = new Pool(poolConfig);
        const client = await realPool.connect();
        console.log("[GDCMS] Successfully connected to Cloud SQL database!");
        client.release();
        poolInstance = realPool;
        return;
      } catch (err: any) {
        console.log(`[GDCMS] Cloud SQL connection with SSL was not available, trying without SSL...`);
        
        try {
          const realPool = new Pool({
            host,
            user,
            password: process.env.SQL_PASSWORD,
            database,
            port,
            connectionTimeoutMillis: 4000,
          });
          const client = await realPool.connect();
          console.log("[GDCMS] Successfully connected to Cloud SQL database without SSL!");
          client.release();
          poolInstance = realPool;
          return;
        } catch (retryErr: any) {
          console.log(`[GDCMS] Note: Cloud SQL database is offline or unreachable at this time.`);
        }
      }
    } else {
      console.log("[GDCMS] No SQL_HOST specified in environment variables.");
    }

    console.log("[GDCMS] Initializing self-healing in-memory PostgreSQL emulation (pg-mem) fallback...");
    isInMemory = true;
    memDb = newDb();
    
    // Register common pg functions
    memDb.public.registerFunction({
      name: "now",
      returns: "timestamp",
      implementation: () => new Date(),
    });

    const pgMock = memDb.adapters.createPg();
    const memPool = new pgMock.Pool();

    // Helper to sanitize query options before pg-mem execution and format results for Drizzle
    async function runSanitizedQuery(queryFn: Function, queryArg: any, valuesArg: any) {
      let isRowModeArray = false;
      let cleanedQuery = queryArg;
      
      if (queryArg && typeof queryArg === "object") {
        cleanedQuery = { ...queryArg };
        if (cleanedQuery.types) {
          delete cleanedQuery.types;
        }
        if (cleanedQuery.rowMode === "array") {
          isRowModeArray = true;
          delete cleanedQuery.rowMode;
        }
      }

      const result = await queryFn(cleanedQuery, valuesArg);

      if (isRowModeArray && result && result.rows) {
        result.rows = result.rows.map((row: any) => Object.values(row));
      }

      return result;
    }

    // Intercept queries to save back to db.json
    const originalQuery = memPool.query;
    memPool.query = async function (text: any, params: any) {
      const result = await runSanitizedQuery((t: any, p: any) => originalQuery.call(memPool, t, p), text, params);
      const sqlText = typeof text === "string" ? text : (text && text.text) || "";
      if (/insert|update|delete/i.test(sqlText)) {
        triggerDebouncedSave(memPool);
      }
      return result;
    } as any;

    const originalConnect = memPool.connect;
    memPool.connect = async function () {
      const client = await originalConnect.apply(this, arguments as any);
      const originalClientQuery = client.query;
      client.query = async function (text: any, params: any) {
        const result = await runSanitizedQuery((t: any, p: any) => originalClientQuery.call(client, t, p), text, params);
        const sqlText = typeof text === "string" ? text : (text && text.text) || "";
        if (/insert|update|delete/i.test(sqlText)) {
          triggerDebouncedSave(memPool);
        }
        return result;
      };
      return client;
    };

    poolInstance = memPool;
  }

  return wrapperPool as any;
};

// Debounced persistence helper
let saveTimeout: any = null;
function triggerDebouncedSave(pool: any) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      console.log("[GDCMS] Persisting in-memory database state to src/db.json...");
      
      const uRows = (await pool.query("SELECT * FROM users")).rows;
      const cRows = (await pool.query("SELECT * FROM courses")).rows;
      const mRows = (await pool.query("SELECT * FROM materials")).rows;
      const sRows = (await pool.query("SELECT * FROM submissions")).rows;
      const nRows = (await pool.query("SELECT * FROM notes")).rows;
      const notRows = (await pool.query("SELECT * FROM notifications")).rows;
      const lRows = (await pool.query("SELECT * FROM logs")).rows;
      const confRows = (await pool.query("SELECT * FROM app_config")).rows;

      const state = {
        users: uRows.map((r: any) => ({
          id: r.id,
          indexNumber: r.index_number,
          fullName: r.full_name,
          email: r.email,
          role: r.role,
          passwordHash: r.password_hash,
          oauthConnected: r.oauth_connected === true || r.oauth_connected === 'true' || r.oauth_connected === 1,
          needsPasswordChange: r.needs_password_change === true || r.needs_password_change === 'true' || r.needs_password_change === 1,
          systemId: r.system_id,
        })),
        courses: cRows.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          lecturerId: r.lecturer_id,
          description: r.description,
          outlineUrl: r.outline_url,
          outlineName: r.outline_name,
          systemId: r.system_id,
        })),
        materials: mRows.map((r: any) => ({
          id: r.id,
          courseId: r.course_id,
          title: r.title,
          description: r.description,
          type: r.type,
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
          fileKey: r.file_key,
          originalName: r.original_name,
          mimeType: r.mime_type,
          fileSize: r.file_size,
          deadline: r.deadline,
        })),
        submissions: sRows.map((r: any) => ({
          id: r.id,
          assignmentId: r.assignment_id,
          studentId: r.student_id,
          studentIndex: r.student_index,
          studentName: r.student_name,
          fileKey: r.file_key,
          originalName: r.original_name,
          uploadedAt: r.uploaded_at,
          grade: r.grade,
          feedback: r.feedback,
          gradedBy: r.graded_by,
          gradedAt: r.graded_at,
          status: r.status,
        })),
        notes: nRows.map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          title: r.title,
          content: r.content,
          updatedAt: r.updated_at,
          isSynced: r.is_synced === true || r.is_synced === 'true' || r.is_synced === 1,
          tag: r.tag,
        })),
        notifications: notRows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          title: r.title,
          message: r.message,
          type: r.type,
          createdAt: r.created_at,
          isRead: r.is_read === true || r.is_read === 'true' || r.is_read === 1,
        })),
        logs: lRows.map((r: any) => ({
          id: r.id,
          timestamp: r.timestamp,
          emailOrIndex: r.email_or_index,
          status: r.status,
          reason: r.reason,
          userAgent: r.user_agent,
          ipPlaceholder: r.ip_placeholder,
        })),
        appConfig: confRows[0] ? {
          systemName: confRows[0].system_name,
          systemShort: confRows[0].system_short,
          assignmentsTerm: confRows[0].assignments_term,
          materialsTerm: confRows[0].materials_term,
          themeColor: confRows[0].theme_color,
          fontSizePreset: confRows[0].font_size_preset,
          sidebarStyle: confRows[0].sidebar_style,
          indexValidation: confRows[0].index_validation,
        } : null,
        appConfigs: confRows.map((r: any) => ({
          id: r.id,
          systemName: r.system_name,
          systemShort: r.system_short,
          assignmentsTerm: r.assignments_term,
          materialsTerm: r.materials_term,
          themeColor: r.theme_color,
          fontSizePreset: r.font_size_preset,
          sidebarStyle: r.sidebar_style,
          indexValidation: r.index_validation,
        })),
      };

      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
      console.log("[GDCMS] Database state persisted successfully to src/db.json!");
    } catch (err: any) {
      console.error("[GDCMS] Failed to persist database state:", err.message);
    }
  }, 1000);
}

const pool = createPool();

export const db = drizzle(pool, { schema });
