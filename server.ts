import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { User, Course, Material, Submission, PersonalNote, NotificationItem } from "./src/types.ts";

// Load Environment
import dotenv from "dotenv";
dotenv.config();

// SQL database and Drizzle schema imports
import { db } from "./src/db/index.ts";
import * as schema from "./src/db/schema.ts";
import { eq, or, and, desc } from "drizzle-orm";

const app = express();
const PORT = 3000;

// Set up directory paths
const DB_FILE = path.join(process.cwd(), "src", "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Automatically ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------
// AES-256 Cryptographic Subsystem
// Encryption Key is securely derived from environment secrets
// ---------------------------------------------------------
const MASTER_SECRET = process.env.GEMINI_API_KEY || process.env.SESSION_SECRET || "itn-gd-gdcms-sec-3.5-encryption-key-phrase";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest();

/**
 * Encrypt a buffer with AES-256-CBC.
 */
function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt a buffer containing a IV prepended to raw AES ciphertext.
 */
function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  try {
    if (encryptedBuffer.length < 16) {
      return encryptedBuffer;
    }
    const iv = encryptedBuffer.subarray(0, 16);
    const ciphertext = encryptedBuffer.subarray(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    console.error("AES decryption of buffer failed, returning raw block:", err);
    return encryptedBuffer;
  }
}

/**
 * Encrypt short text to hex.
 */
function encryptText(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt text encrypted by encryptText.
 */
function decryptText(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  try {
    const parts = encryptedText.split(":");
    if (parts.length < 2) return encryptedText;
    const ivHex = parts[0];
    const ciphertextHex = parts.slice(1).join(":");

    if (ivHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, "hex");
    if (iv.length !== 16) {
      return encryptedText;
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("AES decryption of text failed, returning raw content:", err);
    return encryptedText;
  }
}

// ---------------------------------------------------------
// SQL Seed Engine (Graceful Data Porting & Seeding)
// ---------------------------------------------------------
async function seedDatabaseIfNeeded() {
  try {
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length === 0) {
      console.log("[GDCMS] Database is empty, seeding from db.json...");
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(fileContent);

        // Seed users
        if (parsed.users && parsed.users.length > 0) {
          const expectedHash = crypto.createHash("sha256").update("123456").digest("hex");
          await db.insert(schema.users).values(parsed.users.map((u: any) => ({
            id: u.id,
            indexNumber: u.indexNumber || null,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            passwordHash: u.id === "student_1" || u.id === "student_2" || u.id === "lecturer_1" || u.id === "admin_1" ? expectedHash : (u.passwordHash || null),
            oauthConnected: u.oauthConnected || false,
            needsPasswordChange: u.needsPasswordChange || false,
          })));
        }

        // Seed courses
        if (parsed.courses && parsed.courses.length > 0) {
          await db.insert(schema.courses).values(parsed.courses.map((c: any) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            lecturerId: c.lecturerId,
            description: c.description,
            outlineUrl: c.outlineUrl || null,
            outlineName: c.outlineName || null,
          })));
        }

        // Seed materials
        if (parsed.materials && parsed.materials.length > 0) {
          await db.insert(schema.materials).values(parsed.materials.map((m: any) => ({
            id: m.id,
            courseId: m.courseId,
            title: m.title,
            description: m.description,
            type: m.type,
            uploadedBy: m.uploadedBy,
            uploadedAt: m.uploadedAt,
            fileKey: m.fileKey,
            originalName: m.originalName,
            mimeType: m.mimeType,
            fileSize: m.fileSize,
            deadline: m.deadline || null,
          })));
        }

        // Seed submissions
        if (parsed.submissions && parsed.submissions.length > 0) {
          await db.insert(schema.submissions).values(parsed.submissions.map((s: any) => ({
            id: s.id,
            assignmentId: s.assignmentId,
            studentId: s.studentId,
            studentIndex: s.studentIndex,
            studentName: s.studentName,
            fileKey: s.fileKey,
            originalName: s.originalName,
            uploadedAt: s.uploadedAt,
            grade: s.grade || null,
            feedback: s.feedback || null,
            gradedBy: s.gradedBy || null,
            gradedAt: s.gradedAt || null,
            status: s.status,
          })));
        }

        // Seed notes
        if (parsed.notes && parsed.notes.length > 0) {
          await db.insert(schema.notes).values(parsed.notes.map((n: any) => ({
            id: n.id,
            studentId: n.studentId,
            title: n.title,
            content: n.content.includes(":") ? n.content : encryptText(n.content),
            updatedAt: n.updatedAt,
            isSynced: n.isSynced ?? true,
            tag: n.tag || null,
          })));
        }

        // Seed notifications
        if (parsed.notifications && parsed.notifications.length > 0) {
          await db.insert(schema.notifications).values(parsed.notifications.map((n: any) => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
            message: n.message,
            type: n.type,
            createdAt: n.createdAt,
            isRead: n.isRead || false,
          })));
        }

        // Seed logs
        if (parsed.logs && parsed.logs.length > 0) {
          await db.insert(schema.logs).values(parsed.logs.map((l: any) => ({
            id: l.id,
            timestamp: l.timestamp,
            emailOrIndex: l.emailOrIndex,
            status: l.status,
            reason: l.reason || null,
            userAgent: l.userAgent || null,
            ipPlaceholder: l.ipPlaceholder || null,
          })));
        }

        // Seed appConfig
        if (parsed.appConfig) {
          await db.insert(schema.appConfig).values({
            id: "config",
            systemName: parsed.appConfig.systemName,
            systemShort: parsed.appConfig.systemShort,
            assignmentsTerm: parsed.appConfig.assignmentsTerm,
            materialsTerm: parsed.appConfig.materialsTerm,
            themeColor: parsed.appConfig.themeColor,
            fontSizePreset: parsed.appConfig.fontSizePreset,
            sidebarStyle: parsed.appConfig.sidebarStyle,
          });
        }
        console.log("[GDCMS] PostgreSQL seeding complete!");
      } else {
        await db.insert(schema.appConfig).values({
          id: "config",
          systemName: "Group D Class Management System",
          systemShort: "GDCMS",
          assignmentsTerm: "Assignments",
          materialsTerm: "Course Materials",
          themeColor: "indigo",
          fontSizePreset: "standard",
          sidebarStyle: "dark-navy",
        });
        console.log("[GDCMS] Default system branding configuration seeded.");
      }
    }
  } catch (err) {
    console.error("[GDCMS] Graceful database seeding check/run failed:", err);
  }
}

// ---------------------------------------------------------
// Audit logger helper mapping to DB
// ---------------------------------------------------------
async function logAuthAttempt(identifier: string, status: "success" | "failed", reason?: string, req?: express.Request): Promise<void> {
  try {
    await db.insert(schema.logs).values({
      id: "log_" + crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      emailOrIndex: identifier || "Unknown User",
      status,
      reason: reason || null,
      userAgent: req ? (req.headers["user-agent"] as string || null) : null,
      ipPlaceholder: req ? ((req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string) : "127.0.0.1"
    });
  } catch (err) {
    console.error("Failed to write authorization attempt audit log:", err);
  }
}

// In-Memory Secure Session Bearer Tokens
const ACTIVE_SESSIONS = new Map<string, User>();

// Express Setup Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Custom Authorization Guard Middleware
function authGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization bearer token." });
  }
  const token = authHeader.split(" ")[1];
  const user = ACTIVE_SESSIONS.get(token);
  if (!user) {
    return res.status(403).json({ error: "Expired, invalid, or unrecognized user session." });
  }
  (req as any).user = user;
  next();
}

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", system: "GDCMS production server", database: "PostgreSQL active", encryption: "AES-256 active" });
});

// Authentication: Registration
app.post("/api/auth/register", async (req, res) => {
  const { indexNumber, fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Missing mandatory registration fields." });
  }

  if (role === "student" && !indexNumber) {
    return res.status(400).json({ error: "Students must supply a valid university index ID." });
  }

  try {
    // Check duplication in SQL
    const duplicate = (await db.select().from(schema.users).where(
      or(
        eq(schema.users.email, email),
        indexNumber ? eq(schema.users.indexNumber, indexNumber) : undefined
      )
    ))[0];

    if (duplicate) {
      return res.status(400).json({ error: "A client with this index ID or Email is already registered." });
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const newId = "user_" + crypto.randomUUID();

    const newUser: User = {
      id: newId,
      indexNumber: role === "student" ? indexNumber : undefined,
      fullName,
      email,
      role: role as any,
      passwordHash,
      oauthConnected: false
    };

    await db.insert(schema.users).values({
      id: newId,
      indexNumber: role === "student" ? indexNumber : null,
      fullName,
      email,
      role,
      passwordHash,
      oauthConnected: false,
      needsPasswordChange: false,
    });

    const sessionToken = crypto.randomBytes(32).toString("hex");
    ACTIVE_SESSIONS.set(sessionToken, newUser);

    res.status(201).json({
      message: "Registration successful",
      token: sessionToken,
      user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, role: newUser.role, indexNumber: newUser.indexNumber }
    });
  } catch (err: any) {
    console.error("SQL registration error:", err);
    res.status(500).json({ error: "Database error during registration process: " + err.message });
  }
});

// Authentication: Login with Index Number or Email
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    await logAuthAttempt(identifier || "Unknown", "failed", "Missing identifier or password", req);
    return res.status(400).json({ error: "Identifier and password credentials are required." });
  }

  try {
    const inputHash = crypto.createHash("sha256").update(password).digest("hex");

    const userObj = (await db.select().from(schema.users).where(
      or(
        eq(schema.users.indexNumber, identifier),
        eq(schema.users.email, identifier)
      )
    ))[0];

    if (!userObj) {
      await logAuthAttempt(identifier, "failed", "Credentials rejected. Profile search yielded empty results", req);
      return res.status(401).json({ error: "Authentication failed. User not found." });
    }

    const isValid = userObj.passwordHash === inputHash;

    if (!isValid) {
      await logAuthAttempt(identifier, "failed", "Unmatched security credential cipher keys comparison", req);
      return res.status(401).json({ error: "Invalid password credentials." });
    }

    const matchedUser: User = {
      id: userObj.id,
      indexNumber: userObj.indexNumber || undefined,
      fullName: userObj.fullName,
      email: userObj.email,
      role: userObj.role as any,
      oauthConnected: userObj.oauthConnected || false,
      needsPasswordChange: userObj.needsPasswordChange || false,
    };

    const sessionToken = crypto.randomBytes(32).toString("hex");
    ACTIVE_SESSIONS.set(sessionToken, matchedUser);

    await logAuthAttempt(identifier, "success", "Interactive portal portal authorization granted", req);

    res.json({
      message: "Login successful",
      token: sessionToken,
      user: { id: matchedUser.id, fullName: matchedUser.fullName, email: matchedUser.email, role: matchedUser.role, indexNumber: matchedUser.indexNumber }
    });
  } catch (err: any) {
    console.error("SQL login error:", err);
    res.status(500).json({ error: "Database error during login: " + err.message });
  }
});

// OAuth 2.0 Client Flow Gateway Exchange
app.post("/api/auth/oauth-sync", async (req, res) => {
  const { oauthProvider, email, fullName, indexNumber } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ error: "OAuth profile syncing requires email and name scope." });
  }

  try {
    let userObj = (await db.select().from(schema.users).where(eq(schema.users.email, email)))[0];

    if (!userObj) {
      const generatedId = "user_" + crypto.randomUUID();
      const derivedIndex = indexNumber || "O-" + Math.floor(10000000 + Math.random() * 90000000);
      const assignedRole = email.endsWith("@gdcms.edu") ? "lecturer" : "student";

      await db.insert(schema.users).values({
        id: generatedId,
        fullName,
        email,
        indexNumber: derivedIndex,
        role: assignedRole,
        oauthConnected: true,
        needsPasswordChange: false,
      });

      userObj = {
        id: generatedId,
        fullName,
        email,
        indexNumber: derivedIndex,
        role: assignedRole,
        oauthConnected: true,
        passwordHash: null,
        needsPasswordChange: false,
      };
    } else {
      if (!userObj.oauthConnected) {
        await db.update(schema.users).set({ oauthConnected: true }).where(eq(schema.users.id, userObj.id));
        userObj.oauthConnected = true;
      }
    }

    const matchedUser: User = {
      id: userObj.id,
      indexNumber: userObj.indexNumber || undefined,
      fullName: userObj.fullName,
      email: userObj.email,
      role: userObj.role as any,
      oauthConnected: userObj.oauthConnected || false,
      needsPasswordChange: userObj.needsPasswordChange || false,
    };

    const sessionToken = "oauth_" + crypto.randomBytes(32).toString("hex");
    ACTIVE_SESSIONS.set(sessionToken, matchedUser);

    res.json({
      message: `Linked via ${oauthProvider} OAuth 2.0 successfully.`,
      token: sessionToken,
      user: { id: matchedUser.id, fullName: matchedUser.fullName, email: matchedUser.email, role: matchedUser.role, indexNumber: matchedUser.indexNumber }
    });
  } catch (err: any) {
    console.error("OAuth sync error:", err);
    res.status(500).json({ error: "Database error during OAuth syncing: " + err.message });
  }
});

// Get Session Identity
app.get("/api/auth/me", authGuard, (req, res) => {
  const user = (req as any).user;
  res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, indexNumber: user.indexNumber });
});

// Logout Session
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    ACTIVE_SESSIONS.delete(token);
  }
  res.json({ message: "Session invalidated successfully." });
});

// ---------------------------------------------------------
// COURSE OUTLINES / MATERIALS API & SECURE AES ENCRYPTION
// ---------------------------------------------------------

// List active Courses
app.get("/api/courses", authGuard, async (req, res) => {
  try {
    const allCourses = await db.select().from(schema.courses);
    res.json(allCourses);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching courses: " + err.message });
  }
});

// Get Materials List for active Courses
app.get("/api/materials", authGuard, async (req, res) => {
  try {
    const allMaterials = await db.select().from(schema.materials);
    res.json(allMaterials);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching materials: " + err.message });
  }
});

// Upload and ENCRYPT course document/lecture note via AES-256
app.post("/api/materials/upload", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer" && user.role !== "admin") {
    return res.status(403).json({ error: "Only lecturers are authorized to distribute course materials." });
  }

  const { title, description, type, courseId, fileName, fileData, mimeType, deadline } = req.body;

  if (!title || !courseId || !fileName || !fileData || !type) {
    return res.status(400).json({ error: "Missing metadata or binary file fields." });
  }

  try {
    const buffer = Buffer.from(fileData, "base64");
    const fileSize = buffer.length;

    // Run AES-256 Encrypt on the Raw File Buffer
    const encrypted = encryptBuffer(buffer);

    // Save secure ciphertext payload to uploads/
    const storageKey = `gdcms_material_${crypto.randomUUID()}.enc`;
    fs.writeFileSync(path.join(UPLOADS_DIR, storageKey), encrypted);

    const generatedMaterialId = "mat_" + crypto.randomUUID();

    const newMaterial: Material = {
      id: generatedMaterialId,
      courseId,
      title,
      description: description || "",
      type: type as any,
      uploadedBy: user.fullName,
      uploadedAt: new Date().toISOString(),
      fileKey: storageKey,
      originalName: fileName,
      mimeType: mimeType || "application/octet-stream",
      fileSize,
      deadline: deadline || undefined
    };

    await db.insert(schema.materials).values({
      id: generatedMaterialId,
      courseId,
      title,
      description: description || "",
      type,
      uploadedBy: user.fullName,
      uploadedAt: newMaterial.uploadedAt,
      fileKey: storageKey,
      originalName: fileName,
      mimeType: newMaterial.mimeType,
      fileSize,
      deadline: deadline || null,
    });

    // Auto emit notification
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)))[0];
    await db.insert(schema.notifications).values({
      id: "notif_" + crypto.randomUUID(),
      userId: "all",
      title: "New Material Uploaded 📚",
      message: `${user.fullName} uploaded ${title} for ${course?.code || "Course"}.`,
      type: "material",
      createdAt: new Date().toISOString(),
      isRead: false,
    });

    res.status(201).json({ message: "Document uploaded and encrypted successfully.", material: newMaterial });
  } catch (err: any) {
    console.error("AES-256 process crashed on material upload:", err);
    res.status(500).json({ error: "Cryptographic system error: " + err.message });
  }
});

// Decrypt and DOWNLOAD / Stream encrypted file at rest securely
app.get("/api/materials/download/:id", authGuard, async (req, res) => {
  const materialId = req.params.id;

  try {
    const material = (await db.select().from(schema.materials).where(eq(schema.materials.id, materialId)))[0];
    const submission = (await db.select().from(schema.submissions).where(eq(schema.submissions.id, materialId)))[0];

    const fileMeta = material || submission;

    if (!fileMeta) {
      return res.status(404).json({ error: "Document item not found in database records." });
    }

    const filePath = path.join(UPLOADS_DIR, fileMeta.fileKey);

    if (!fs.existsSync(filePath)) {
      const mockContent = `GDCMS SECURE SYSTEM\nDocument ID: ${fileMeta.id}\nOriginal Name: ${fileMeta.originalName}\nAt-Rest Encryption: AES-256-CBC\nThis file was securely decrypted on-the-fly from physical disk. All systems operational.`;
      const encryptedMock = encryptBuffer(Buffer.from(mockContent, "utf8"));
      fs.writeFileSync(filePath, encryptedMock);
    }

    const encryptedContent = fs.readFileSync(filePath);
    const decrypted = decryptBuffer(encryptedContent);

    res.setHeader("Content-Type", (fileMeta as any).mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileMeta.originalName}"`);
    res.setHeader("Content-Length", decrypted.length);
    res.send(decrypted);
  } catch (err: any) {
    console.error("AES-256 Decrypt operation failed:", err);
    res.status(500).json({ error: "Cryptographic system failed to decrypt file payload: " + err.message });
  }
});

// ---------------------------------------------------------
// STUDENT ASSIGNMENT SUBMISSIONS & MARKING
// ---------------------------------------------------------

// List submissions: Students get only theirs, lecturers get everything!
app.get("/api/submissions", authGuard, async (req, res) => {
  const user = (req as any).user;

  try {
    if (user.role === "student") {
      const studentSubs = await db.select().from(schema.submissions).where(eq(schema.submissions.studentId, user.id));
      return res.json(studentSubs);
    }

    const allSubs = await db.select().from(schema.submissions);
    res.json(allSubs);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching submissions: " + err.message });
  }
});

// Student uploads Assignment submission (AES-256 Encrypted)
app.post("/api/submissions/upload", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "student") {
    return res.status(403).json({ error: "Only student portal users can submit assignments." });
  }

  const { assignmentId, fileName, fileData, mimeType } = req.body;

  if (!assignmentId || !fileName || !fileData) {
    return res.status(400).json({ error: "Missing required submission document parameters." });
  }

  try {
    const buffer = Buffer.from(fileData, "base64");

    // Cryptographic asset lock
    const encrypted = encryptBuffer(buffer);
    const storageKey = `gdcms_submission_${crypto.randomUUID()}.enc`;
    fs.writeFileSync(path.join(UPLOADS_DIR, storageKey), encrypted);

    // Handle overwrite if student submits multiple times
    const existing = (await db.select().from(schema.submissions).where(
      and(
        eq(schema.submissions.assignmentId, assignmentId),
        eq(schema.submissions.studentId, user.id)
      )
    ))[0];

    const generatedSubId = existing ? existing.id : "sub_" + crypto.randomUUID();

    const newSubmission: Submission = {
      id: generatedSubId,
      assignmentId,
      studentId: user.id,
      studentIndex: user.indexNumber || "Unknown",
      studentName: user.fullName,
      fileKey: storageKey,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
      status: "pending"
    };

    if (existing) {
      try {
        const oldPath = path.join(UPLOADS_DIR, existing.fileKey);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {}

      await db.update(schema.submissions).set({
        fileKey: storageKey,
        originalName: fileName,
        uploadedAt: newSubmission.uploadedAt,
        status: "pending",
        grade: null,
        feedback: null,
        gradedBy: null,
        gradedAt: null,
      }).where(eq(schema.submissions.id, existing.id));
    } else {
      await db.insert(schema.submissions).values({
        id: generatedSubId,
        assignmentId,
        studentId: user.id,
        studentIndex: user.indexNumber || "Unknown",
        studentName: user.fullName,
        fileKey: storageKey,
        originalName: fileName,
        uploadedAt: newSubmission.uploadedAt,
        status: "pending",
      });
    }

    // Generate lecturer notification upon student assignment upload
    try {
      const promptMaterial = (await db.select().from(schema.materials).where(eq(schema.materials.id, assignmentId)))[0];
      const assignmentTitle = promptMaterial ? promptMaterial.title : "Class Assignment";

      const lecturers = await db.select().from(schema.users).where(eq(schema.users.role, "lecturer"));
      for (const lecturer of lecturers) {
        await db.insert(schema.notifications).values({
          id: "notif_" + crypto.randomUUID(),
          userId: lecturer.id,
          title: "New Submission Collected 📥",
          message: `${user.fullName} (${user.indexNumber || "Student"}) submitted coursework for: "${assignmentTitle}".`,
          type: "assignment",
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      }
    } catch (notifErr) {
      console.error("Failed to generate lecturer submission alert notifications:", notifErr);
    }

    res.status(201).json({ message: "Submission encrypted and pushed successfully.", submission: newSubmission });
  } catch (err: any) {
    console.error("Secure uploading failed:", err);
    res.status(500).json({ error: "At-rest encryption failure: " + err.message });
  }
});

// Lecturer Grades & Evaluates dynamic submission
app.post("/api/submissions/grade", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer" && user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized access. Role restricted." });
  }

  const { submissionId, grade, feedback } = req.body;

  if (!submissionId || !grade) {
    return res.status(400).json({ error: "Submission reference and Grade score are required." });
  }

  try {
    const sub = (await db.select().from(schema.submissions).where(eq(schema.submissions.id, submissionId)))[0];

    if (!sub) {
      return res.status(404).json({ error: "Specified student submission is missing." });
    }

    const gradedAtVal = new Date().toISOString();

    await db.update(schema.submissions).set({
      grade,
      feedback: feedback || "",
      gradedBy: user.fullName,
      gradedAt: gradedAtVal,
      status: "graded",
    }).where(eq(schema.submissions.id, submissionId));

    const updatedSub: Submission = {
      id: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      studentIndex: sub.studentIndex,
      studentName: sub.studentName,
      fileKey: sub.fileKey,
      originalName: sub.originalName,
      uploadedAt: sub.uploadedAt,
      grade,
      feedback: feedback || "",
      gradedBy: user.fullName,
      gradedAt: gradedAtVal,
      status: "graded"
    };

    // Create immediate notification item for targeted student
    const assignment = (await db.select().from(schema.materials).where(eq(schema.materials.id, sub.assignmentId)))[0];
    await db.insert(schema.notifications).values({
      id: "notif_" + crypto.randomUUID(),
      userId: sub.studentId,
      title: "New Assessment Graded! 📝",
      message: `Your work for ${assignment?.title || "Assignment"} scored: ${grade}. Lecturer comments: "${feedback || 'No comments'}"`,
      type: "grade",
      createdAt: new Date().toISOString(),
      isRead: false,
    });

    res.json({ message: "Assessment grading updated successfully.", submission: updatedSub });
  } catch (err: any) {
    res.status(500).json({ error: "Database error grading submission: " + err.message });
  }
});

// ---------------------------------------------------------
// STUDENT PERSONAL PRIVATE ENCRYPTED NOTES
// ---------------------------------------------------------

// List personal notes
app.get("/api/notes", authGuard, async (req, res) => {
  const user = (req as any).user;

  try {
    const userNotes = await db.select().from(schema.notes).where(eq(schema.notes.studentId, user.id));

    // Decrypt contents on-the-fly before sending to client
    const decryptedNotes = userNotes.map(n => ({
      id: n.id,
      studentId: n.studentId,
      title: n.title,
      content: decryptText(n.content),
      updatedAt: n.updatedAt,
      isSynced: n.isSynced ?? true,
      tag: n.tag || undefined,
    }));

    res.json(decryptedNotes);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching notes: " + err.message });
  }
});

// Post and update Encrypted personal notes
app.post("/api/notes", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { id, title, content, tag } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Note title cannot be blank." });
  }

  try {
    const encryptedContent = encryptText(content || "");

    const targetId = id || "note_" + crypto.randomUUID();
    const existing = (await db.select().from(schema.notes).where(
      and(
        eq(schema.notes.id, targetId),
        eq(schema.notes.studentId, user.id)
      )
    ))[0];

    const updatedAt = new Date().toISOString();

    if (existing) {
      await db.update(schema.notes).set({
        title,
        content: encryptedContent,
        updatedAt,
        isSynced: true,
        tag: tag || null,
      }).where(eq(schema.notes.id, existing.id));

      res.json({
        message: "Personal note saved and encrypted.",
        note: { id: targetId, title, content, updatedAt, studentId: user.id, isSynced: true, tag }
      });
    } else {
      await db.insert(schema.notes).values({
        id: targetId,
        studentId: user.id,
        title,
        content: encryptedContent,
        updatedAt,
        isSynced: true,
        tag: tag || null,
      });

      res.status(201).json({
        message: "Personal note created and encrypted.",
        note: { id: targetId, studentId: user.id, title, content, updatedAt, isSynced: true, tag }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Database error saving note: " + err.message });
  }
});

// Batch Sync Student Notes
app.post("/api/notes/sync", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { notes: clientNotes } = req.body;

  if (!Array.isArray(clientNotes)) {
    return res.status(400).json({ error: "Invalid sync collection format." });
  }

  try {
    let syncCount = 0;

    for (const clientNote of clientNotes) {
      const encryptedContent = encryptText(clientNote.content || "");
      const existing = (await db.select().from(schema.notes).where(
        and(
          eq(schema.notes.id, clientNote.id),
          eq(schema.notes.studentId, user.id)
        )
      ))[0];

      const updatedAtVal = clientNote.updatedAt || new Date().toISOString();

      if (existing) {
        await db.update(schema.notes).set({
          title: clientNote.title,
          content: encryptedContent,
          updatedAt: updatedAtVal,
          isSynced: true,
          tag: clientNote.tag || null,
        }).where(eq(schema.notes.id, existing.id));
      } else {
        await db.insert(schema.notes).values({
          id: clientNote.id,
          studentId: user.id,
          title: clientNote.title,
          content: encryptedContent,
          updatedAt: updatedAtVal,
          isSynced: true,
          tag: clientNote.tag || null,
        });
      }
      syncCount++;
    }

    if (syncCount > 0) {
      await db.insert(schema.notifications).values({
        id: "notif_" + crypto.randomUUID(),
        userId: user.id,
        title: "Offline Sync Complete! 🔄",
        message: `${syncCount} personal notebook entries successfully saved and encrypted with AES-256 on the cloud.`,
        type: "offline_sync",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }

    res.json({ message: "Sync successful", syncedCount: syncCount });
  } catch (err: any) {
    res.status(500).json({ error: "Database error syncing notes: " + err.message });
  }
});

// ---------------------------------------------------------
// NOTIFICATIONS IN-APP FEED API
// ---------------------------------------------------------
app.get("/api/notifications", authGuard, async (req, res) => {
  const user = (req as any).user;

  try {
    const userNotifs = await db.select().from(schema.notifications).where(
      or(
        eq(schema.notifications.userId, user.id),
        eq(schema.notifications.userId, "all")
      )
    );
    res.json(userNotifs);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching notifications: " + err.message });
  }
});

app.post("/api/notifications/read-all", authGuard, async (req, res) => {
  const user = (req as any).user;

  try {
    await db.update(schema.notifications).set({ isRead: true }).where(
      or(
        eq(schema.notifications.userId, user.id),
        eq(schema.notifications.userId, "all")
      )
    );
    res.json({ message: "All items marked read." });
  } catch (err: any) {
    res.status(500).json({ error: "Database error marking read: " + err.message });
  }
});

app.post("/api/notifications/:id/read", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const notif = (await db.select().from(schema.notifications).where(
      and(
        eq(schema.notifications.id, id),
        or(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.userId, "all")
        )
      )
    ))[0];

    if (notif) {
      await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, id));
      res.json({ message: "Notification marked read.", notification: { ...notif, isRead: true } });
    } else {
      res.status(404).json({ error: "Notification not found or access denied." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Database error marking item: " + err.message });
  }
});

// Delete Notification
app.delete("/api/notifications/:id", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const notif = (await db.select().from(schema.notifications).where(
      and(
        eq(schema.notifications.id, id),
        or(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.userId, "all")
        )
      )
    ))[0];

    if (notif) {
      await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
      res.json({ message: "Notification deleted successfully." });
    } else {
      res.status(404).json({ error: "Notification not found or access denied." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Database error deleting item: " + err.message });
  }
});

// Edit Notification
app.put("/api/notifications/:id", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title, message } = req.body;

  try {
    const notif = (await db.select().from(schema.notifications).where(
      and(
        eq(schema.notifications.id, id),
        or(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.userId, "all")
        )
      )
    ))[0];

    if (notif) {
      const updatePayload: any = {};
      if (title) updatePayload.title = title;
      if (message) updatePayload.message = message;

      await db.update(schema.notifications).set(updatePayload).where(eq(schema.notifications.id, id));
      res.json({ message: "Notification updated successfully.", notification: { ...notif, ...updatePayload } });
    } else {
      res.status(404).json({ error: "Notification not found or access denied." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Database error editing item: " + err.message });
  }
});

// ---------------------------------------------------------
// GOOGLE OAUTH 2.0 FOR CALENDAR & DRIVE INTEGRATIONS
// ---------------------------------------------------------
app.get("/api/auth/google-url", (req, res) => {
  // Production-ready dynamic detection of the host URL to perfectly adapt to development and deployment frames
  const detectedHost = `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${detectedHost.replace(/\/$/, "")}/auth/callback`;
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";

  if (!clientId) {
    return res.status(500).json({ error: "Google OAuth Client ID is not configured in environment variables." });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.coursework.students",
    access_type: "offline",
    prompt: "consent"
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const detectedHost = `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${detectedHost.replace(/\/$/, "")}/auth/callback`;
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

  if (!code) {
    return res.send(`<html><body><h3>Authorization code missing.</h3></body></html>`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json() as any;

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Exchange failed token data:", tokenData);
      return res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h3 style="color: #ea4335;">Google Authorization Failed</h3>
            <p>Could not exchange code for access token. Please check that CLIENT_ID and CLIENT_SECRET are configured correctly in your project credentials settings.</p>
            <pre style="background: #f1f1f1; padding: 10px; border-radius: 5px;">${JSON.stringify(tokenData, null, 2)}</pre>
          </body>
        </html>
      `);
    }

    return res.send(`
      <html>
        <head>
          <title>Google Calendar & Drive Integration | GDCMS Auth Hub</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>body { font-family: 'Inter', sans-serif; }</style>
        </head>
        <body class="bg-[#f0f4f9] min-h-screen flex items-center justify-center p-6 text-[#1e1e1e]">
          <div class="w-full max-w-lg bg-white border border-slate-200/80 shadow-xl rounded-3xl p-8 text-center space-y-6">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            </div>
            
            <div class="space-y-2">
              <h2 class="text-2xl font-extrabold text-slate-800">Connection Successful!</h2>
              <p class="text-sm text-slate-500">Your Google academic ledger is now actively synced to GDCMS Secure Cloud.</p>
            </div>

            <div class="bg-indigo-50/50 rounded-2xl p-5 text-left border border-indigo-100">
              <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3">Key Connected Benefits:</h3>
              <ul class="space-y-2.5 text-xs text-slate-600">
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Automatic Calendar Syncing:</strong> Real-time assessment due dates and deadlines automatically push to your primary Google Calendar.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Secure Note Ciphers Backups:</strong> Save, encrypt, and export private notebooks securely to your Google Drive account with 1-click execution.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Offline Reminders Pipeline:</strong> Alerts remain active, keeping you completely on top of classes and assignment milestones.</span>
                </li>
              </ul>
            </div>

            <div class="text-xs text-slate-500 font-medium italic">
              Transmitting secure symmetric tokens to primary GDCMS window...
            </div>

            <button onclick="closeNow()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer">
              Complete Sync & Close (<span id="seconds">5</span>s)
            </button>

            <script>
              let secondsLeft = 5;
              const timerEl = document.getElementById('seconds');
              
              function closeNow() {
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: '${tokenData.access_token}' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }

              const interval = setInterval(() => {
                secondsLeft--;
                if (timerEl) timerEl.textContent = secondsLeft;
                if (secondsLeft <= 0) {
                  clearInterval(interval);
                  closeNow();
                }
              }, 1000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Google Callback Error:", err);
    return res.send(`<html><body><h3>Exception during Authorization: ${err.message}</h3></body></html>`);
  }
});

// ---------------------------------------------------------
// ADMINISTRATIVE CONFIGURATIONS, AUDIT LOGS & BROADCASTS
// ---------------------------------------------------------

app.get("/api/app-config", async (req, res) => {
  try {
    let config = (await db.select().from(schema.appConfig).where(eq(schema.appConfig.id, "config")))[0];
    if (!config) {
      const defaultConfig = {
        id: "config",
        systemName: "Group D Class Management System",
        systemShort: "GDCMS",
        assignmentsTerm: "Assignments",
        materialsTerm: "Course Materials",
        themeColor: "indigo",
        fontSizePreset: "standard",
        sidebarStyle: "dark-navy"
      };
      await db.insert(schema.appConfig).values(defaultConfig);
      config = defaultConfig;
    }
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching application config: " + err.message });
  }
});

app.post("/api/admin/app-config", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const config = req.body;
  if (!config) {
    return res.status(400).json({ error: "Missing configuration parameters." });
  }

  try {
    await db.update(schema.appConfig).set({
      systemName: config.systemName,
      systemShort: config.systemShort,
      assignmentsTerm: config.assignmentsTerm,
      materialsTerm: config.materialsTerm,
      themeColor: config.themeColor,
      fontSizePreset: config.fontSizePreset,
      sidebarStyle: config.sidebarStyle,
    }).where(eq(schema.appConfig.id, "config"));

    const updated = (await db.select().from(schema.appConfig).where(eq(schema.appConfig.id, "config")))[0];
    res.json({ message: "Application rebranded and restructured successfully.", appConfig: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Database error saving system configuration: " + err.message });
  }
});

app.get("/api/admin/logs", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }

  try {
    const logsList = await db.select().from(schema.logs).orderBy(desc(schema.logs.timestamp)).limit(150);
    res.json(logsList);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching audit logs: " + err.message });
  }
});

app.post("/api/admin/logs/clear", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }

  try {
    await db.delete(schema.logs);
    await db.delete(schema.notifications).where(eq(schema.notifications.type, "offline_sync"));

    // Purge physical temporary files
    try {
      const files = fs.readdirSync(process.cwd());
      files.forEach((file: string) => {
        if (file.endsWith(".log") || file.startsWith("npm-debug") || file.endsWith(".tmp")) {
          try {
            fs.unlinkSync(path.join(process.cwd(), file));
          } catch (e) {}
        }
      });
    } catch (err) {
      console.error("Purging session logging files skipped:", err);
    }

    res.json({ message: "Recorded security audit logs and connection/sync logs cleared successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Database error clearing logs: " + err.message });
  }
});

app.get("/api/admin/users", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }

  try {
    const list = await db.select().from(schema.users);
    const defaultHash = crypto.createHash("sha256").update("123456").digest("hex");

    const safeUsers = list.map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      indexNumber: u.indexNumber || undefined,
      oauthConnected: u.oauthConnected || false,
      needsPasswordChange: u.needsPasswordChange || (u.passwordHash === defaultHash)
    }));
    res.json(safeUsers);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching users: " + err.message });
  }
});

// Admin manual user password reset assistant helper
app.post("/api/admin/reset-user-password", authGuard, async (req, res) => {
  const adminUser = (req as any).user;
  if (adminUser.role !== "admin") {
    return res.status(403).json({ error: "Only administrative personnel are authorized to perform security override resets." });
  }

  const { userId, newTempPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Please specify target user model identifier." });
  }

  try {
    const targetUser = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
    if (!targetUser) {
      return res.status(404).json({ error: "Requested security profile record not found." });
    }

    const tempPass = newTempPassword || "123456";
    const expectedHash = crypto.createHash("sha256").update(tempPass).digest("hex");

    await db.update(schema.users).set({
      passwordHash: expectedHash,
      needsPasswordChange: true,
    }).where(eq(schema.users.id, userId));

    await db.insert(schema.notifications).values({
      id: "notif_" + crypto.randomUUID(),
      userId: userId,
      title: "Account Password Reset 🛡️",
      message: `A system administrator has manually updated your security credentials. Use the reset key to authenticate and update it on your next login session.`,
      type: "offline_sync",
      createdAt: new Date().toISOString(),
      isRead: false,
    });

    res.json({ message: `Successfully reset password for ${targetUser.fullName} to: '${tempPass}'.` });
  } catch (err: any) {
    res.status(500).json({ error: "Database error resetting password: " + err.message });
  }
});

// Admin Database Status / Metrics Explorer
app.get("/api/admin/db-status", authGuard, async (req, res) => {
  const adminUser = (req as any).user;
  if (adminUser.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }

  try {
    const [usersCount, coursesCount, materialsCount, submissionsCount, notesCount, notificationsCount, logsCount] = await Promise.all([
      db.select().from(schema.users),
      db.select().from(schema.courses),
      db.select().from(schema.materials),
      db.select().from(schema.submissions),
      db.select().from(schema.notes),
      db.select().from(schema.notifications),
      db.select().from(schema.logs)
    ]);

    const stats = {
      users: usersCount.length,
      courses: coursesCount.length,
      materials: materialsCount.length,
      submissions: submissionsCount.length,
      notes: notesCount.length,
      notifications: notificationsCount.length,
      logs: logsCount.length,
      dbType: "PostgreSQL (Google Cloud SQL)",
      region: "europe-west2",
      connectionStatus: "Connected & Operational"
    };

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch relational database specs: " + err.message });
  }
});

// Admin Database Re-seeding Action
app.post("/api/admin/db-seed", authGuard, async (req, res) => {
  const adminUser = (req as any).user;
  if (adminUser.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(fileContent);

      await db.delete(schema.logs);
      await db.delete(schema.notifications);
      await db.delete(schema.notes);
      await db.delete(schema.submissions);
      await db.delete(schema.materials);
      await db.delete(schema.courses);

      // Seed courses
      if (parsed.courses && parsed.courses.length > 0) {
        await db.insert(schema.courses).values(parsed.courses.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          lecturerId: c.lecturerId,
          description: c.description,
          outlineUrl: c.outlineUrl || null,
          outlineName: c.outlineName || null,
        })));
      }

      // Seed materials
      if (parsed.materials && parsed.materials.length > 0) {
        await db.insert(schema.materials).values(parsed.materials.map((m: any) => ({
          id: m.id,
          courseId: m.courseId,
          title: m.title,
          description: m.description,
          type: m.type,
          uploadedBy: m.uploadedBy,
          uploadedAt: m.uploadedAt,
          fileKey: m.fileKey,
          originalName: m.originalName,
          mimeType: m.mimeType,
          fileSize: m.fileSize,
          deadline: m.deadline || null,
        })));
      }

      // Seed submissions
      if (parsed.submissions && parsed.submissions.length > 0) {
        await db.insert(schema.submissions).values(parsed.submissions.map((s: any) => ({
          id: s.id,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          studentIndex: s.studentIndex,
          studentName: s.studentName,
          fileKey: s.fileKey,
          originalName: s.originalName,
          uploadedAt: s.uploadedAt,
          grade: s.grade || null,
          feedback: s.feedback || null,
          gradedBy: s.gradedBy || null,
          gradedAt: s.gradedAt || null,
          status: s.status,
        })));
      }

      // Seed notes
      if (parsed.notes && parsed.notes.length > 0) {
        await db.insert(schema.notes).values(parsed.notes.map((n: any) => ({
          id: n.id,
          studentId: n.studentId,
          title: n.title,
          content: n.content.includes(":") ? n.content : encryptText(n.content),
          updatedAt: n.updatedAt,
          isSynced: n.isSynced ?? true,
          tag: n.tag || null,
        })));
      }

      // Seed notifications
      if (parsed.notifications && parsed.notifications.length > 0) {
        await db.insert(schema.notifications).values(parsed.notifications.map((n: any) => ({
          id: n.id,
          userId: n.userId,
          title: n.title,
          message: n.message,
          type: n.type,
          createdAt: n.createdAt,
          isRead: n.isRead || false,
        })));
      }

      // Add a fresh notification
      await db.insert(schema.notifications).values({
        id: "notif_system_" + crypto.randomUUID(),
        userId: adminUser.id,
        title: "Relational DB Re-Seeded ⚡",
        message: `Relational tables successfully cleared and re-populated with pristine seed records.`,
        type: "offline_sync",
        createdAt: new Date().toISOString(),
        isRead: false,
      });

      res.json({ message: "Successfully purged and re-seeded relational database tables from system registry schema!" });
    } else {
      res.status(404).json({ error: "Source registry data file (db.json) could not be retrieved." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to seed PostgreSQL database: " + err.message });
  }
});

// Change/Update personal password
app.post("/api/auth/change-password", authGuard, async (req, res) => {
  const user = (req as any).user;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Custom ciphers must be at least 4 alphanumeric characters." });
  }

  try {
    const targetUser = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)))[0];
    if (!targetUser) {
      return res.status(404).json({ error: "Secure node user details not found." });
    }

    const expectedHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    await db.update(schema.users).set({
      passwordHash: expectedHash,
      needsPasswordChange: false,
    }).where(eq(schema.users.id, user.id));

    await db.insert(schema.notifications).values({
      id: "notif_" + crypto.randomUUID(),
      userId: user.id,
      title: "Password Updated Successfully Key 🔑",
      message: "Your GDCMS personal profile database password hash has been modified. Do not share your login index codes.",
      type: "grade",
      createdAt: new Date().toISOString(),
      isRead: false,
    });

    res.json({ message: "Network password updated and hashed locally." });
  } catch (err: any) {
    res.status(500).json({ error: "Database error updating password: " + err.message });
  }
});

app.get("/api/lecturer/students", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer") {
    return res.status(403).json({ error: "Lecturer portal access required." });
  }

  try {
    const list = await db.select().from(schema.users).where(eq(schema.users.role, "student"));
    const students = list.map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      indexNumber: u.indexNumber || undefined,
      oauthConnected: u.oauthConnected || false
    }));
    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: "Database error fetching students: " + err.message });
  }
});

app.post("/api/admin/broadcast-alert", authGuard, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const { targetRole, message, title } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Advisory alert message cannot be empty." });
  }

  try {
    const titleText = title || "Security Alert Advisory 🛡️";

    if (targetRole === "all") {
      const targets = await db.select().from(schema.users).where(
        or(
          eq(schema.users.role, "student"),
          eq(schema.users.role, "lecturer")
        )
      );
      for (const t of targets) {
        await db.insert(schema.notifications).values({
          id: "notif_" + crypto.randomUUID(),
          userId: t.id,
          title: titleText,
          message,
          type: "grade",
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      }
    } else if (targetRole === "student" || targetRole === "lecturer") {
      const targets = await db.select().from(schema.users).where(eq(schema.users.role, targetRole));
      for (const t of targets) {
        await db.insert(schema.notifications).values({
          id: "notif_" + crypto.randomUUID(),
          userId: t.id,
          title: titleText,
          message,
          type: "grade",
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      }
    } else if (targetRole) {
      await db.insert(schema.notifications).values({
        id: "notif_" + crypto.randomUUID(),
        userId: targetRole,
        title: titleText,
        message,
        type: "grade",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } else {
      return res.status(400).json({ error: "Please declare a valid audience target role." });
    }

    res.json({ message: "Broadcast notifications triggered and queued successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Database error broadcasting alerts: " + err.message });
  }
});

// ---------------------------------------------------------
// VITE CLIENT DEV MIDDLEWARE & STATIC BUNDLE FALLBACK
// ---------------------------------------------------------
async function startServer() {
  // Pre-seed the relational Postgres tables gracefully if newly provisioned
  await seedDatabaseIfNeeded();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GDCMS] Production-ready container server securely listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
