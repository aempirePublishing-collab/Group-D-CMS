// GDCMS - Shared Types and Interfaces

export type UserRole = 'student' | 'lecturer' | 'admin';

export interface User {
  id: string;
  indexNumber?: string; // Standard unique ID for students
  fullName: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  oauthConnected?: boolean;
  needsPasswordChange?: boolean;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  lecturerId: string;
  description: string;
  outlineUrl?: string; // Encrypted outline file reference
  outlineName?: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: 'outline' | 'lecture_notes' | 'assignment_prompt';
  uploadedBy: string;
  uploadedAt: string;
  fileKey: string; // The physical filename in /uploads (contains encrypted AES-256 data)
  originalName: string;
  mimeType: string;
  fileSize: number;
  deadline?: string; // Optional deadline date string (e.g., YYYY-MM-DD)
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentIndex: string;
  studentName: string;
  fileKey: string; // Encrypted physical file in /uploads
  originalName: string;
  uploadedAt: string;
  grade?: string; // Letter grade or Score e.g. "A+", "85/100"
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  status: 'pending' | 'graded';
}

export interface PersonalNote {
  id: string;
  studentId: string;
  title: string;
  content: string; // Stored encrypted on backend, decrypted on fetch
  updatedAt: string;
  isSynced: boolean; // Tracking offline outbox
  tag?: string;
  keepColor?: string; // Google Keep custom sticky card background color
  isPinned?: boolean; // Keep pinned status
}

export interface NotificationItem {
  id: string;
  userId: string; // Target user or 'all'
  title: string;
  message: string;
  type: 'grade' | 'assignment' | 'material' | 'offline_sync';
  createdAt: string;
  isRead: boolean;
}

export interface DBState {
  users: User[];
  courses: Course[];
  materials: Material[];
  submissions: Submission[];
  notes: PersonalNote[];
  notifications: NotificationItem[];
  logs?: AuthLog[];
  appConfig?: AppBrandingConfig;
}

export interface AuthLog {
  id: string;
  timestamp: string;
  emailOrIndex: string;
  status: 'success' | 'failed';
  reason?: string;
  userAgent?: string;
  ipPlaceholder?: string;
}

export interface AppBrandingConfig {
  systemName: string;
  systemShort: string;
  assignmentsTerm: string;
  materialsTerm: string;
  themeColor: 'indigo' | 'emerald' | 'rose' | 'violet' | 'amber' | 'blue' | 'slate';
  fontSizePreset: 'compact' | 'standard' | 'large';
  sidebarStyle: 'dark-navy' | 'indigo-accent' | 'slate-minimal' | 'emerald-forest';
}
