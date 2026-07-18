import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

// Users Table
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  indexNumber: text("index_number"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'student' | 'lecturer' | 'admin'
  passwordHash: text("password_hash"),
  oauthConnected: boolean("oauth_connected").default(false),
  needsPasswordChange: boolean("needs_password_change").default(false),
  systemId: text("system_id"),
});

// Courses Table
export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  lecturerId: text("lecturer_id").notNull(),
  description: text("description").notNull(),
  outlineUrl: text("outline_url"),
  outlineName: text("outline_name"),
  systemId: text("system_id"),
});

// Core Materials / Assignments Prompts Table
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

// Student Coursework Submissions Table
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

// Secure Private Personal Notebook Table
export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(), // AES-256-CBC Encrypted ciphertext
  updatedAt: text("updated_at").notNull(),
  isSynced: boolean("is_synced").default(true),
  tag: text("tag"),
});

// In-App Push Feed Notifications Table
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'grade' | 'assignment' | 'material' | 'offline_sync'
  createdAt: text("created_at").notNull(),
  isRead: boolean("is_read").default(false),
});

// Admin System Auditing Auth Logs Table
export const logs = pgTable("logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  emailOrIndex: text("email_or_index").notNull(),
  status: text("status").notNull(), // 'success' | 'failed'
  reason: text("reason"),
  userAgent: text("user_agent"),
  ipPlaceholder: text("ip_placeholder"),
});

// Administrative Platform Config Branding Table
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(), // Usually constant like 'config'
  systemName: text("system_name").notNull(),
  systemShort: text("system_short").notNull(),
  assignmentsTerm: text("assignments_term").notNull(),
  materialsTerm: text("materials_term").notNull(),
  themeColor: text("theme_color").notNull(),
  fontSizePreset: text("font_size_preset").notNull(),
  sidebarStyle: text("sidebar_style").notNull(),
  indexValidation: text("index_validation"),
});
