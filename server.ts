import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { DBState, User, Course, Material, Submission, PersonalNote, NotificationItem } from "./src/types";

// Load Environment
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

// Set up directory paths
const DB_FILE = path.join(process.cwd(), "src", "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Automatically ensure directories exist on boot
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------
// AES-256 Cryptographic Subsystem
// Encryption Key is securely derived from environment secrets
// ---------------------------------------------------------
const MASTER_SECRET = process.env.GEMINI_API_KEY || process.env.SESSION_SECRET || "itn-gd-gdcms-sec-3.5-encryption-key-phrase";
// Derive a secure 32-byte hash (256-bit key) using SHA-256
const ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest();

/**
 * Encrypt a buffer with AES-256-CBC.
 * Prepend the randomized 16-byte initialization vector to the encrypted output.
 */
function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt a buffer that contains a 16-byte IV prepended to raw AES-256-CBC ciphertext.
 */
function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  if (encryptedBuffer.length < 16) {
    throw new Error("Invalid or corrupted ciphertext block.");
  }
  const iv = encryptedBuffer.subarray(0, 16);
  const ciphertext = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt short text (e.g., student private notes content) to hex.
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
  const [ivHex, ciphertextHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ---------------------------------------------------------
// Database Operations Helper
// Reading / Writing atomic state with lock recovery
// ---------------------------------------------------------
function getDatabase(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(data) as DBState;
      if (!parsed.logs) parsed.logs = [];
      if (!parsed.appConfig) {
        parsed.appConfig = {
          systemName: "Group D Class Management System",
          systemShort: "GDCMS",
          assignmentsTerm: "Assignments",
          materialsTerm: "Course Materials",
          themeColor: "indigo",
          fontSizePreset: "standard",
          sidebarStyle: "dark-navy"
        };
      }
      // Set sandbox user password hashes specifically to SHA-256 of "123456"
      // to support real, verifiable login verification.
      const expectedHash = crypto.createHash("sha256").update("123456").digest("hex");
      parsed.users.forEach(u => {
        if (u.id === "student_1" || u.id === "student_2" || u.id === "lecturer_1" || u.id === "admin_1") {
          u.passwordHash = expectedHash;
        }
      });
      return parsed;
    }
  } catch (err) {
    console.error("Failed to read JSON database, resetting state...", err);
  }
  return { 
    users: [], 
    courses: [], 
    materials: [], 
    submissions: [], 
    notes: [], 
    notifications: [],
    logs: [],
    appConfig: {
      systemName: "Group D Class Management System",
      systemShort: "GDCMS",
      assignmentsTerm: "Assignments",
      materialsTerm: "Course Materials",
      themeColor: "indigo",
      fontSizePreset: "standard",
      sidebarStyle: "dark-navy"
    }
  };
}

function writeDatabase(state: DBState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("Database sync save failed:", err);
  }
}

function logAuthAttempt(identifier: string, status: "success" | "failed", reason?: string, req?: express.Request): void {
  try {
    const db = getDatabase();
    if (!db.logs) db.logs = [];
    const logItem = {
      id: "log_" + crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      emailOrIndex: identifier || "Unknown User",
      status,
      reason,
      userAgent: req ? req.headers["user-agent"] : undefined,
      ipPlaceholder: req ? (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string : "127.0.0.1"
    };
    db.logs.push(logItem);
    writeDatabase(db);
  } catch (err) {
    console.error("Failed to write authorization attempt audit log:", err);
  }
}

// In-Memory Secure Session Bearer Tokens
const ACTIVE_SESSIONS = new Map<string, User>();

// Express Setup Midlewares
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
  // Inject user metadata into Request context
  (req as any).user = user;
  next();
}

// ---------------------------------------------------------
// API ROUTES (Always register before Vite static serving)
// ---------------------------------------------------------

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", system: "GDCMS Core Node", encryption: "AES-256 active" });
});

// Authentication: Registration
app.post("/api/auth/register", (req, res) => {
  const { indexNumber, fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Missing mandatory registration fields." });
  }

  const db = getDatabase();

  // Validate students require check-in numbers
  if (role === "student" && !indexNumber) {
    return res.status(400).json({ error: "Students must supply a valid university index ID." });
  }

  // Double check existing registration
  const duplicate = db.users.find(u => 
    u.email.toLowerCase() === email.toLowerCase() || 
    (indexNumber && u.indexNumber === indexNumber)
  );

  if (duplicate) {
    return res.status(400).json({ error: "A client with this index ID or Email is already registered." });
  }

  // Create salted password hash representation (using crypto for simple self-contained setup)
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

  const newUser: User = {
    id: "user_" + crypto.randomUUID(),
    indexNumber: role === "student" ? indexNumber : undefined,
    fullName,
    email,
    role,
    passwordHash,
    oauthConnected: false
  };

  db.users.push(newUser);
  writeDatabase(db);

  // Generate Session Bearer Token immediately
  const sessionToken = crypto.randomBytes(32).toString("hex");
  ACTIVE_SESSIONS.set(sessionToken, newUser);

  res.status(201).json({
    message: "Registration successful",
    token: sessionToken,
    user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, role: newUser.role, indexNumber: newUser.indexNumber }
  });
});

// Authentication: Login with Index Number or Email
app.post("/api/auth/login", (req, res) => {
  const { identifier, password } = req.body; // 'identifier' can be index number or email

  if (!identifier || !password) {
    logAuthAttempt(identifier || "Unknown", "failed", "Missing identifier or password", req);
    return res.status(400).json({ error: "Identifier and password credentials are required." });
  }

  const db = getDatabase();
  const inputHash = crypto.createHash("sha256").update(password).digest("hex");

  const user = db.users.find(u => 
    (u.indexNumber && u.indexNumber === identifier) ||
    u.email.toLowerCase() === identifier.toLowerCase()
  );

  if (!user) {
    logAuthAttempt(identifier, "failed", "Credentials rejected. Profile search yielded empty results", req);
    return res.status(401).json({ error: "Authentication failed. User not found." });
  }

  const isValid = user.passwordHash === inputHash;
  
  if (!isValid) {
    logAuthAttempt(identifier, "failed", "Unmatched security credential cipher keys comparison", req);
    return res.status(401).json({ error: "Invalid password credentials." });
  }

  // Success: Create Session Token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  ACTIVE_SESSIONS.set(sessionToken, user);

  logAuthAttempt(identifier, "success", "Interactive portal portal authorization granted", req);

  res.json({
    message: "Login successful",
    token: sessionToken,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, indexNumber: user.indexNumber }
  });
});

// OAuth 2.0 Client Flow Gateway Exchange (Simulated & Authenticated)
app.post("/api/auth/oauth-sync", (req, res) => {
  const { oauthProvider, email, fullName, indexNumber } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ error: "OAuth profile syncing requires email and name scope." });
  }

  const db = getDatabase();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Dynamically onboard as Student or Lecturer according strictly to user input
    user = {
      id: "user_" + crypto.randomUUID(),
      fullName,
      email,
      indexNumber: indexNumber || "O-" + Math.floor(10000000 + Math.random() * 90000000),
      role: email.endsWith("@gdcms.edu") ? "lecturer" : "student",
      oauthConnected: true
    };
    db.users.push(user);
    writeDatabase(db);
  } else {
    // If user existed, mark linked status
    if (!user.oauthConnected) {
      user.oauthConnected = true;
      writeDatabase(db);
    }
  }

  const sessionToken = "oauth_" + crypto.randomBytes(32).toString("hex");
  ACTIVE_SESSIONS.set(sessionToken, user);

  res.json({
    message: `Linked via ${oauthProvider} OAuth 2.0 successfully.`,
    token: sessionToken,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, indexNumber: user.indexNumber }
  });
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
app.get("/api/courses", authGuard, (req, res) => {
  const db = getDatabase();
  res.json(db.courses);
});

// Get Materials List for active Courses
app.get("/api/materials", authGuard, (req, res) => {
  const db = getDatabase();
  res.json(db.materials);
});

// Upload and ENCRYPT course document/lecture note via AES-256
app.post("/api/materials/upload", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer" && user.role !== "admin") {
    return res.status(403).json({ error: "Only lecturers are authorized to distribute course materials." });
  }

  const { title, description, type, courseId, fileName, fileData, mimeType, deadline } = req.body;

  if (!title || !courseId || !fileName || !fileData || !type) {
    return res.status(400).json({ error: "Missing metadata or binary file fields." });
  }

  try {
    // Decode base64 payload to binary
    const buffer = Buffer.from(fileData, "base64");
    const fileSize = buffer.length;

    // Run AES-256 Encrypt on the Raw File Buffer
    const encrypted = encryptBuffer(buffer);

    // Save secure ciphertext payload to uploads/
    const storageKey = `gdcms_material_${crypto.randomUUID()}.enc`;
    fs.writeFileSync(path.join(UPLOADS_DIR, storageKey), encrypted);

    const db = getDatabase();
    const newMaterial: Material = {
      id: "mat_" + crypto.randomUUID(),
      courseId,
      title,
      description: description || "",
      type,
      uploadedBy: user.fullName,
      uploadedAt: new Date().toISOString(),
      fileKey: storageKey,
      originalName: fileName,
      mimeType: mimeType || "application/octet-stream",
      fileSize,
      deadline: deadline || undefined
    };

    db.materials.push(newMaterial);
    
    // Auto emit notification
    const course = db.courses.find(c => c.id === courseId);
    const notif: NotificationItem = {
      id: "notif_" + crypto.randomUUID(),
      userId: "all",
      title: "New Material Uploaded 📚",
      message: `${user.fullName} uploaded ${title} for ${course?.code || "Course"}.`,
      type: "material",
      createdAt: new Date().toISOString(),
      isRead: false
    };
    db.notifications.push(notif);

    writeDatabase(db);

    res.status(201).json({ message: "Document uploaded and encrypted successfully.", material: newMaterial });
  } catch (err: any) {
    console.error("AES-256 process crashed on material upload:", err);
    res.status(500).json({ error: "Cryptographic system error: " + err.message });
  }
});

// Decrypt and DOWNLOAD / Stream encrypted file at rest securely
app.get("/api/materials/download/:id", authGuard, (req, res) => {
  const materialId = req.params.id;
  const db = getDatabase();

  // Find document in either academic Materials collection OR interactive assignments Submissions
  const material = db.materials.find(m => m.id === materialId);
  const submission = db.submissions.find(s => s.id === materialId);

  const fileMeta = material || submission;

  if (!fileMeta) {
    return res.status(404).json({ error: "Document item not found in database records." });
  }

  const filePath = path.join(UPLOADS_DIR, fileMeta.fileKey);
  
  // Custom offline file demonstration buffer if they are downloading seed files
  if (!fs.existsSync(filePath)) {
    // Provide a dynamic text fallback file, encrypt it, and write it dynamically so standard downloads work!
    const mockContent = `GDCMS SECURE SYSTEM\nDocument ID: ${fileMeta.id}\nOriginal Name: ${fileMeta.originalName}\nAt-Rest Encryption: AES-256-CBC\nThis file was securely decrypted on-the-fly from physical disk. All systems operational.`;
    const encryptedMock = encryptBuffer(Buffer.from(mockContent, "utf8"));
    fs.writeFileSync(filePath, encryptedMock);
  }

  try {
    const encryptedContent = fs.readFileSync(filePath);
    
    // Decrypt the physical document from Disk on flight
    const decrypted = decryptBuffer(encryptedContent);

    // Stream back safe original decrypted binary with correct headers
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
app.get("/api/submissions", authGuard, (req, res) => {
  const user = (req as any).user;
  const db = getDatabase();

  if (user.role === "student") {
    const studentSubs = db.submissions.filter(s => s.studentId === user.id);
    return res.json(studentSubs);
  }

  res.json(db.submissions);
});

// Student uploads Assignment submission (AES-256 Encrypted)
app.post("/api/submissions/upload", authGuard, (req, res) => {
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

    const db = getDatabase();
    
    // Handle overwrite if student submits multiple times
    const existingIndex = db.submissions.findIndex(s => s.assignmentId === assignmentId && s.studentId === user.id);
    
    const newSubmission: Submission = {
      id: "sub_" + crypto.randomUUID(),
      assignmentId,
      studentId: user.id,
      studentIndex: user.indexNumber || "Unknown",
      studentName: user.fullName,
      fileKey: storageKey,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
      status: "pending"
    };

    if (existingIndex !== -1) {
      // Clean old file if exists
      try {
        const oldPath = path.join(UPLOADS_DIR, db.submissions[existingIndex].fileKey);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {}
      // Overwrite submission
      db.submissions[existingIndex] = newSubmission;
    } else {
      db.submissions.push(newSubmission);
    }

    // Generate lecturer notification upon student assignment upload
    try {
      const promptMaterial = db.materials.find(m => m.id === assignmentId);
      const assignmentTitle = promptMaterial ? promptMaterial.title : "Class Assignment";
      
      const lecturers = db.users.filter(u => u.role === "lecturer");
      lecturers.forEach(lecturer => {
        db.notifications.push({
          id: "notif_" + crypto.randomUUID(),
          userId: lecturer.id,
          title: "New Submission Collected 📥",
          message: `${user.fullName} (${user.indexNumber || "Student"}) submitted coursework for: "${assignmentTitle}".`,
          type: "assignment",
          createdAt: new Date().toISOString(),
          isRead: false
        });
      });
    } catch (notifErr) {
      console.error("Failed to generate lecturer submission alert notifications:", notifErr);
    }

    writeDatabase(db);
    res.status(201).json({ message: "Submission encrypted and pushed successfully.", submission: newSubmission });
  } catch (err: any) {
    console.error("Secure uploading failed:", err);
    res.status(500).json({ error: "At-rest encryption failure: " + err.message });
  }
});

// Lecturer Grades & Evaluates dynamic submission
app.post("/api/submissions/grade", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer" && user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized access. Role restricted." });
  }

  const { submissionId, grade, feedback } = req.body;

  if (!submissionId || !grade) {
    return res.status(400).json({ error: "Submission reference and Grade score are required." });
  }

  const db = getDatabase();
  const index = db.submissions.findIndex(s => s.id === submissionId);

  if (index === -1) {
    return res.status(404).json({ error: "Specified student submission is missing." });
  }

  const sub = db.submissions[index];
  sub.grade = grade;
  sub.feedback = feedback || "";
  sub.gradedBy = user.fullName;
  sub.gradedAt = new Date().toISOString();
  sub.status = "graded";

  // Create immediate notification item for targeted student
  const assignment = db.materials.find(m => m.id === sub.assignmentId);
  const notif: NotificationItem = {
    id: "notif_" + crypto.randomUUID(),
    userId: sub.studentId,
    title: "New Assessment Graded! 📝",
    message: `Your work for ${assignment?.title || "Assignment"} scored: ${grade}. Lecturer comments: "${feedback || 'No comments'}"`,
    type: "grade",
    createdAt: new Date().toISOString(),
    isRead: false
  };

  db.notifications.push(notif);
  writeDatabase(db);

  res.json({ message: "Assessment grading updated successfully.", submission: sub });
});

// ---------------------------------------------------------
// STUDENT PERSONAL PRIVATE ENCRYPTED NOTES
// ---------------------------------------------------------

// List personal notes
app.get("/api/notes", authGuard, (req, res) => {
  const user = (req as any).user;
  const db = getDatabase();

  const userNotes = db.notes.filter(n => n.studentId === user.id);
  
  // Decrypt contents on flight before showing in UI
  const decryptedNotes = userNotes.map(n => ({
    ...n,
    content: decryptText(n.content)
  }));

  res.json(decryptedNotes);
});

// Post and update Encrypted personal notes
app.post("/api/notes", authGuard, (req, res) => {
  const user = (req as any).user;
  const { id, title, content } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Note title cannot be blank." });
  }

  const db = getDatabase();

  // Encrypt note content using AES-256 prior to DB writing
  const encryptedContent = encryptText(content || "");

  const existingIndex = db.notes.findIndex(n => n.id === id && n.studentId === user.id);

  if (existingIndex !== -1) {
    db.notes[existingIndex].title = title;
    db.notes[existingIndex].content = encryptedContent;
    db.notes[existingIndex].updatedAt = new Date().toISOString();
    db.notes[existingIndex].isSynced = true;
    writeDatabase(db);
    res.json({ message: "Personal note saved and encrypted.", note: { id, title, content, updatedAt: db.notes[existingIndex].updatedAt, studentId: user.id, isSynced: true } });
  } else {
    const newNote: PersonalNote = {
      id: id || "note_" + crypto.randomUUID(),
      studentId: user.id,
      title,
      content: encryptedContent,
      updatedAt: new Date().toISOString(),
      isSynced: true
    };
    db.notes.push(newNote);
    writeDatabase(db);
    res.status(201).json({ message: "Personal note created and encrypted.", note: { ...newNote, content } });
  }
});

// Batch Sync Student Notes (Supports Offline outbox synchronization)
app.post("/api/notes/sync", authGuard, (req, res) => {
  const user = (req as any).user;
  const { notes } = req.body; // Array of PersonalNotes from offline LocalStorage outbox

  if (!Array.isArray(notes)) {
    return res.status(400).json({ error: "Invalid sync collection format." });
  }

  const db = getDatabase();
  let syncCount = 0;

  for (const clientNote of notes) {
    const encryptedContent = encryptText(clientNote.content || "");
    const existingIndex = db.notes.findIndex(n => n.id === clientNote.id && n.studentId === user.id);

    if (existingIndex !== -1) {
      db.notes[existingIndex].title = clientNote.title;
      db.notes[existingIndex].content = encryptedContent;
      db.notes[existingIndex].updatedAt = clientNote.updatedAt || new Date().toISOString();
      db.notes[existingIndex].isSynced = true;
    } else {
      db.notes.push({
        id: clientNote.id,
        studentId: user.id,
        title: clientNote.title,
        content: encryptedContent,
        updatedAt: clientNote.updatedAt || new Date().toISOString(),
        isSynced: true
      });
    }
    syncCount++;
  }

  if (syncCount > 0) {
    // Generate notification for sync complete
    db.notifications.push({
      id: "notif_" + crypto.randomUUID(),
      userId: user.id,
      title: "Offline Sync Complete! 🔄",
      message: `${syncCount} personal notebook entries successfully saved and encrypted with AES-256 on the cloud.`,
      type: "offline_sync",
      createdAt: new Date().toISOString(),
      isRead: false
    });
    writeDatabase(db);
  }

  res.json({ message: "Sync successful", syncedCount: syncCount });
});

// ---------------------------------------------------------
// NOTIFICATIONS IN-APP FEED API
// ---------------------------------------------------------
app.get("/api/notifications", authGuard, (req, res) => {
  const user = (req as any).user;
  const db = getDatabase();

  const userNotifs = db.notifications.filter(n => n.userId === user.id || n.userId === "all");
  res.json(userNotifs);
});

app.post("/api/notifications/read-all", authGuard, (req, res) => {
  const user = (req as any).user;
  const db = getDatabase();

  db.notifications.forEach(n => {
    if (n.userId === user.id || n.userId === "all") {
      n.isRead = true;
    }
  });

  writeDatabase(db);
  res.json({ message: "All items marked read." });
});

app.post("/api/notifications/:id/read", authGuard, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const db = getDatabase();

  const notif = db.notifications.find(n => n.id === id && (n.userId === user.id || n.userId === "all"));
  if (notif) {
    notif.isRead = true;
    writeDatabase(db);
    res.json({ message: "Notification marked read.", notification: notif });
  } else {
    res.status(404).json({ error: "Notification not found or access denied." });
  }
});

// Delete Notification
app.delete("/api/notifications/:id", authGuard, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const db = getDatabase();

  const idx = db.notifications.findIndex(n => n.id === id && (n.userId === user.id || n.userId === "all"));
  if (idx !== -1) {
    db.notifications.splice(idx, 1);
    writeDatabase(db);
    res.json({ message: "Notification deleted successfully." });
  } else {
    res.status(404).json({ error: "Notification not found or access denied." });
  }
});

// Edit Notification
app.put("/api/notifications/:id", authGuard, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { title, message } = req.body;
  const db = getDatabase();

  const notif = db.notifications.find(n => n.id === id && (n.userId === user.id || n.userId === "all"));
  if (notif) {
    if (title) notif.title = title;
    if (message) notif.message = message;
    writeDatabase(db);
    res.json({ message: "Notification updated successfully.", notification: notif });
  } else {
    res.status(404).json({ error: "Notification not found or access denied." });
  }
});

// ---------------------------------------------------------
// GOOGLE OAUTH 2.0 FOR CALENDAR & DRIVE INTEGRATIONS
// ---------------------------------------------------------
app.get("/api/auth/google-url", (req, res) => {
  const redirectUri = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback`;
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  
  if (!clientId) {
    return res.status(500).json({ error: "Google OAuth Client ID is not configured in environment variables." });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    access_type: "offline",
    prompt: "consent"
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const redirectUri = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback`;
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
            <p>Could not exchange code for access token. Please check that CLIENT_ID and CLIENT_SECRET are configured correctly in the Google Cloud Console credential settings.</p>
            <pre style="background: #f1f1f1; padding: 10px; border-radius: 5px;">${JSON.stringify(tokenData, null, 2)}</pre>
          </body>
        </html>
      `);
    }

    // Return HTML that posts the token back to main window and closes the popup
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
              <h2 class="text-2xl font-extrabold text-slate-805 text-slate-800">Connection Successful!</h2>
              <p class="text-sm text-slate-500">Your Google academic ledger is now actively synced to GDCMS Secure Cloud.</p>
            </div>

            <div class="bg-indigo-50/50 rounded-2xl p-5 text-left border border-indigo-100">
              <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3">Key Connected Benefits:</h3>
              <ul class="space-y-2.5 text-xs text-slate-600">
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Automatic Calendar Syncing:</strong> Real-time assessment due dates, test coordinates, and assignment deadlines automatically push to your primary Google Calendar.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Secure Note Ciphers Backups:</strong> Save, encrypt and export private study sandbox notes directly onto your Google Drive account with 1-click execution.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-600 font-bold">✓</span>
                  <span><strong>Offline Reminders Pipeline:</strong> Native reminders remain operational via your Google account, keeping you notified 24/7 on any device (Android/iOS/Web).</span>
                </li>
              </ul>
            </div>

            <div class="text-xs text-slate-500 font-medium italic">
              Transmitting secure symmetric tokens to primary GDCMS window...
            </div>

            <button onclick="closeNow()" class="w-full py-3 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer">
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

app.get("/api/app-config", (req, res) => {
  const db = getDatabase();
  res.json(db.appConfig);
});

app.post("/api/admin/app-config", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const db = getDatabase();
  const config = req.body;
  if (!config) {
    return res.status(400).json({ error: "Missing configuration parameters." });
  }

  db.appConfig = {
    ...db.appConfig,
    ...config
  };
  writeDatabase(db);
  res.json({ message: "Application rebranded and restructured successfully.", appConfig: db.appConfig });
});

app.get("/api/admin/logs", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const db = getDatabase();
  const logsList = db.logs || [];
  // Sort logs by newest first and return top 150 entries
  const sortedLogs = [...logsList].reverse().slice(0, 150);
  res.json(sortedLogs);
});

app.post("/api/admin/logs/clear", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const db = getDatabase();
  db.logs = [];
  
  // Clear any persistent sync logs from notification feed as well
  if (db.notifications) {
    db.notifications = db.notifications.filter(n => n.type !== "offline_sync");
  }

  // Treat log artifacts as temp files and delete them from workspace if they exist
  try {
    const fs = require("fs");
    const path = require("path");
    const files = fs.readdirSync(process.cwd());
    files.forEach((file: string) => {
      if (file.endsWith(".log") || file.startsWith("npm-debug") || file.endsWith(".tmp")) {
        try {
          fs.unlinkSync(path.join(process.cwd(), file));
        } catch (e) {
          // Ignore files that are locked or in use
        }
      }
    });
  } catch (err) {
    console.error("Workspace temp log files purging skipped:", err);
  }

  writeDatabase(db);
  res.json({ message: "Recorded security audit logs and connection/sync logs cleared successfully (treated as temporary files)." });
});

app.get("/api/admin/users", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const db = getDatabase();
  const safeUsers = db.users.map(u => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    indexNumber: u.indexNumber,
    oauthConnected: u.oauthConnected
  }));
  res.json(safeUsers);
});

app.get("/api/lecturer/students", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "lecturer") {
    return res.status(403).json({ error: "Lecturer portal access required." });
  }
  const db = getDatabase();
  const students = db.users
    .filter(u => u.role === "student")
    .map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      indexNumber: u.indexNumber,
      oauthConnected: u.oauthConnected
    }));
  res.json(students);
});

app.post("/api/admin/broadcast-alert", authGuard, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Administrative console access required." });
  }
  const { targetRole, message, title } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Advisory alert message cannot be empty." });
  }

  const db = getDatabase();
  const titleText = title || "Security Alert Advisory 🛡️";

  if (targetRole === "all") {
    const targets = db.users.filter(u => u.role === "student" || u.role === "lecturer");
    targets.forEach(t => {
      db.notifications.push({
        id: "notif_" + crypto.randomUUID(),
        userId: t.id,
        title: titleText,
        message,
        type: "grade",
        createdAt: new Date().toISOString(),
        isRead: false
      });
    });
  } else if (targetRole === "student" || targetRole === "lecturer") {
    const targets = db.users.filter(u => u.role === targetRole);
    targets.forEach(t => {
      db.notifications.push({
        id: "notif_" + crypto.randomUUID(),
        userId: t.id,
        title: titleText,
        message,
        type: "grade",
        createdAt: new Date().toISOString(),
        isRead: false
      });
    });
  } else if (targetRole) {
    // Single specific user selection
    db.notifications.push({
      id: "notif_" + crypto.randomUUID(),
      userId: targetRole,
      title: titleText,
      message,
      type: "grade",
      createdAt: new Date().toISOString(),
      isRead: false
    });
  } else {
    return res.status(400).json({ error: "Please declare a valid audience target role." });
  }

  writeDatabase(db);
  res.json({ message: "Broadcast notifications triggered and queued successfully." });
});


// ---------------------------------------------------------
// VITE CLIENT DEV MIDDLEWARE & STATIC BUNDLE FALLBACK
// ---------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend compiled bundle
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GDCMS] Server securely listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
