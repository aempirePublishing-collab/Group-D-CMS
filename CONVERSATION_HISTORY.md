# GDCMS Evolution & Conversation History Ledger
## Project: Group D Class Management System

This document captures the complete evolutionary roadmap, architectural transformations, major bugs fixed, and updates executed for **Group D Class Management System (GDCMS)**. It is written as a robust technical reference for future updates, developer handovers, and subsequent enhancements.

---

## 1. Executive Summary & Core Goals
**GDCMS** is a highly secure, multi-role academic class and coursework management application. The system enables seamless, authenticated interaction between three defined user roles:
1. **Students**: Can access course outlines, lecture notes, submit assignments, manage a private studying sandbox with automated offline sync, view evaluation feedback, and receive real-time grade alerts.
2. **Lecturers**: Can manage course settings, publish materials/assignment prompts, securely download and decrypt student submissions, analyze score matrices, and broadcast specific announcements.
3. **Administrators**: Control application branding (system name, assignment terminology, typography sizing, color themes), inspect system logs for connection compliance, clear database tables, and reset credentials.

To elevate GDCMS from a prototype mock-up. We have successfully addressed four main milestones:
- Migration from Tailwind CSS to pure Vanilla CSS.
- Stabilizing runtime cryptography on data at rest.
- Overhauling database persistence via a Cloud SQL (PostgreSQL) container with Drizzle ORM.
- Deploying dynamically resolved callback mechanisms for Google Calendar and Drive integrations.

---

## 2. Conversation & Engineering Milestones

### Milestone 1: Tailwind CSS Deconfliction
*   **User Goal**: Remove the imported Tailwind CSS framework and utilize vanilla CSS instead, providing clean, native, and uninhibited support for bespoke styling overrides in future visual updates.
*   **Engineering Execution**:
    *   Removed `@tailwindcss/vite` plugin and unlinked Tailwind-specific imports.
    *   Purged Tailwind directives from the central stylesheet (`src/index.css`) while retaining clear layout variables, custom font family imports (Inter, JetBrains Mono), responsive flex grids, and hand-crafted card containers.
    *   Maintained full cross-device styling parity while giving future developers direct control over standard CSS styling.

### Milestone 2: Resolving Cryptographic Decryption Faults
*   **User Goal**: Resolve critical core errors in the application.
    ```
    TypeError: Invalid initialization vector
    ```
*   **Root Cause Analysis**:
    The application encrypts student files and personal notebooks at rest using state-of-the-art **AES-256-CBC**. However, the decryption pipeline was prone to crashes if it encountered plain-text values, partial/malformed data, or files matching invalid formats (such as database items left over from mock-up staging).
*   **Resolution Strategy**:
    *   Upgraded the cryptography module inside `server.ts` with robust validation guards.
    *   Created dynamic fallback decoders. If an initialization vector (IV) fails validation parameters (e.g., incorrect byte dimensions or hex characters), the stream handles the output gracefully, returning the original block instead of throwing a runtime error.
    *   Wrapped critical decryption callbacks within try-catch blocks to isolate and protect the continuous running thread of the server.

### Milestone 3: Overhauling Database Persistence (Cloud SQL Over Flat-Files)
*   **User Goal**: Replace simulated flat-file persistence (`src/db.json`) with a relational, production-ready Cloud SQL database in the `europe-west2` region. Implement automated on-boot database migrations, schemas, and type-safe query interfaces.
*   **Engineering Execution**:
    *   Provisioned a Cloud SQL PostgreSQL instance located in the `europe-west2` region.
    *   Constructed a complete, modular, type-safe database schema in `src/db/schema.ts` targeting GDCMS entities.
    *   Initiated connection pooling in `src/db/index.ts` strictly adhering to the mandated Pooled Object Method.
    *   Implemented an automated, on-boot **Seed Engine** in `server.ts`. This engine reads existing JSON data at startup, seamlessly imports pre-existing student profiles, materials, and settings into PostgreSQL if the database is empty, and enables zero-downtime transition.

### Milestone 4: Production-Ready Dynamic URL Handling
*   **User Goal**: Replace injected, demo-only static URLs with clean, real-time, production-ready environment detection to support Google Calendar and Drive OAuth integration.
*   **Engineering Execution**:
    *   Replaced hardcoded fallback hosts with real-time request host block detection (`req.protocol` + `req.get('host')`) inside `server.ts`.
    *   Enabled the application to automatically adapt redirect coordinates to match any development container, local testing frame, or live environment.
    *   Guaranteed robust user syncing and popup communication behavior across standard subdomains and frame hierarchies.

---

## 3. Relational Database Schema Model (Drizzle ORM)
The database structure is designed to be fully modular, ensuring strong referential integrity across academic entities:

```typescript
// Users Table (Supports standard SHA-256 local hash and Google OAuth sync validation)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  indexNumber: text("index_number"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'student' | 'lecturer' | 'admin'
  passwordHash: text("password_hash"),
  oauthConnected: boolean("oauth_connected").default(false),
  needsPasswordChange: boolean("needs_password_change").default(false),
});

// Courses Table (Academic modules directed by lecturers)
export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  lecturerId: text("lecturer_id").notNull(),
  description: text("description").notNull(),
  outlineUrl: text("outline_url"),
  outlineName: text("outline_name"),
});

// Materials Table (Active slides, outline documents, and assignment prompts)
export const materials = pgTable("materials", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'outline' | 'lecture_notes' | 'assignment_prompt'
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  fileKey: text("file_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  deadline: text("deadline"),
});

// Submissions Table (Collects student coursework uploads securely locked via AES-256-CBC)
export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull(),
  studentId: text("student_id").notNull(),
  studentIndex: text("student_index").notNull(),
  studentName: text("student_name").notNull(),
  fileKey: text("file_key").notNull(),
  originalName: text("original_name").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  grade: text("grade"),
  feedback: text("feedback"),
  gradedBy: text("graded_by"),
  gradedAt: text("graded_at"),
  status: text("status").notNull(), // 'pending' | 'graded'
});

// Notes Table (Encrypted student private study logs with tag groupings and synchronization state)
export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  updatedAt: text("updated_at").notNull(),
  isSynced: boolean("is_synced").default(true),
  tag: text("tag"),
});

// Notifications Table (Central messaging repository feeding active in-app alerts)
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'grade' | 'assignment' | 'material' | 'offline_sync'
  createdAt: text("created_at").notNull(),
  isRead: boolean("is_read").default(false),
});

// Logs Table (Provides audit ledger for administrative and system security oversight)
export const logs = pgTable("logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  emailOrIndex: text("email_or_index").notNull(),
  status: text("status").notNull(), // 'success' | 'failed'
  reason: text("reason"),
  userAgent: text("user_agent"),
  ipPlaceholder: text("ip_placeholder"),
});

// App Config Table (Persists custom system configurations such as name, theme, and styling)
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(),
  systemName: text("system_name").notNull(),
  systemShort: text("system_short").notNull(),
  assignmentsTerm: text("assignments_term").notNull(),
  materialsTerm: text("materials_term").notNull(),
  themeColor: text("theme_color").notNull(),
  fontSizePreset: text("font_size_preset").notNull(),
  sidebarStyle: text("sidebar_style").notNull(),
});
```

---

## 4. Run, Build, and Migration Guide

To ensure high-performance deployments, the application relies on lightweight compile commands and explicit module imports.

### Standard Build Sequence
```bash
# 1. Check for typescript compiling and static type constraints
npm run lint

# 2. Builds client-side assets via Vite AND compiling backend server using esbuild
npm run build

# 3. Starts compiling server output
npm start
```

### Applying Schema Modifications
All schema adjustments must be introduced within `src/db/schema.ts` followed by the database migration CLI:
```bash
# Automatically compiling and pushing schemas onto the active Cloud SQL database
npx drizzle-kit push
```

### Encryption Operations Checklist
To secure storage boundaries:
- **Files**: Encrypted binary assets are written in `/uploads` with the name pattern `gdcms_material_*.enc`. Raw byte streams are decorated with a custom 16-character initialization vector.
- **Notes**: Notes contents are encrypted into a unified hex string block containing `ivHex:cipherHex`. This design ensures standard SQL text fields can read and write ciphertexts seamlessly.

---

## 5. Security Principles & Compliance Boundaries
1. **Never Expose Direct DB Credentials**: The app utilizes Cloud Run environment integration. Sensitive keys (e.g., `SQL_ADMIN_PASSWORD`) must remain hidden from codebases and client-side builds.
2. **Access Control (Authorization Guard)**: API routes (excluding static file boundaries and authenticators) are strictly protected by `authGuard`. This middleware authenticates dynamic bearer tokens and validates user configurations before exposing database actions.
3. **Immutability of Audit Trails**: Authenticators actively write to the `logs` table. Only administrators can purge temporary directories and flush compliance histories from the system console.
