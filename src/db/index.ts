import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pg;

// Connection Pool configuration using Object Method exclusively
export const createPool = () => {
  if (process.env.DATABASE_URL) {
    console.log("[GDCMS] Pooling connection via DATABASE_URL string.");
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 15000,
      ssl: process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
  }

  console.log("[GDCMS] Pooling connection via individual SQL environment config.");
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15000,
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
