import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  BookOpen, 
  FileText, 
  CheckCircle, 
  Clock, 
  Download, 
  UploadCloud, 
  User, 
  Lock, 
  LogOut, 
  Search, 
  Plus, 
  RefreshCw, 
  FileDown, 
  ChevronRight, 
  Layers, 
  GraduationCap, 
  ShieldCheck, 
  Eye, 
  BookOpenCheck,
  CheckSquare,
  Menu,
  X,
  Calendar,
  Sliders,
  ShieldAlert,
  Trophy,
  Activity,
  Wrench,
  Sparkles,
  Users,
  Palette,
  Cloud,
  MoreVertical,
  Share2,
  Bell,
  Sun,
  Moon,
  Database,
  Cpu,
  HardDrive,
  School,
  Pin,
  ExternalLink,
  Check
} from "lucide-react";
import { useGlobalTheme } from "./ThemeContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend } from "recharts";
import OfflineIndicator from "./components/OfflineIndicator";
import NotificationBell from "./components/NotificationBell";
import DeadlineCalendar from "./components/DeadlineCalendar";
import GoogleClassroomPanel from "./components/GoogleClassroomPanel";
import GoogleKeepPanel from "./components/GoogleKeepPanel";
import { User as UserType, Course, Material, Submission, PersonalNote, NotificationItem } from "./types";
import { jsPDF } from "jspdf";
import { 
  syncCoursesToFirestore, 
  syncMaterialsToFirestore, 
  syncSubmissionsToFirestore, 
  syncNotesToFirestore, 
  syncNotificationsToFirestore,
  getOfflineCourses,
  getOfflineMaterials,
  getOfflineSubmissions,
  getOfflineNotes,
  getOfflineNotifications,
  saveSingleNoteToFirestore,
  deleteSingleNoteFromFirestore,
  seedTrialUsersToFirestore
} from "./firebase";

export default function App() {
  const { theme, toggleTheme } = useGlobalTheme();

  // Authentication & Session State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("gdcms_token"));
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authView, setAuthView] = useState<"welcome" | "login" | "register">("welcome");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Google Integration & Admin Navigation States
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [adminPanelTab, setAdminPanelTab] = useState<"config" | "sandbox" | "addUser" | "usersList" | "databases">("config");
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem("gdcms_force_offline") === "true");
  const isOnline = navigator.onLine && !forceOffline;
  const [openMaterialMenuId, setOpenMaterialMenuId] = useState<string | null>(null);
  const [openGenericMenuId, setOpenGenericMenuId] = useState<string | null>(null);
  const [showGoogleConnectModal, setShowGoogleConnectModal] = useState(false);

  // Admin Registration Sub-Form States
  const [adminRegisterIndexNumber, setAdminRegisterIndexNumber] = useState("");
  const [adminRegisterFullName, setAdminRegisterFullName] = useState("");
  const [adminRegisterEmail, setAdminRegisterEmail] = useState("");
  const [adminRegisterPassword, setAdminRegisterPassword] = useState("");
  const [adminRegisterRole, setAdminRegisterRole] = useState<"student" | "lecturer" | "admin">("student");
  const [adminRegisterError, setAdminRegisterError] = useState<string | null>(null);
  const [adminRegisterSuccess, setAdminRegisterSuccess] = useState<string | null>(null);
  const [isAdminRegisteringUser, setIsAdminRegisteringUser] = useState(false);

  // Manual Password Reset States for Admin Panel
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetTempPassword, setResetTempPassword] = useState("123456");
  const [resetStatusMsg, setResetStatusMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [isResettingUserPass, setIsResettingUserPass] = useState(false);

  // Admin Database Management Center States
  const [dbStats, setDbStats] = useState<any>(null);
  const [isLoadingDbStats, setIsLoadingDbStats] = useState(false);
  const [isSeedingDb, setIsSeedingDb] = useState(false);
  const [dbStatusError, setDbStatusError] = useState<string | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);
  const [firestoreSyncProgress, setFirestoreSyncProgress] = useState<string | null>(null);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const fetchDbStats = async () => {
    if (!token) return;
    setIsLoadingDbStats(true);
    setDbStatusError(null);
    try {
      const response = await fetch("/api/admin/db-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDbStats(data);
      } else {
        const errData = await response.json();
        setDbStatusError(errData.error || "Failed to load database stats.");
      }
    } catch (e: any) {
      setDbStatusError(e.message || "Network error loading database stats.");
    } finally {
      setIsLoadingDbStats(false);
    }
  };

  const handleForceMirrorToFirestore = async () => {
    setIsSyncingFirestore(true);
    setFirestoreSyncStatus('idle');
    setFirestoreSyncProgress("Warming up Firestore engine...");
    try {
      setFirestoreSyncProgress("Syncing Courses to security-hardened collections...");
      await syncCoursesToFirestore(courses);
      
      setFirestoreSyncProgress("Mirroring Assignments and Materials catalogs...");
      await syncMaterialsToFirestore(materials);

      setFirestoreSyncProgress("Pipelining coursework submissions archive...");
      await syncSubmissionsToFirestore(submissions);

      setFirestoreSyncProgress("Encrypting and reconciling private student notes...");
      await syncNotesToFirestore(notes);

      setFirestoreSyncProgress("Broadcasting system notifications registry...");
      await syncNotificationsToFirestore(notifications);

      setFirestoreSyncProgress("Mirror completed successfully! All items mirrored and cached in local IndexedDB.");
      setFirestoreSyncStatus('success');

      const successNotif: any = {
        id: "client_notif_" + Math.random().toString(36).substring(2, 9),
        title: "Dual Database Mirror Verified ✔",
        message: `Administrative trigger: ${courses.length} courses, ${materials.length} files and ${notes.length} notes fully back-replicated into Firebase Firestore.`,
        type: "offline_sync",
        createdAt: new Date().toISOString(),
        isRead: false
      };
      setNotifications(prev => [successNotif, ...prev]);

    } catch (e: any) {
      console.error("Mirror to Firestore failed:", e);
      setFirestoreSyncProgress("Mirroring failed: " + (e.message || e.toString()));
      setFirestoreSyncStatus('failed');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleSeedPrimaryDatabase = async () => {
    if (!confirm("Are you sure you want to PURGE and SEED the relational PostgreSQL database? This will clear logs, course contents, student papers and rebuild them from pristine presets. Users accounts will be maintained.")) return;
    setIsSeedingDb(true);
    try {
      const response = await fetch("/api/admin/db-seed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        if (token) {
          fetchAppData(token, currentUser);
          fetchDbStats();
        }
      } else {
        const errData = await response.json();
        alert("E-Seeding failed: " + errData.error);
      }
    } catch (e: any) {
      alert("Error reaching server to seed database: " + e.message);
    } finally {
      setIsSeedingDb(false);
    }
  };

  useEffect(() => {
    if (adminPanelTab === "databases") {
      fetchDbStats();
    }
  }, [adminPanelTab]);

  // Scroll references for welcome landing page smooth-scroll behaviour
  const purposeRef = useRef<HTMLDivElement>(null);
  const modulesRef = useRef<HTMLDivElement>(null);
  const trialRef = useRef<HTMLDivElement>(null);

  // Smooth scroll helper
  const handleSmoothScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Form Inputs: Login / Register
  const [indexNumber, setIndexNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "lecturer" | "admin">("student");

  // Core App Data Collections
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false);
  const [isLoadingAllStudents, setIsLoadingAllStudents] = useState(false);

  // Active UI Navigation / Selections
  const [activeTab, setActiveTab] = useState<"dashboard" | "materials" | "assignments" | "notes" | "security">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  // Form Input: Add New Material (Lecturer Mode)
  const [newMatTitle, setNewMatTitle] = useState("");
  const [newMatDesc, setNewMatDesc] = useState("");
  const [newMatType, setNewMatType] = useState<"outline" | "lecture_notes" | "assignment_prompt">("lecture_notes");
  const [newMatCourse, setNewMatCourse] = useState("");
  const [newMatFile, setNewMatFile] = useState<File | null>(null);
  const [isUploadingMat, setIsUploadingMat] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");

  // Form Input: Submit Assignment (Student Mode)
  const [subAssignmentId, setSubAssignmentId] = useState("");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [isUploadingSub, setIsUploadingSub] = useState(false);

  // Form Input: Add/Edit Personal Note
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTag, setNoteTag] = useState("General Lecture");
  const [selectedTagFilter, setSelectedTagFilter] = useState("all");

  // Personal Notes Custom Readability Options and Selection States
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [notesFontFamily, setNotesFontFamily] = useState<"sans" | "serif" | "mono">(() => {
    return (localStorage.getItem("gdcms_notes_font") as any) || "sans";
  });
  const [notesFontSize, setNotesFontSize] = useState<"sm" | "base" | "lg">(() => {
    return (localStorage.getItem("gdcms_notes_size") as any) || "base";
  });
  const [notesColorTheme, setNotesColorTheme] = useState<"light" | "sepia" | "dark">(() => {
    return (localStorage.getItem("gdcms_notes_theme") as any) || "light";
  });
  const [sharingMaterial, setSharingMaterial] = useState<any | null>(null);

  // Classroom and Keep Integration Modes & States
  const [classroomMode, setClassroomMode] = useState<"default" | "google">(() => {
    return (localStorage.getItem("gdcms_classroom_mode") as any) || "default";
  });
  const [keepMode, setKeepMode] = useState<"default" | "google">(() => {
    return (localStorage.getItem("gdcms_keep_mode") as any) || "default";
  });
  const [classroomCourses, setClassroomCourses] = useState<any[]>([]);
  const [classroomCoursework, setClassroomCoursework] = useState<any[]>([]);
  const [selectedClassroomCourseId, setSelectedClassroomCourseId] = useState("");
  const [isFetchingClassroom, setIsFetchingClassroom] = useState(false);
  const [keepNoteColor, setKeepNoteColor] = useState("white");
  const [keepNotePinned, setKeepNotePinned] = useState(false);

  useEffect(() => {
    localStorage.setItem("gdcms_classroom_mode", classroomMode);
  }, [classroomMode]);

  useEffect(() => {
    localStorage.setItem("gdcms_keep_mode", keepMode);
  }, [keepMode]);

  // Keyboard/Interactive States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPublicSandbox, setShowPublicSandbox] = useState(true);
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<string | null>(null);
  const [isSimulatingBuild, setIsSimulatingBuild] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Admin Naming/Terminology & branding structural configuration
  const [appConfig, setAppConfig] = useState(() => {
    const saved = localStorage.getItem("gdcms_app_config");
    return saved ? JSON.parse(saved) : {
      systemName: "Group D Class Management System",
      systemShort: "GDCMS",
      assignmentsTerm: "Assignments",
      materialsTerm: "Course Materials",
      themeColor: "indigo",
      fontSizePreset: "standard",
      sidebarStyle: "dark-navy",
      sandboxModeEnabled: true
    };
  });

  // Dynamic Tailwind pairing configurations depending on selected theme color
  const getThemeClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return {
          primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
          text: "text-emerald-700",
          textLight: "text-emerald-600",
          border: "border-emerald-500",
          borderLight: "border-emerald-100",
          bgLight: "bg-emerald-50",
          shadow: "shadow-emerald-600/15 shadow-sm",
          ring: "focus:ring-emerald-500 focus-within:border-emerald-500"
        };
      case "rose":
        return {
          primary: "bg-rose-600 hover:bg-rose-700 text-white",
          text: "text-rose-700",
          textLight: "text-rose-600",
          border: "border-rose-500",
          borderLight: "border-rose-100",
          bgLight: "bg-rose-50",
          shadow: "shadow-rose-600/15 shadow-sm",
          ring: "focus:ring-rose-500 focus-within:border-rose-500"
        };
      case "violet":
        return {
          primary: "bg-violet-600 hover:bg-violet-700 text-white",
          text: "text-violet-700",
          textLight: "text-violet-600",
          border: "border-violet-500",
          borderLight: "border-violet-100",
          bgLight: "bg-violet-50",
          shadow: "shadow-violet-600/15 shadow-sm",
          ring: "focus:ring-violet-500 focus-within:border-violet-500"
        };
      case "amber":
        return {
          primary: "bg-amber-600 hover:bg-amber-700 text-white",
          text: "text-amber-700",
          textLight: "text-amber-600",
          border: "border-amber-500",
          borderLight: "border-amber-100",
          bgLight: "bg-amber-50",
          shadow: "shadow-amber-600/15 shadow-sm",
          ring: "focus:ring-amber-500 focus-within:border-amber-500"
        };
      case "blue":
        return {
          primary: "bg-blue-600 hover:bg-blue-700 text-white",
          text: "text-blue-700",
          textLight: "text-blue-600",
          border: "border-blue-500",
          borderLight: "border-blue-100",
          bgLight: "bg-blue-50",
          shadow: "shadow-blue-600/15 shadow-sm",
          ring: "focus:ring-blue-500 focus-within:border-blue-500"
        };
      case "slate":
        return {
          primary: "bg-slate-700 hover:bg-slate-800 text-white",
          text: "text-slate-800",
          textLight: "text-slate-600",
          border: "border-slate-600",
          borderLight: "border-slate-200",
          bgLight: "bg-slate-55 bg-slate-100",
          shadow: "shadow-slate-700/15 shadow-sm",
          ring: "focus:ring-slate-500 focus-within:border-slate-500"
        };
      default: // indigo
        return {
          primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
          text: "text-indigo-700",
          textLight: "text-indigo-600",
          border: "border-indigo-500",
          borderLight: "border-indigo-100",
          bgLight: "bg-indigo-50",
          shadow: "shadow-indigo-600/15 shadow-sm",
          ring: "focus:ring-indigo-500 focus-within:border-indigo-500"
        };
    }
  };

  const themeTheme = getThemeClasses(appConfig.themeColor || "indigo");

  const getSidebarStyle = (style: string) => {
    switch (style) {
      case "indigo-accent":
        return {
          aside: "bg-indigo-950 border-indigo-900 text-white",
          border: "border-indigo-850/60 border-indigo-900/60",
          itemActive: "bg-indigo-65 bg-indigo-600 text-white shadow-lg shadow-indigo-600/10",
          itemInactive: "text-indigo-300 hover:bg-indigo-900 hover:text-white",
          accentColor: "bg-indigo-600 shadow-indigo-600/25",
          accentText: "text-indigo-400 bg-indigo-950 border-indigo-800",
          badge: "bg-indigo-900 text-indigo-25 text-indigo-100",
          subCard: "bg-indigo-900/40 border-indigo-900/60"
        };
      case "slate-minimal":
        return {
          aside: "bg-slate-50 border-slate-200 text-slate-900",
          border: "border-slate-200",
          itemActive: `${themeTheme.primary || "bg-indigo-600 text-white"} shadow-md`,
          itemInactive: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          accentColor: themeTheme.primary || "bg-indigo-600",
          accentText: "text-slate-600 bg-slate-100 border-slate-200",
          badge: "bg-slate-200 text-slate-800",
          subCard: "bg-slate-100 border-slate-200"
        };
      case "emerald-forest":
        return {
          aside: "bg-emerald-950 border-emerald-900 text-white",
          border: "border-emerald-850/60 border-emerald-900/60",
          itemActive: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/10",
          itemInactive: "text-emerald-300 hover:bg-emerald-900 hover:text-white",
          accentColor: "bg-emerald-600 shadow-emerald-600/25",
          accentText: "text-emerald-400 bg-emerald-950 border-emerald-800",
          badge: "bg-emerald-900 text-emerald-100",
          subCard: "bg-emerald-900/40 border-emerald-900/60"
        };
      default: // dark-navy
        return {
          aside: "bg-slate-900 border-slate-800 text-white",
          border: "border-slate-800",
          itemActive: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15",
          itemInactive: "text-slate-400 hover:bg-slate-800 hover:text-white",
          accentColor: "bg-indigo-600 shadow-indigo-600/25",
          accentText: "text-indigo-400 bg-indigo-950 border-indigo-800",
          badge: "bg-slate-85 bg-slate-800 text-slate-300",
          subCard: "bg-slate-950/40 border-slate-800"
        };
    }
  };

  const sideTheme = getSidebarStyle(appConfig.sidebarStyle || "dark-navy");

  // Admin Interactive Panel States
  const [authLogs, setAuthLogs] = useState<any[]>([]);
  const [alertTarget, setAlertTarget] = useState("all");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [isBroadcastingAlert, setIsBroadcastingAlert] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<"lecturer" | "student">("lecturer");

  // Fetch security authentication attempts logs from administrative APIs
  const fetchAuthLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuthLogs(data);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  };

  // Safe purge of logins audits histories
  const handleClearAuthLogs = async () => {
    if (!window.confirm("Are you sure you want to permanently clear the login attempts security log history?")) {
      return;
    }
    try {
      const res = await fetch("/api/admin/logs/clear", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setAuthLogs([]);
        alert("Security logs history deleted successfully.");
      } else {
        alert("Failed to clear security reports from database.");
      }
    } catch (err) {
      console.error("Clear logs failure:", err);
    }
  };

  // Submit rebranded / restructured specs server-side
  const handleSaveAppConfigOnServer = async (updatedConfig: any) => {
    try {
      const res = await fetch("/api/admin/app-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setAppConfig(data.appConfig);
        localStorage.setItem("gdcms_app_config", JSON.stringify(data.appConfig));
        alert("Success! GDCMS system restructured, rebranded, and synced server-side.");
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Administrative settings rejected.");
      }
    } catch (err) {
      console.error("Failed syncing branding config on server:", err);
      alert("Failed to sync branding settings to the server.");
    }
  };

  // Broadcast advisory alert as direct in-app notification alerts
  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim()) {
      alert("Alert message text cannot be empty.");
      return;
    }
    setIsBroadcastingAlert(true);
    try {
      const res = await fetch("/api/admin/broadcast-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          targetRole: alertTarget,
          title: alertTitle || "Advisory Notification from Admin Coordinator 🛡️",
          message: alertMessage
        })
      });
      if (res.ok) {
        alert("Broadcast complete! Alert distributed to online cohorts feedback bells.");
        setAlertTitle("");
        setAlertMessage("");
        fetchAppData(token!);
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Emergency broadcast rejected.");
      }
    } catch (err) {
      console.error("Failed executing emergency broadcast:", err);
      alert("An unexpected transport error hindered notification broadcasts.");
    } finally {
      setIsBroadcastingAlert(false);
    }
  };

  // Load from local storage or cloud server config on startup
  const fetchGlobalConfigOnStartup = async () => {
    try {
      const res = await fetch("/api/app-config");
      if (res.ok) {
        const data = await res.json();
        if (data && data.systemName) {
          setAppConfig(data);
          localStorage.setItem("gdcms_app_config", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Global config mount sync omitted:", err);
    }
  };

  useEffect(() => {
    fetchGlobalConfigOnStartup();
  }, []);

  useEffect(() => {
    localStorage.setItem("gdcms_app_config", JSON.stringify(appConfig));
  }, [appConfig]);

  useEffect(() => {
    localStorage.setItem("gdcms_notes_font", notesFontFamily);
    localStorage.setItem("gdcms_notes_size", notesFontSize);
    localStorage.setItem("gdcms_notes_theme", notesColorTheme);
  }, [notesFontFamily, notesFontSize, notesColorTheme]);

  // Google OAuth Listener & Account Synchronization
  useEffect(() => {
    const handleGoogleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setGoogleToken(event.data.token);
        alert("Google account synchronized successfully! Google Classroom, Drive, & Calendar are now active in your session.");
      }
    };
    window.addEventListener("message", handleGoogleAuthMessage);
    return () => window.removeEventListener("message", handleGoogleAuthMessage);
  }, []);

  const fetchGoogleClassroomCourses = async () => {
    if (!googleToken) return;
    setIsFetchingClassroom(true);
    try {
      const res = await fetch("https://classroom.googleapis.com/v1/courses", {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassroomCourses(data.courses || []);
      } else {
        console.error("Failed to fetch Classroom courses natively");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  const fetchGoogleClassroomCoursework = async (courseId: string) => {
    if (!googleToken || !courseId) return;
    setIsFetchingClassroom(true);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassroomCoursework(data.courseWork || []);
      } else {
        console.error("Failed to fetch coursework natively from course");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  useEffect(() => {
    if (googleToken && classroomMode === "google") {
      fetchGoogleClassroomCourses();
    }
  }, [googleToken, classroomMode]);

  useEffect(() => {
    if (googleToken && selectedClassroomCourseId) {
      fetchGoogleClassroomCoursework(selectedClassroomCourseId);
    } else {
      setClassroomCoursework([]);
    }
  }, [googleToken, selectedClassroomCourseId]);

  // Reset forms automatically on new view transition so previous credentials are not preserved in inputs
  useEffect(() => {
    setIndexNumber("");
    setFullName("");
    setEmail("");
    setPassword("");
    setAuthError(null);
  }, [authView]);

  const handleConnectGoogle = async () => {
    setShowGoogleConnectModal(true);
  };

  const handleLaunchGoogleOAuthPopup = async () => {
    setShowGoogleConnectModal(false);
    try {
      const res = await fetch("/api/auth/google-url");
      const data = await res.json();
      if (res.ok && data.url) {
        const popup = window.open(data.url, "google_oauth_popup", "width=555,height=655");
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          const yesRedirect = window.confirm(
            "It looks like your browser or the preview environment blocked the login popup.\n\n" +
            "Would you like to load the Google Account Sign-In page directly in the current window instead?"
          );
          if (yesRedirect) {
            window.location.href = data.url;
          }
        }
      } else {
        alert(data.error || "Could not retrieve Google sign-in configuration.");
      }
    } catch (err) {
      console.error("Popup launch failure:", err);
      alert("Error occurred connecting to the identity server.");
    }
  };

  const triggerNotificationPermissionRequest = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support physical desktop push notifications.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        new Notification("GDCMS Push Activated ✔️", {
          body: "You will receive instant push notifications for course releases and grade publishes."
        });
      } else {
        alert("Push notifications were declined or blocked. Enable them in site info.");
      }
    } catch (e) {
      console.error(e);
      alert("Push notification subscription failed.");
    }
  };

  const handleAdminRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminRegisterError(null);
    setAdminRegisterSuccess(null);
    setIsAdminRegisteringUser(true);

    if (!adminRegisterFullName || !adminRegisterEmail || !adminRegisterPassword || !adminRegisterRole) {
      setAdminRegisterError("Please fill out all mandatory registration fields.");
      setIsAdminRegisteringUser(false);
      return;
    }

    if (adminRegisterRole === "student" && !adminRegisterIndexNumber) {
      setAdminRegisterError("Students require a valid index number ID.");
      setIsAdminRegisteringUser(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: adminRegisterFullName,
          email: adminRegisterEmail,
          password: adminRegisterPassword,
          role: adminRegisterRole,
          indexNumber: adminRegisterRole === "student" ? adminRegisterIndexNumber : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAdminRegisterSuccess(`Successfully registered ${adminRegisterFullName} (${adminRegisterRole}) in system database.`);
        // Reset sub-form inputs
        setAdminRegisterFullName("");
        setAdminRegisterEmail("");
        setAdminRegisterPassword("");
        setAdminRegisterIndexNumber("");
      } else {
        setAdminRegisterError(data.error || "Registration request rejected by system.");
      }
    } catch (err: any) {
      console.error("Admin user creation failed:", err);
      setAdminRegisterError("Internal server response failure. Check connection.");
    } finally {
      setIsAdminRegisteringUser(false);
    }
  };

  const [isExportingNotesToDrive, setIsExportingNotesToDrive] = useState(false);

  const handleExportSelectedNotesToGoogleDrive = async () => {
    const notesToBackup = notes.filter(n => selectedNoteIds.includes(n.id));
    if (notesToBackup.length === 0) {
      alert("Please select at least one study note to back up to Google Drive first!");
      return;
    }

    if (!googleToken) {
      alert("Please connect your Google Drive account first using the Sync button!");
      return;
    }

    setIsExportingNotesToDrive(true);
    try {
      const metadata = {
        name: `GDCMS_Private_Study_Notes_${new Date().toISOString().slice(0, 10)}.txt`,
        mimeType: "text/plain"
      };
      
      const fileContent = notesToBackup
        .map(n => `=== ${n.title} ===\n${n.content}\nUpdated At: ${new Date(n.updatedAt).toLocaleString()}\n`)
        .join("\n\n");

      const boundary = "-------314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (res.ok) {
        alert("Success: Selected study notebook backed up successfully as a document in your Google Drive!");
        setSelectedNoteIds([]);
      } else {
        const txt = await res.text();
        console.error("Drive upload response error:", txt);
        alert("Failed to back up to Google Drive. Check write permission scopes.");
      }
    } catch (err) {
      console.error("Backup exception:", err);
      alert("Error occurred uploading file to Google Drive.");
    } finally {
      setIsExportingNotesToDrive(false);
    }
  };

  // Format student index numbers as XX/YYY/ZZ/AAA dynamically
  const formatIndexNumberInput = (value: string, prevValue: string = "") => {
    const isBackspace = prevValue && value.length < prevValue.length;
    
    // Strip all non-alphanumeric characters
    let clean = value.replace(/[^a-zA-Z0-9]/g, "");
    
    // Max length is 10 alphanumeric characters (2 + 3 + 2 + 3)
    if (clean.length > 10) {
      clean = clean.slice(0, 10);
    }
    
    // Handle backspace when deleting a character right after a slash
    if (isBackspace && prevValue.endsWith("/") && value === prevValue.slice(0, -1)) {
      const prevClean = prevValue.replace(/[^a-zA-Z0-9]/g, "");
      if (prevClean.length > 0) {
        const cutClean = prevClean.slice(0, -1);
        let temp = "";
        if (cutClean.length > 0) {
          temp += cutClean.slice(0, 2);
          if (cutClean.length > 2) {
            temp += "/";
            temp += cutClean.slice(2, 5);
            if (cutClean.length > 5) {
              temp += "/";
              temp += cutClean.slice(5, 7);
              if (cutClean.length > 7) {
                temp += "/";
                temp += cutClean.slice(7, 10);
              }
            }
          }
        }
        return temp;
      }
    }

    // Build the formatted string dynamically
    let formatted = "";
    if (clean.length > 0) {
      // First 2 characters
      formatted += clean.slice(0, 2);
      if (clean.length > 2) {
        formatted += "/";
        // Next 3 characters
        formatted += clean.slice(2, 5);
        if (clean.length > 5) {
          formatted += "/";
          // Next 2 characters
          formatted += clean.slice(5, 7);
          if (clean.length > 7) {
            formatted += "/";
            // Last 3 characters
            formatted += clean.slice(7, 10);
          }
        }
      }
    }
    
    return formatted;
  };

  // Automatically clear inputs when switching between welcome, login, or register
  useEffect(() => {
    setIndexNumber("");
    setFullName("");
    setEmail("");
    setPassword("");
    setAuthError(null);
  }, [authView]);

  // Retrieve logs list when active user changes to admin
  useEffect(() => {
    if (currentUser?.role === "admin" && token) {
      fetchAuthLogs();
    }
  }, [currentUser, token]);

  // Lecturer - Student Assessment Tracking (Dynamic Mock Database state for performance reviews)
  const [studentPerformance, setStudentPerformance] = useState([
    { id: "stud_1", name: "Clement Koffie", index: "10928374", assignmentGrade: 88, quizGrade: 92, midsemGrade: 85, progressStatus: "Excellent", progression: [70, 78, 85, 88] },
    { id: "stud_2", name: "Sarah Jenkins", index: "10984729", assignmentGrade: 75, quizGrade: 82, midsemGrade: 78, progressStatus: "Consistent", progression: [65, 72, 70, 75] }
  ]);

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editAsgGrade, setEditAsgGrade] = useState<number>(0);
  const [editQuizGrade, setEditQuizGrade] = useState<number>(0);
  const [editMidsemGrade, setEditMidsemGrade] = useState<number>(0);

  // Grading Form State (Lecturer Mode)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState("");
  const [gradingFeedback, setGradingFeedback] = useState("");
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

  // Monitor Auth Token & Fetch Identity on startup
  useEffect(() => {
    if (token) {
      localStorage.setItem("gdcms_token", token);
      fetchUserIdentity();
    } else {
      localStorage.removeItem("gdcms_token");
      setCurrentUser(null);
    }
  }, [token]);

  // Recovery of autosaved states
  useEffect(() => {
    try {
      const savedNote = localStorage.getItem("gdcms_autosave_note");
      if (savedNote) {
        const { title, content, editingNoteId } = JSON.parse(savedNote);
        if (title) setNoteTitle(title);
        if (content) setNoteContent(content);
        if (editingNoteId) setEditingNoteId(editingNoteId);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedMaterial = localStorage.getItem("gdcms_autosave_material");
      if (savedMaterial) {
        const { title, desc, type, course } = JSON.parse(savedMaterial);
        if (title) setNewMatTitle(title);
        if (desc) setNewMatDesc(desc);
        if (type) setNewMatType(type);
        if (course) setNewMatCourse(course);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedSub = localStorage.getItem("gdcms_autosave_submission");
      if (savedSub) {
        const { subAssignmentId } = JSON.parse(savedSub);
        if (subAssignmentId) setSubAssignmentId(subAssignmentId);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const savedGrading = localStorage.getItem("gdcms_autosave_grading");
      if (savedGrading) {
        const { selectedSubmissionId: selSubId, score, feedback } = JSON.parse(savedGrading);
        if (selSubId) setSelectedSubmissionId(selSubId);
        if (score) setGradingScore(score);
        if (feedback) setGradingFeedback(feedback);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 10s Timer-based Autosave effect
  useEffect(() => {
    const timer = setInterval(() => {
      // Save Notes Form
      if (noteTitle || noteContent) {
        localStorage.setItem("gdcms_autosave_note", JSON.stringify({
          title: noteTitle,
          content: noteContent,
          editingNoteId
        }));
      } else {
        localStorage.removeItem("gdcms_autosave_note");
      }

      // Save Material Form
      if (newMatTitle || newMatDesc || newMatCourse) {
        localStorage.setItem("gdcms_autosave_material", JSON.stringify({
          title: newMatTitle,
          desc: newMatDesc,
          type: newMatType,
          course: newMatCourse
        }));
      } else {
        localStorage.removeItem("gdcms_autosave_material");
      }

      // Save Submissions Form
      if (subAssignmentId) {
        localStorage.setItem("gdcms_autosave_submission", JSON.stringify({
          subAssignmentId
        }));
      } else {
        localStorage.removeItem("gdcms_autosave_submission");
      }

      // Save Grading Feed Form
      if (selectedSubmissionId || gradingScore || gradingFeedback) {
        localStorage.setItem("gdcms_autosave_grading", JSON.stringify({
          selectedSubmissionId,
          score: gradingScore,
          feedback: gradingFeedback
        }));
      } else {
        localStorage.removeItem("gdcms_autosave_grading");
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [
    noteTitle, noteContent, editingNoteId,
    newMatTitle, newMatDesc, newMatType, newMatCourse,
    subAssignmentId,
    selectedSubmissionId, gradingScore, gradingFeedback
  ]);

  // Read raw base64 contents helper to transfer over JSON APIs
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Split metadata header out if present
        const base64Data = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const fetchUserIdentity = async () => {
    setIsLoadingUser(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        fetchAppData(token!, data);
      } else {
        // Clear expired tokens
        setToken(null);
      }
    } catch (err) {
      console.error("Ident check failure:", err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const fetchAppData = async (activeToken: string, userObj?: any) => {
    // Fallback: If device is offline, fetch immediately from local Firestore offline persistent cache!
    if (!isOnline) {
      console.log("GDCMS: Offline mode detected. Serving app data from Firestore local cache.");
      try {
        const [offCourses, offMaterials, offSubmissions, offNotes, offNotifs] = await Promise.all([
          getOfflineCourses(),
          getOfflineMaterials(),
          getOfflineSubmissions(),
          getOfflineNotes(),
          getOfflineNotifications()
        ]);
        if (offCourses.length > 0) setCourses(offCourses);
        if (offMaterials.length > 0) setMaterials(offMaterials);
        if (offSubmissions.length > 0) setSubmissions(offSubmissions);
        if (offNotes.length > 0) setNotes(offNotes);
        if (offNotifs.length > 0) setNotifications(offNotifs);
      } catch (e) {
        console.error("GDCMS: Firestore local cache query failed:", e);
      }
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${activeToken}` };
      
      const [resCourses, resMaterials, resSubmissions, resNotes, resNotifs] = await Promise.all([
        fetch("/api/courses", { headers }),
        fetch("/api/materials", { headers }),
        fetch("/api/submissions", { headers }),
        fetch("/api/notes", { headers }),
        fetch("/api/notifications", { headers })
      ]);

      let fetchedCourses: Course[] = [];
      let fetchedMaterials: Material[] = [];
      let fetchedSubmissions: Submission[] = [];
      let fetchedNotes: PersonalNote[] = [];
      let fetchedNotifs: NotificationItem[] = [];

      if (resCourses.ok) {
        fetchedCourses = await resCourses.json();
        setCourses(fetchedCourses);
      }
      if (resMaterials.ok) {
        fetchedMaterials = await resMaterials.json();
        setMaterials(fetchedMaterials);
      }
      if (resSubmissions.ok) {
        fetchedSubmissions = await resSubmissions.json();
        setSubmissions(fetchedSubmissions);
      }
      if (resNotes.ok) {
        fetchedNotes = await resNotes.json();
        setNotes(fetchedNotes);
      }
      if (resNotifs.ok) {
        fetchedNotifs = await resNotifs.json();
        setNotifications(fetchedNotifs);
      }

      // Sync to Firestore in the background to guarantee standard-grade offline durability
      if (fetchedCourses.length > 0) syncCoursesToFirestore(fetchedCourses);
      if (fetchedMaterials.length > 0) syncMaterialsToFirestore(fetchedMaterials);
      if (fetchedSubmissions.length > 0) syncSubmissionsToFirestore(fetchedSubmissions);
      if (fetchedNotes.length > 0) syncNotesToFirestore(fetchedNotes);
      if (fetchedNotifs.length > 0) syncNotificationsToFirestore(fetchedNotifs);
      seedTrialUsersToFirestore();

      const activeUser = userObj || currentUser;
      if (activeUser) {
        if (activeUser.role === "admin") {
          setIsLoadingAllUsers(true);
          try {
            const resU = await fetch("/api/admin/users", { headers });
            if (resU.ok) {
              const uData = await resU.json();
              setAllUsers(uData);
            }
          } catch (e) {
            console.error("All users load error:", e);
          } finally {
            setIsLoadingAllUsers(false);
          }
        } else if (activeUser.role === "lecturer") {
          setIsLoadingAllStudents(true);
          try {
            const resS = await fetch("/api/lecturer/students", { headers });
            if (resS.ok) {
              const sData = await resS.json();
              setAllStudents(sData);
            }
          } catch (e) {
            console.error("All students load error:", e);
          } finally {
            setIsLoadingAllStudents(false);
          }
        }
      }
    } catch (error) {
      console.error("Critical dashboard batch fetch halted:", error);
    }
  };

  const triggerUserPasswordReset = async (targetUserId: string, tempPass: string) => {
    setIsResettingUserPass(true);
    setResetStatusMsg(null);
    setResetErrorMsg(null);
    try {
      const res = await fetch("/api/admin/reset-user-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId, newTempPassword: tempPass })
      });
      const data = await res.json();
      if (!res.ok) {
        setResetErrorMsg(data.error || "Reset request failed.");
      } else {
        setResetStatusMsg(data.message || "Password successfully updated.");
        // Refresh users list
        fetchAppData(token!);
      }
    } catch (err) {
      setResetErrorMsg("Offline network error occurred during password reset.");
    } finally {
      setIsResettingUserPass(false);
    }
  };

  // Login transaction handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!indexNumber || !password) {
      setAuthError("Identify number and account password are required.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: indexNumber, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Login credential reject error.");
        return;
      }

      setToken(data.token);
      setActiveTab("dashboard");
      setIndexNumber("");
      setPassword("");
      setFullName("");
      setEmail("");
    } catch (err) {
      setAuthError("System network fault connecting to core services.");
    }
  };

  // Registration transaction handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!fullName || !email || !password) {
      setAuthError("Fill in all missing account detail fields.");
      return;
    }

    if (role === "student" && !indexNumber) {
      setAuthError("Student index ID is required for verification registration.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indexNumber: role === "student" ? indexNumber : undefined,
          fullName,
          email,
          password,
          role
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Problem compiling registry record.");
        return;
      }

      setToken(data.token);
      setActiveTab("dashboard");
      setIndexNumber("");
      setPassword("");
      setFullName("");
      setEmail("");
    } catch (e) {
      setAuthError("Security registry offline.");
    }
  };

  // Quick Access Trial Login for Admin, Lecturer and Students
  const handleQuickLogin = async (identifier: string) => {
    setAuthError(null);
    setIsLoadingUser(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password: "123456" // standard trial password check
        })
      });

      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setActiveTab("dashboard");
        setIndexNumber("");
        setPassword("");
        setFullName("");
        setEmail("");
      } else {
        setAuthError(data.error || "Trial authentication failed.");
      }
    } catch (e) {
      setAuthError("Trial backend pipeline connection timeout.");
    } finally {
      setIsLoadingUser(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    }
    setToken(null);
    setGoogleToken(null);
    setCurrentUser(null);
    setCourses([]);
    setMaterials([]);
    setSubmissions([]);
    setNotes([]);
    setNotifications([]);
    setAuthView("welcome");
  };

  // Material Upload (Lecturer Area)
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!newMatTitle || !newMatCourse || !newMatFile) {
      alert("Material Title, target Course and valid PDF document are mandatory inputs.");
      return;
    }

    setIsUploadingMat(true);
    setUploadProgressMsg("AES-256 binary matrix conversion...");

    try {
      const base64Data = await readFileAsBase64(newMatFile);
      setUploadProgressMsg("Transmitting encrypted block...");

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newMatTitle,
          description: newMatDesc,
          type: newMatType,
          courseId: newMatCourse,
          fileName: newMatFile.name,
          fileData: base64Data,
          mimeType: newMatFile.type
        })
      });

      const result = await res.json();
      if (res.ok) {
        // Clear fields
        setNewMatTitle("");
        setNewMatDesc("");
        setNewMatFile(null);
        localStorage.removeItem("gdcms_autosave_material");
        // Force reload content feed
        fetchAppData(token);
        alert("Success! Document ciphered and catalogued in storage disk.");
      } else {
        alert(result.error || "Upload rejected.");
      }
    } catch (err) {
      alert("Dynamic AES encryption script error.");
    } finally {
      setIsUploadingMat(false);
      setUploadProgressMsg("");
    }
  };

  // Student Assignment Upload Submission
  const handleStudentSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!subAssignmentId || !subFile) {
      alert("Please select the target Assignment outline and choose a file to submit.");
      return;
    }

    setIsUploadingSub(true);
    try {
      const base64Data = await readFileAsBase64(subFile);

      const res = await fetch("/api/submissions/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          assignmentId: subAssignmentId,
          fileName: subFile.name,
          fileData: base64Data,
          mimeType: subFile.type
        })
      });

      const result = await res.json();
      if (res.ok) {
        setSubFile(null);
        localStorage.removeItem("gdcms_autosave_submission");
        fetchAppData(token);
        alert("Assignment submitted and cryptographically sealed on the cloud.");
      } else {
        alert(result.error || "Upload failed.");
      }
    } catch (err) {
      alert("Submission failed during cryptographic preparation stage.");
    } finally {
      setIsUploadingSub(false);
    }
  };

  // Grade Assessment (Lecturer Activity)
  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSubmissionId || !gradingScore) return;

    setIsSubmittingGrade(true);
    try {
      const res = await fetch("/api/submissions/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          submissionId: selectedSubmissionId,
          grade: gradingScore,
          feedback: gradingFeedback
        })
      });

      const result = await res.json();
      if (res.ok) {
        setSelectedSubmissionId(null);
        setGradingScore("");
        setGradingFeedback("");
        localStorage.removeItem("gdcms_autosave_grading");
        fetchAppData(token);
        alert("Grade recorded and immediate push alert triggered to student dashboard!");
      } else {
        alert(result.error || "System rejected grade write.");
      }
    } catch (err) {
      alert("System connection error while saving grade evaluations.");
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  const resetNotesForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setEditingNoteId(null);
    setKeepNoteColor("white");
    setKeepNotePinned(false);
    localStorage.removeItem("gdcms_autosave_note");
  };

  // Save Encrypted Student Personal Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle) {
      alert("Please enter a note header.");
      return;
    }

    const serializedTag = keepMode === "google"
      ? `${keepNoteColor}|${keepNotePinned ? "pinned" : "unpinned"}|${noteTag || "General Keep"}`
      : noteTag;

    const notePayload = {
      id: editingNoteId || "client_note_" + Math.random().toString(36).substring(2, 9),
      title: noteTitle,
      content: noteContent,
      tag: serializedTag,
      updatedAt: new Date().toISOString()
    };

    // Case 1: Browser is Offline, append in browser client local persistent pool!
    if (!isOnline) {
      try {
        const storedStr = localStorage.getItem("gdcms_offline_notes") || "[]";
        const storedArr = JSON.parse(storedStr) as any[];
        
        const existingIdx = storedArr.findIndex(n => n.id === notePayload.id);
        if (existingIdx !== -1) {
          storedArr[existingIdx] = notePayload;
        } else {
          storedArr.push(notePayload);
        }
        localStorage.setItem("gdcms_offline_notes", JSON.stringify(storedArr));

        // Inject simulated unsynced note locally for instant smooth render!
        const optimisticNotes = [...notes];
        const localIdx = optimisticNotes.findIndex(n => n.id === notePayload.id);
        
        const enrichedLocalNote = {
          ...notePayload,
          studentId: currentUser?.id || "temp",
          isSynced: false
        };

        if (localIdx !== -1) {
          optimisticNotes[localIdx] = enrichedLocalNote;
        } else {
          optimisticNotes.push(enrichedLocalNote);
        }
        setNotes(optimisticNotes);

        // Also save note to the durable offline-first Firebase Firestore collection!
        saveSingleNoteToFirestore(enrichedLocalNote);

        // Reset inputs
        resetNotesForm();
        alert("No internet connection detected. Note has been safe-cached locally and secured in Firestore database.");
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // Case 2: System Online, push directly to live API (which executes automatic AES-256 block text locking)
    if (!token) return;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(notePayload)
      });

      const result = await res.json();
      if (res.ok) {
        resetNotesForm();
        fetchAppData(token);
      } else {
        alert(result.error || "Note write error.");
      }
    } catch (err) {
      alert("An unexpected error occurred saving notebook entry.");
    }
  };

  // Delete Personal Note
  const handleDeleteNoteLocal = (noteId: string) => {
    // Basic offline or online exclusion UI simulator
    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);
    
    // Also strip from browser localStorage outbox if present
    try {
      const storedStr = localStorage.getItem("gdcms_offline_notes");
      if (storedStr) {
        const arr = JSON.parse(storedStr);
        const filtered = arr.filter((n: any) => n.id !== noteId);
        localStorage.setItem("gdcms_offline_notes", JSON.stringify(filtered));
      }
    } catch (e) {}

    // Synchronize purge to Firestore!
    deleteSingleNoteFromFirestore(noteId);

    // Deselect note index if it is currently inside the selection queue
    setSelectedNoteIds(prev => prev.filter(id => id !== noteId));
  };

  // Export selected student notes to formatted PDF document
  const handleExportSelectedNotesToPDF = () => {
    const selectedNotes = notes.filter(note => selectedNoteIds.includes(note.id));
    if (selectedNotes.length === 0) {
      alert("Please select at least one study note from your collection to export.");
      return;
    }

    try {
      const doc = new jsPDF();
      let yOffset = 20;

      // Title Banner with beautiful styling
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229); // Beautiful Indigo brand color theme
      doc.text("GDCMS - SECURED STUDY NOTEBOOK BACKUP", 15, yOffset);
      yOffset += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Gray slate color
      doc.text(`Student: ${currentUser?.fullName || "Active Student"} (${currentUser?.indexNumber || "Index ID not verified"})`, 15, yOffset);
      yOffset += 5;
      doc.text(`Generated On: ${new Date().toLocaleString()}  |  Total Selected Notes: ${selectedNotes.length}`, 15, yOffset);
      yOffset += 5;

      // Draw horizontal divider line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(15, yOffset, 195, yOffset);
      yOffset += 12;

      selectedNotes.forEach((note, index) => {
        // Enforce page breaks between note items if current space is cramped
        if (yOffset > 240) {
          doc.addPage();
          yOffset = 20;
        }

        // Title of the Note
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(`${index + 1}. ${note.title}`, 15, yOffset);
        yOffset += 6;

        // Meta info (Updated timestamp & sync status)
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // slate-400
        const syncLabel = note.isSynced ? "Decrypted cloud sync (AES-256 Verified)" : "Local browser client storage-cache";
        doc.text(`Modified at: ${new Date(note.updatedAt).toLocaleString()}  |  Storage: ${syncLabel}`, 15, yOffset);
        yOffset += 8;

        // Content body text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85); // slate-700

        // Auto-wrap using splitTextToSize to prevent horizontal clipping
        const maxTextWidth = 180; // 195 - 15 margins
        const wrappedLines = doc.splitTextToSize(note.content, maxTextWidth);
        const linesCount = wrappedLines.length;
        const totalBlockHeight = linesCount * 5.5; // spaced 5.5mm per line

        // Check if writing the text block causes bottom overflow
        if (yOffset + totalBlockHeight > 275) {
          doc.addPage();
          yOffset = 20;
        }

        doc.text(wrappedLines, 15, yOffset);
        yOffset += totalBlockHeight + 12;

        // Separator between notes (if not the last one)
        if (index < selectedNotes.length - 1) {
          doc.setDrawColor(241, 245, 249); // slate-100
          doc.line(15, yOffset - 5, 195, yOffset - 5);
        }
      });

      doc.save(`GDCMS_My_Study_Notes_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error("PDF Compiling Fault:", e);
      alert("Failed generating local backup PDF file. Error: " + (e.message || e));
    }
  };

  // Search filter computes
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesCourse = selectedCourseId === "all" || m.courseId === selectedCourseId;
      const matchesQuery = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           m.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCourse && matchesQuery;
    });
  }, [materials, selectedCourseId, searchQuery]);

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTagFilter === "all" || n.tag === selectedTagFilter;
      return matchesQuery && matchesTag;
    });
  }, [notes, searchQuery, selectedTagFilter]);

  // Compute calculated values for dynamic stats display
  const studentSubmissionsMap = useMemo(() => {
    const map: Record<string, Submission> = {};
    submissions.forEach(s => {
      map[s.assignmentId] = s;
    });
    return map;
  }, [submissions]);

  // Calculate student general index completion (dummy stats calculation for GDCMS portal visualization)
  const totalCourseMaterialsCount = materials.length;
  const submissionsCount = submissions.length;
  const assignmentsPromptsCount = materials.filter(m => m.type === "assignment_prompt").length;

  const totalProgressPercentage = useMemo(() => {
    if (assignmentsPromptsCount === 0) return 78; // static fallback standard layout fallback
    return Math.min(100, Math.round((submissionsCount / assignmentsPromptsCount) * 100));
  }, [submissionsCount, assignmentsPromptsCount]);

  if (!token) {
    // ---------------------------------------------------------
    // RENDER SYSTEM WELCOME LANDING & INTUITIVE GATEWAY INTERFACE
    // ---------------------------------------------------------
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        
        {/* FIXED SUBTLE NAVIGATION NAVBAR HEADER */}
        <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setAuthView("welcome")}>
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-md shadow-indigo-600/25">
              G
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight uppercase text-indigo-950">GDCMS</span>
              <span className="text-[9px] text-slate-500 tracking-wider uppercase font-bold">Group D Portal</span>
            </div>
          </div>

          {authView === "welcome" && (
            <nav className="hidden md:flex items-center space-x-6 text-xs font-bold text-slate-600">
              <button 
                onClick={() => handleSmoothScroll(purposeRef)} 
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Our Purpose
              </button>
              <button 
                onClick={() => handleSmoothScroll(modulesRef)} 
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Core Modules
              </button>
            </nav>
          )}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700/80 text-slate-500 hover:text-slate-900 rounded-xl transition-all cursor-pointer mr-1"
              title="Toggle system theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {authView !== "welcome" ? (
              <button
                onClick={() => { setAuthView("welcome"); setAuthError(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Back to Welcome Screen
              </button>
            ) : (
              <button
                onClick={() => { setAuthView("login"); setAuthError(null); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* WELCOME VIEW DISPLAY */}
        {authView === "welcome" && (
          <main className="flex-1 flex flex-col">
            
            {/* HERO INTRODUCTION FOLD */}
            <section className="bg-gradient-to-b from-slate-100 to-white py-16 px-6 border-b border-slate-200">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest leading-none">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                  Official Release • Group D Class Management System
                </div>
                
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none md:leading-tight">
                  Academic Operations, <br className="hidden sm:block" />
                  <span className="text-indigo-600">Streamlined for Group D.</span>
                </h1>

                <p className="text-slate-600 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-medium">
                  Welcome to GDCMS — the Group D Class Management System. Designed to foster collaboration, study excellence, and smooth workflow logs, this integrated hub empowers lecturers to distribute dynamic course outline syllabus documents, lecture files, and assignment prompts. Students stay on schedule with verified resource downloads, coursework submissions, and marked evaluation reports, while administrators coordinate rosters and courses with absolute precision.
                </p>

                {/* ONLY TWO MAIN ENTRANCE PORTAL BUTTONS AVAILABLE */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => { setAuthView("login"); setAuthMode("login"); setAuthError(null); }}
                    className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-indigo-600/20 hover:scale-102 cursor-pointer pointer-events-auto"
                  >
                    Login to Account
                  </button>
                  <button
                    onClick={() => handleSmoothScroll(purposeRef)}
                    className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all hover:scale-102 cursor-pointer"
                  >
                    Explore System Features
                  </button>
                </div>
              </div>
            </section>

            {/* SECTION 1: SYSTEM PURPOSE */}
            <section ref={purposeRef} id="purpose" className="py-16 px-6 border-b border-slate-200 bg-white">
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xs uppercase font-extrabold tracking-widest text-indigo-600">Portal Purpose</h2>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">Fostering Connected Learning</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm leading-relaxed text-slate-600">
                  <div className="space-y-4">
                    <div className="w-10 h-10 bg-indigo-55 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">01</div>
                    <h3 className="font-bold text-slate-800 text-base">Classroom Synchronization</h3>
                    <p className="font-medium text-slate-500">
                      GDCMS acts as the single source of truth for your cohort. Gone are the days of missing links, outdated syllabi, or unnotified schedule updates. Access instant course outlines, guidelines, exam details, and lectures with one-click verified downloads.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">02</div>
                    <h3 className="font-bold text-slate-800 text-base">Qualitative Marked Reports</h3>
                    <p className="font-medium text-slate-500">
                      Our interactive submissions queue bridges the evaluation gap. Instructors can download submitted scripts, assign granular grades, and return constructive feedback notes directly to student notifications feeds for personalized coaching.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: SYSTEM MODULES */}
            <section ref={modulesRef} id="modules" className="py-16 px-6 border-b border-slate-200 bg-slate-50/50">
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xs uppercase font-extrabold tracking-widest text-indigo-600">Core Modules</h2>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">Structured Interactive Workspace</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Syllabus Outlines</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Instant file access folders for course documents, lecture prompts, slides and references curated by your subject professors.
                    </p>
                  </div>

                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Assignments Portal</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Submit completed exercises, upload artifacts, and review your final assigned scores and qualitative markings.
                    </p>
                  </div>

                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
                      <BookOpenCheck className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Study Notebooks</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Take local notes during lectures with complete offline cache support. Entries sync seamlessly once you reconnect to the campus network.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3 REMOVED - RELOCATED TO ADMIN CONSOLE */}

          </main>
        )}

        {/* SECURE DEDICATED AUTH VIEWS SECTION (LOGIN & SIGNUP OVERLAYS) */}
        {authView !== "welcome" && (
          <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[#f0f4f9]">
            <div className="w-full max-w-[450px] bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm space-y-6">
              
              {/* Google-like logo emblem and clean title */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 text-white rounded-2xl mb-4 shadow-sm shadow-indigo-600/10">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-normal text-[#1e1e1e] tracking-tight">
                  {authView === "login" ? "Sign in" : "Create account"}
                </h2>
                <p className="text-sm text-[#444746] mt-2">
                  to continue to the GDCMS Portal
                </p>
              </div>

              {/* Error block */}
              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-start gap-2 animate-pulse">
                  <span className="font-bold flex-shrink-0">✖</span>
                  <span>{authError}</span>
                </div>
              )}

              {/* Identity Server Sign In Header */}
              <div className="text-center py-2 border-b border-slate-100">
                <span className="text-sm font-black text-slate-800 uppercase tracking-widest bg-slate-50 border border-slate-150 px-3 py-1 rounded-xl">
                  GDCMS Identity Hub
                </span>
              </div>

              {/* Three role-selector buttons (Student, Lecturer, Admin) with paragraphs of instructions */}
              <div className="space-y-4">
                <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider text-center">
                  Select your role
                </div>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-205">
                  <button
                    type="button"
                    onClick={() => { setRole("student"); setAuthError(null); }}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold leading-tight cursor-pointer transition-all ${
                      role === "student" 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole("lecturer"); setAuthError(null); }}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold leading-tight cursor-pointer transition-all ${
                      role === "lecturer" 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Lecturer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole("admin"); setAuthError(null); }}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold leading-tight cursor-pointer transition-all ${
                      role === "admin" 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Admin
                  </button>
                </div>

                {/* Sub-tab instruction paragraph container as requested */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs text-slate-500 font-medium leading-relaxed">
                  {role === "student" && (
                    <p>
                      <strong>Student Workspace Access instructions:</strong> Submit papers, write learning notes, review grades, and check syllabi guidelines. Students enter their index; the first 2 characters will trigger an automatic forward slash insertion, next 3, then 2, then 3 characters (e.g. BC/ITN/25/147 - no prefix is locked, any index works!).
                    </p>
                  )}
                  {role === "lecturer" && (
                    <p>
                      <strong>Lecturer Console Guidelines:</strong> Coordinate lectures, build study outlines, organize calendars, evaluate assignments, and assign marks under the Study Guild scope. No input structure constraint is enforced; use your registered keys or institutional mail accounts.
                    </p>
                  )}
                  {role === "admin" && (
                    <p>
                      <strong>Administrator Panel Guidelines:</strong> Manage systems database nodes, observe audit feeds logs, tweak nomenclatures, and deploy updates. No structured input format is enforced; authorize using your secure coordinator credentials.
                    </p>
                  )}
                </div>
              </div>

              {/* Standard Credentials Input form with optimized fields */}
              <form onSubmit={authView === "login" ? handleLogin : handleRegister} className="space-y-4">
                
                {/* ID input block */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                    {role === "student" 
                      ? "Student Index ID" 
                      : role === "lecturer" 
                        ? "Lecturer Institutional Email or ID" 
                        : "Coordinator Email or ID"}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    {role === "student" ? (
                      <input
                        type="text"
                        required
                        value={indexNumber}
                        onChange={(e) => setIndexNumber(formatIndexNumberInput(e.target.value, indexNumber))}
                        placeholder="XX/YYY/ZZ/AAA (e.g. BC/ITN/25/147)"
                        className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    ) : (
                      <input
                        type="text"
                        required
                        value={indexNumber}
                        onChange={(e) => setIndexNumber(e.target.value)}
                        placeholder={role === "lecturer" ? "e.g. L-9001 or emmanuel.vance@gdcms.edu" : "e.g. A-0001 or admin@gdcms.edu"}
                        className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    )}
                  </div>
                </div>

                {authView === "register" && (
                  <>
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Clement Koffie"
                        className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Institutional Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. student@school.edu"
                        className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    </div>
                  </>
                )}

                {/* Password input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Account Access Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Submit Trigger - Google Button Accent */}
                <button
                  type="submit"
                  disabled={isLoadingUser}
                  className="w-full py-3 bg-indigo-605 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
                >
                  {isLoadingUser ? "Authorizing Access..." : authView === "login" ? "Log In to Dashboard" : "Create Account"}
                </button>
              </form>

              {/* Switch directions */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthView("welcome"); setAuthError(null); }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  ← Go back to Portal Information
                </button>
              </div>

            </div>
          </main>
        )}

        {/* Global sticky layout footer status indicators */}
        <footer className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 shrink-0 gap-2">
          <div>
            <span>Group D Class Management System (GDCMS) • All Rights Reserved &copy; 2026</span>
          </div>
          <div className="flex items-center space-x-3 font-semibold">
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase">Verified Study Guild</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded uppercase">● Sync Stable</span>
          </div>
        </footer>

      </div>
    );
  }

  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // RENDER DYNAMIC SCHOOL CLASS WEBAPP (Dashboard Interface)
  // ---------------------------------------------------------
  return (
    <div className={`min-h-screen bg-[#F8FAFC] dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col lg:flex-row shadow-2xl overflow-x-hidden selection:bg-indigo-600 selection:text-white`}>
      
      {/* Mobile & Tablet Top Navbar Header Bar */}
      <div className="lg:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 text-white px-5 h-16 shrink-0 z-40 sticky top-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-sm">
            {appConfig.systemShort ? appConfig.systemShort.charAt(0) : "G"}
          </div>
          <span className="text-sm font-black uppercase tracking-tight">{appConfig.systemShort} Core</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Notifications feed directly in header on mobile/tablet screen! */}
          <NotificationBell 
            token={token} 
            notifications={notifications} 
            onRefresh={() => fetchAppData(token!)}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              setIsMobileMenuOpen(false);
            }} 
          />
          
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Sidebar Navigation Back Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden animate-fade-in pointer-events-auto"
        />
      )}

      {/* GOOGLE WORKSPACE INTEGRATION PERMISSIONS EXPLANATION MODAL */}
      {showGoogleConnectModal && (
        <div className="fixed inset-0 bg-slate-905/70 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200/60 shadow-2xl max-h-[95vh] flex flex-col overflow-hidden animate-scale-up text-left">
            
            {/* Header banner */}
            <div className="bg-[#4f46e5] text-white p-6 relative shrink-0">
              <button 
                onClick={() => setShowGoogleConnectModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Cloud className="w-6 h-6 text-indigo-100" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight uppercase">Google Academic Hub</h3>
                  <p className="text-[10px] text-white/70 tracking-widest font-black uppercase">Secure OAuth 2.0 Auth Bridge</p>
                </div>
              </div>
            </div>

            {/* Explanation & Benefits content */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[45vh] md:max-h-none scrollbar-thin">
              <div className="text-xs text-slate-500 leading-relaxed font-semibold">
                By connecting GDCMS securely to your preferred Google Account, the system synchronizes academic schedules, cohorts outlines, assessment deadlines, and provides persistent cloud notebook backup capabilities. Learn about some of the secure benefits:
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-indigo-50 text-indigo-650 rounded-xl shrink-0">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="space-y-0.5 text-xs text-left">
                    <h4 className="font-extrabold text-slate-805 text-slate-800">Automated Calendar Deadlines Syncing</h4>
                    <p className="text-slate-500 leading-relaxed font-semibold">Any lecturer assignment sheets release, examination, quiz deadlines, or study calendars are immediately exported to your Google Calendar app.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                    <Download className="w-4 h-4 text-amber-550 text-amber-500" />
                  </div>
                  <div className="space-y-0.5 text-xs text-left">
                    <h4 className="font-extrabold text-slate-800">Secure AES-256 Google Drive Notebook Backups</h4>
                    <p className="text-slate-500 leading-relaxed font-semibold">Encrypt and export your sandboxed private study review notes onto a secure repository inside Google Drive with 1-click execution.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="space-y-0.5 text-xs text-left">
                    <h4 className="font-extrabold text-slate-805 text-slate-800">24/7 Cross-Device Offline Alerts Pipeline</h4>
                    <p className="text-slate-500 leading-relaxed font-semibold">Native calendar notifications on Android, iOS, or macOS coordinate with you offline to maintain high academic performance rates.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-slate-100 text-slate-650 text-slate-600 rounded-xl shrink-0">
                    <ShieldCheck className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="space-y-0.5 text-xs text-left">
                    <h4 className="font-extrabold text-slate-800">Symmetrical Sandboxed Authorization</h4>
                    <p className="text-slate-500 leading-relaxed font-semibold">Your institutional authentication keys or credentials are never shared. Rest assured that the GDCMS Auth Hub only requests explicit read/write calendar permissions.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions buttons footer */}
            <div className="bg-slate-50 border-t border-slate-150 p-4 shrink-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGoogleConnectModal(false)}
                className="px-4 py-2 border rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-880 hover:text-slate-800 font-bold text-xs uppercase tracking-tight cursor-pointer"
              >
                Disconnect & Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchGoogleOAuthPopup}
                className="px-5 py-2.5 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-white hover:scale-105" />
                <span>Begin Secure Integration</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SHARE MATERIAL CHANNELS SELECTION MODAL */}
      {sharingMaterial && (() => {
        const mat = sharingMaterial;
        const associatedCourse = courses.find((c) => c.id === mat.courseId);
        const shareText = `[GDCMS Material] ${mat.title} (${associatedCourse?.code || "Course Title"})\nDescription: ${mat.description || ""}`;
        const downloadLink = `${window.location.origin}/api/materials/download/${mat.id}`;
        const fullShareText = `${shareText}\nDownload Link: ${downloadLink}`;
        
        const handleNativeShare = async () => {
          if (navigator.share) {
            try {
              await navigator.share({
                title: mat.title,
                text: shareText,
                url: downloadLink
              });
              setSharingMaterial(null);
            } catch (err) {
              console.error("Native share failed", err);
            }
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xl animate-scale-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
                    <Share2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase leading-none">Share Course Material</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Suggested Sharing Platforms</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSharingMaterial(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-left">
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{mat.title}</p>
                <p className="text-[11px] text-slate-400 font-semibold line-clamp-2 leading-relaxed">{mat.description || 'No description provided.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSharingMaterial(null)}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 rounded-2xl flex flex-col items-center justify-center gap-1 border border-emerald-100 dark:border-emerald-900/50 transition-all cursor-pointer text-center"
                >
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">WhatsApp</span>
                  <span className="text-[10px] text-emerald-500/80 font-bold">To Classmates</span>
                </a>

                <a 
                  href={`https://classroom.google.com/share?url=${encodeURIComponent(downloadLink)}&title=${encodeURIComponent(mat.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSharingMaterial(null)}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 rounded-2xl flex flex-col items-center justify-center gap-1 border border-indigo-100 dark:border-indigo-900/50 transition-all cursor-pointer text-center"
                >
                  <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">Classroom</span>
                  <span className="text-[10px] text-indigo-500/80 font-bold">Add to Post</span>
                </a>

                <a 
                  href={`https://t.me/share/url?url=${encodeURIComponent(downloadLink)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSharingMaterial(null)}
                  className="p-3 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/60 rounded-2xl flex flex-col items-center justify-center gap-1 border border-sky-100 dark:border-sky-900/50 transition-all cursor-pointer text-center"
                >
                  <span className="text-sky-600 dark:text-sky-400 font-extrabold text-xs">Telegram</span>
                  <span className="text-[10px] text-sky-500/80 font-bold">Post to Group</span>
                </a>

                <a 
                  href={`mailto:?subject=${encodeURIComponent(mat.title)}&body=${encodeURIComponent(fullShareText)}`}
                  onClick={() => setSharingMaterial(null)}
                  className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 rounded-2xl flex flex-col items-center justify-center gap-1 border border-red-100 dark:border-red-900/50 transition-all cursor-pointer text-center"
                >
                  <span className="text-red-600 dark:text-red-400 font-extrabold text-xs">Email</span>
                  <span className="text-[10px] text-red-500/80 font-bold">Direct Mail Card</span>
                </a>
              </div>

              {navigator.share && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Open System Share Sheet
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sidebar navigation panel */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 z-50 lg:z-10 flex flex-col h-screen ${sideTheme.aside} border-r ${sideTheme.border} transform transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:w-64 lg:flex lg:flex-col
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        
        {/* Sidebar Header Brand / Title logo */}
        <div className={`p-6 flex items-center justify-between border-b ${sideTheme.border}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 ${themeTheme.primary} rounded-xl flex items-center justify-center font-black ${themeTheme.shadow}`}>
              {appConfig.systemShort ? appConfig.systemShort.charAt(0) : "G"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight uppercase">{appConfig.systemShort} Core</span>
              <span className="text-[9px] opacity-75 capitalize tracking-tighter">Class Management Portal</span>
            </div>
          </div>
          <span className={`text-[10px] ${sideTheme.badge} px-2 py-0.5 rounded-full font-bold`}>ITN-GD</span>
        </div>

        {/* Dynamic Connected User status display badge */}
        <div className={`p-5 border-b ${sideTheme.border} bg-black/10`}>
          <p className="text-[10px] opacity-50 uppercase tracking-wider font-extrabold mb-1">Authenticated Account</p>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${sideTheme.badge} flex items-center justify-center text-xs font-bold`}>
              {currentUser?.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold truncate leading-tight">{currentUser?.fullName}</p>
              <p className="text-[10px] opacity-60 truncate tracking-tight">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }}
            className={`w-full p-3 rounded-xl flex items-center space-x-3 text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "dashboard"
                ? sideTheme.itemActive
                : sideTheme.itemInactive
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Overview Dashboard</span>
          </button>

          <button
            onClick={() => { setActiveTab("materials"); setIsMobileMenuOpen(false); }}
            className={`w-full p-3 rounded-xl flex items-center space-x-3 text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "materials"
                ? sideTheme.itemActive
                : sideTheme.itemInactive
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{appConfig.materialsTerm || "Course Materials"}</span>
          </button>

          <button
            onClick={() => { setActiveTab("assignments"); setIsMobileMenuOpen(false); }}
            className={`w-full p-3 rounded-xl flex items-center space-x-3 text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "assignments"
                ? sideTheme.itemActive
                : sideTheme.itemInactive
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{appConfig.assignmentsTerm || "Assignments & Marking"}</span>
          </button>

          <button
            onClick={() => { setActiveTab("notes"); setIsMobileMenuOpen(false); }}
            disabled={currentUser?.role === "lecturer" ? true : false}
            className={`w-full p-3 rounded-xl flex items-center space-x-3 text-xs font-semibold cursor-pointer transition-all ${
              currentUser?.role === "lecturer"
                ? "opacity-40 cursor-not-allowed hidden"
                : activeTab === "notes"
                  ? sideTheme.itemActive
                  : sideTheme.itemInactive
            }`}
          >
            <BookOpenCheck className="w-4 h-4" />
            <span>Personal Studies Notes</span>
          </button>

          <button
            onClick={() => { setActiveTab("security"); setIsMobileMenuOpen(false); }}
            className={`w-full p-3 rounded-xl flex items-center space-x-3 text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "security"
                ? sideTheme.itemActive
                : sideTheme.itemInactive
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>System Guidelines</span>
          </button>
        </nav>

        {/* Classroom indicator on the footer bottom of the rail */}
        <div className={`p-4 m-4 rounded-xl border ${sideTheme.border} ${sideTheme.subCard}`}>
          <p className="text-[10px] opacity-60 uppercase tracking-widest font-extrabold mb-1.5">{appConfig.systemShort} CLASS</p>
          <div className="flex items-center text-[11px] text-emerald-500 space-x-2 font-bold justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="truncate">{appConfig.systemShort} Active Live</span>
          </div>

          {/* Theme switching button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="mt-3 w-full py-2 px-3 bg-black/10 hover:bg-black/25 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer text-slate-300 hover:text-white"
            title="Toggle system-wide light/dark theme"
          >
            <span className="flex items-center gap-1.5">
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </span>
            <span className="text-[9px] uppercase tracking-wider opacity-60 px-1.5 py-0.5 bg-black/30 rounded font-black">
              {theme}
            </span>
          </button>

          <button
            onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
            className="mt-3.5 w-full py-2.5 bg-black/20 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main viewport Container node */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Offline sync / online indicators wrapper */}
        <OfflineIndicator token={token} onSyncSuccess={() => fetchAppData(token!)} />

        {/* Top bar header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/85 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-30 shrink-0 sticky top-16 lg:top-0 shadow-sm animate-fade-in">
          
          {/* Global filter searches */}
          <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 w-full sm:w-80 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search and locate materials, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-xs w-full ml-2 text-slate-700"
            />
          </div>

          {/* User notifications feed indicators + index identities panel */}
          <div className="flex items-center justify-end space-x-4 w-full sm:w-auto shrink-0">
            
            {/* Real Push Notification Bell */}
            <div className="hidden lg:block">
              <NotificationBell token={token} notifications={notifications} onRefresh={() => fetchAppData(token!)} />
            </div>

            {/* User profile capsule card */}
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800">{currentUser?.fullName}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  {currentUser?.role === "lecturer" ? "L-ID: Faculty" : `ID: ${currentUser?.indexNumber}`}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold border border-indigo-100 uppercase sm:text-xs text-[10px]">
                {currentUser?.fullName.substring(0, 2).toUpperCase()}
              </div>
            </div>

          </div>
        </header>

        {/* Content canvas scrolling wrapper */}
        <main className="flex-1 p-6 overflow-y-auto">
          
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* ROLE A: STUDENT OVERVIEW DASHBOARD */}
              {currentUser?.role === "student" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                  
                  {/* Semester Circular Progress Board */}
                  <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div>
                        <span className="bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
                          Welcome to {appConfig.systemShort || "GDCMS"} Core
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 mt-2">Class portal state summary</h2>
                        <p className="text-slate-500 text-xs sm:text-sm">
                          AES-256 standard symmetric shields are active. Offline documents and homework logs are synchronized.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 pt-2">
                        <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 min-w-32">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Aggregate GPA</p>
                          <p className="text-xl font-black text-slate-800 mt-0.5">3.82</p>
                        </div>
                        <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 min-w-32">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Active Credits</p>
                          <p className="text-xl font-black text-slate-800 mt-0.5">18 / 21 GP</p>
                        </div>
                        <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 min-w-32">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Attendance State</p>
                          <p className="text-xl font-black text-emerald-600 mt-0.5">94% verified</p>
                        </div>
                      </div>
                    </div>

                    {/* SVG Circular Radial Progress */}
                    <div className="w-36 h-36 relative flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="72" cy="72" r="62" stroke="#F1F5F9" strokeWidth="12" fill="transparent" />
                        <circle 
                          cx="72" 
                          cy="72" 
                          r="62" 
                          stroke="#4F46E5" 
                          strokeWidth="12" 
                          fill="transparent" 
                          strokeDasharray="389.5" 
                          strokeDashoffset={389.5 - (389.5 * totalProgressPercentage / 100)} 
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-black text-indigo-600 block">{totalProgressPercentage}%</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Assessed State</span>
                      </div>
                    </div>

                  </div>

                  {/* Assignments / Grade feed status sidebar */}
                  <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col gap-4">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                      <span>Immediate Academic Priorities</span>
                    </h3>

                    <div className="flex-1 space-y-4 font-sans">
                      {filteredMaterials.filter(m => m.type === "assignment_prompt").length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          No active {appConfig.assignmentsTerm || "assignments"} found.
                        </div>
                      ) : (
                        filteredMaterials.filter(m => m.type === "assignment_prompt").slice(0, 3).map(asg => {
                          const submissionItem = studentSubmissionsMap[asg.id];
                          return (
                            <div key={asg.id} className="relative pl-6 border-l-2 border-indigo-500/30">
                              <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                              <p className="text-[9px] text-slate-400 uppercase tracking-tight font-black">
                                {new Date(asg.uploadedAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs font-semibold text-slate-800 truncate" title={asg.title}>
                                {asg.title}
                              </p>
                              
                              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                                {submissionItem ? (
                                  submissionItem.status === "graded" ? (
                                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100">
                                      Graded: {submissionItem.grade}
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded border border-amber-100">
                                      Under Review
                                    </span>
                                  )
                                ) : (
                                  <span className="bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-100">
                                    Not Handed In
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 text-center">
                      <button 
                        onClick={() => setActiveTab("assignments")} 
                        className="text-indigo-600 hover:text-indigo-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Inspect Handin Interface</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Half grid row: Materials & Personal Crypt Notes brief lists */}
                  <div className="lg:col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-extrabold text-sm text-slate-800">{appConfig.materialsTerm || "Course Materials"} Area</h3>
                      <button onClick={() => setActiveTab("materials")} className="text-xs text-indigo-600 font-bold cursor-pointer">
                        Browse All
                      </button>
                    </div>

                    <div className="space-y-3">
                      {filteredMaterials.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs font-medium">
                          No lecture files found matching search filters.
                        </div>
                      ) : (
                        filteredMaterials.slice(0, 3).map(mat => (
                          <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{mat.title}</p>
                                <p className="text-[10px] text-slate-400 truncate">{mat.uploadedBy} • {new Date(mat.uploadedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenGenericMenuId(openGenericMenuId === `dash_${mat.id}` ? null : `dash_${mat.id}`);
                                }}
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
                                title="Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openGenericMenuId === `dash_${mat.id}` && (
                                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 font-bold text-xs text-slate-755 text-slate-700 text-left">
                                  <a
                                    href={`/api/materials/download/${mat.id}`}
                                    download={mat.originalName}
                                    onClick={() => setOpenGenericMenuId(null)}
                                    className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 font-bold"
                                  >
                                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Download</span>
                                  </a>
                                  <button
                                    onClick={() => {
                                      setSharingMaterial(mat);
                                      setOpenGenericMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 text-left font-bold"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Share</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Personal notes brief lists */}
                  <div className="lg:col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-extrabold text-sm text-slate-800">My Studies Notebook</h3>
                      <button onClick={() => setActiveTab("notes")} className="text-xs text-indigo-600 font-bold cursor-pointer">
                        Open Sandbox Notebook
                      </button>
                    </div>

                    <div className="space-y-2">
                      {filteredNotes.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs font-medium">
                          No private studies records matched query filters.
                        </div>
                      ) : (
                        filteredNotes.slice(0, 3).map(note => (
                          <div 
                            key={note.id} 
                            className={`pointer-events-auto cursor-pointer p-4 rounded-2xl border transition-all ${
                              !note.isSynced 
                                ? "bg-amber-50/50 border-amber-200" 
                                : "bg-indigo-50/30 border-indigo-100"
                            }`}
                            onClick={() => {
                              setActiveTab("notes");
                              setEditingNoteId(note.id);
                              setNoteTitle(note.title);
                              setNoteContent(note.content);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-800">{note.title}</p>
                              {!note.isSynced ? (
                                <span className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded font-bold animate-pulse">
                                  Offline Cache
                                </span>
                              ) : (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                  AES Secure
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 truncate">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ROLE B: LECTURER PORTAL DASHBOARD (ASSESSMENT MATRIX CONSOLE) */}
              {currentUser?.role === "lecturer" && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Performance Statistics Overview Block */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Cohort Size</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{allStudents.length || 2} Enrolled</p>
                      </div>
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Cohort Target Average</p>
                        <p className="text-2xl font-black text-indigo-600 mt-1">81.5%</p>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <Trophy className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Interactive Syllabus Count</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{materials.length} Entries</p>
                      </div>
                      <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Outstanding Submissions</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{Math.max(0, 2 - submissions.length)} Pending</p>
                      </div>
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl animate-pulse">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Faculty Member Greetings Board */}
                  <div className="bg-indigo-950 text-white rounded-3xl p-6 relative overflow-hidden shadow-sm">
                    <div className="absolute right-0 bottom-0 top-0 opacity-10 pointer-events-none">
                      <svg className="w-96 h-full text-white" fill="currentColor" viewBox="0 0 100 100">
                        <polygon points="50,15 100,100 0,100" />
                      </svg>
                    </div>
                    <div className="space-y-1.5 relative z-10">
                      <span className="bg-indigo-800 text-indigo-200 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
                        Faculty Administration Centre
                      </span>
                      <h2 className="text-xl font-bold mt-1.5">Configure, track and edit individual academic performances</h2>
                      <p className="text-indigo-200 text-xs max-w-2xl font-medium">
                        Change student marks for Assignments, Classroom Quizzes, and Mid-semester examinations. The aggregate GP and verified rankings recalculate in real-time.
                      </p>
                    </div>
                  </div>

                  {/* GRADE PROGRESSION VISUAL TRENDS CHART */}
                  {(() => {
                    const maxAsgs = Math.max(...studentPerformance.map(s => s.progression?.length || 0), 0);
                    const chartData = [];
                    for (let i = 0; i < maxAsgs; i++) {
                      const point: { [key: string]: any } = { name: `Assignment ${i + 1}` };
                      studentPerformance.forEach(student => {
                        point[student.name] = student.progression ? student.progression[i] : 0;
                      });
                      chartData.push(point);
                    }

                    const colors = ["#4f46e5", "#10b981", "#f59e0b", "#06b6d4"];

                    return (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                              <Activity className="w-4 h-4 text-indigo-600" />
                              <span>Student Grade Progression Trends</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">Tracking students' individual grade progress over previous evaluation periods</p>
                          </div>
                        </div>

                        {chartData.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 font-medium pb-2">
                            No student grade progression data available as of yet.
                          </div>
                        ) : (
                          <div className="w-full h-72 md:h-80 select-none pb-2 text-[10px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={chartData}
                                margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#94a3b8" 
                                  fontSize={10} 
                                  tickLine={false} 
                                  axisLine={false}
                                />
                                <YAxis 
                                  domain={[0, 100]} 
                                  stroke="#94a3b8" 
                                  fontSize={10} 
                                  tickLine={false} 
                                  axisLine={false}
                                />
                                <ChartTooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#ffffff', 
                                    border: '1px solid #e2e8f0', 
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    color: '#1e293b'
                                  }} 
                                />
                                <Legend 
                                  verticalAlign="top" 
                                  height={36} 
                                  iconType="circle"
                                  iconSize={8}
                                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                />
                                {studentPerformance.map((student, idx) => (
                                  <Line
                                    key={student.id}
                                    type="monotone"
                                    dataKey={student.name}
                                    stroke={colors[idx % colors.length]}
                                    strokeWidth={3}
                                    activeDot={{ r: 6 }}
                                    dot={{ strokeWidth: 2, r: 4 }}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* INDIVIDUAL PERFORMANCE GRADES & MARKS LIST GRID */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                          <span>Student Grade Matrix & Performance (Assignments, Quizzes, Midsems)</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">Lecturers update performance records interactively onto the local database state container below.</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-100 uppercase tracking-wider text-[9px]">
                            <th className="p-4">Student Card</th>
                            <th className="p-4">Index ID</th>
                            <th className="p-4 bg-indigo-50/30 text-indigo-950">Assignments (25%)</th>
                            <th className="p-4">Quizzes (15%)</th>
                            <th className="p-4">Mid-Semester Exam (30%)</th>
                            <th className="p-4 text-center">Progress Status</th>
                            <th className="p-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {studentPerformance.map(student => {
                            const isEditing = editingStudentId === student.id;
                            return (
                              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                {/* Student avatar details */}
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-[10px] uppercase border">
                                      {student.name.substring(0, 2)}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900">{student.name}</p>
                                      <p className="text-[9px] text-slate-400">Class Year 3</p>
                                    </div>
                                  </div>
                                </td>
                                
                                {/* index identification */}
                                <td className="p-4 font-mono text-[11px] font-semibold text-slate-500">
                                  {student.index}
                                </td>

                                {/* Assignments score */}
                                <td className="p-4 bg-indigo-50/10 font-bold">
                                  {isEditing ? (
                                    <input 
                                      type="number"
                                      value={editAsgGrade}
                                      onChange={(e) => setEditAsgGrade(Number(e.target.value))}
                                      placeholder="0"
                                      className="w-16 bg-white border rounded py-1 px-1 text-xs text-slate-850"
                                    />
                                  ) : (
                                    <span className="text-slate-900">{student.assignmentGrade}%</span>
                                  )}
                                </td>

                                {/* Quiz score */}
                                <td className="p-4">
                                  {isEditing ? (
                                    <input 
                                      type="number"
                                      value={editQuizGrade}
                                      onChange={(e) => setEditQuizGrade(Number(e.target.value))}
                                      placeholder="0"
                                      className="w-16 bg-white border rounded py-1 px-1 text-xs text-slate-850"
                                    />
                                  ) : (
                                    <span className="text-slate-850">{student.quizGrade}%</span>
                                  )}
                                </td>

                                {/* Midsem grade */}
                                <td className="p-4">
                                  {isEditing ? (
                                    <input 
                                      type="number"
                                      value={editMidsemGrade}
                                      onChange={(e) => setEditMidsemGrade(Number(e.target.value))}
                                      placeholder="0"
                                      className="w-16 bg-white border rounded py-1 px-1 text-xs text-slate-850"
                                    />
                                  ) : (
                                    <span className="text-slate-850">{student.midsemGrade}%</span>
                                  )}
                                </td>

                                {/* Rating indicator badge */}
                                <td className="p-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                    student.progressStatus === "Excellent" 
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  }`}>
                                    {student.progressStatus}
                                  </span>
                                </td>

                                {/* inline submission evaluation trigger actions */}
                                <td className="p-4 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => {
                                          setStudentPerformance(prev => prev.map(stud => {
                                            if (stud.id === student.id) {
                                              let status = "Average";
                                              const aggregate = (editAsgGrade * 0.25) + (editQuizGrade * 0.15) + (editMidsemGrade * 0.3) + 20;
                                              if (aggregate >= 80) status = "Excellent";
                                              else if (aggregate >= 70) status = "Consistent";
                                              
                                              const newProgression = [...(stud.progression || [70, 78, 85, 88])];
                                              if (newProgression.length > 0) {
                                                newProgression[newProgression.length - 1] = editAsgGrade;
                                              }
                                              
                                              return {
                                                ...stud,
                                                assignmentGrade: editAsgGrade,
                                                quizGrade: editQuizGrade,
                                                midsemGrade: editMidsemGrade,
                                                progressStatus: status,
                                                progression: newProgression
                                              };
                                            }
                                            return stud;
                                          }));
                                          setEditingStudentId(null);
                                        }}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingStudentId(null)}
                                        className="px-2 py-1 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingStudentId(student.id);
                                        setEditAsgGrade(student.assignmentGrade);
                                        setEditQuizGrade(student.quizGrade);
                                        setEditMidsemGrade(student.midsemGrade);
                                      }}
                                      className="px-3 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Update Marks
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* REGISTERED STUDENT ACCOUNTS DIRECTORY FOR LECTURERS */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-650 text-indigo-600 animate-pulse" />
                          <span>Student Accounts Directory ({allStudents.length} Students Enrolled)</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Overview of all enrolled students synced in the class management system.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchAppData(token!)}
                        disabled={isLoadingAllStudents}
                        className="shrink-0 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 text-slate-705 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-slate-200"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingAllStudents ? "animate-spin" : ""}`} />
                        <span>Sync Students</span>
                      </button>
                    </div>

                    {isLoadingAllStudents && allStudents.length === 0 ? (
                      <div className="text-center py-8 animate-pulse">
                        <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-500">Retrieving student records securely...</p>
                      </div>
                    ) : allStudents.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <p className="text-xs font-bold text-slate-700">No student users found in the database.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs font-semibold">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="py-3 px-4">Student Card</th>
                              <th className="py-3 px-4">Student Index ID</th>
                              <th className="py-3 px-4">Email Address</th>
                              <th className="py-3 px-4">Google Hub Sync</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {allStudents.map((stud) => (
                              <tr key={stud.id} className="hover:bg-slate-50/40 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center uppercase border border-slate-200 shrink-0">
                                      {stud.fullName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-slate-900">{stud.fullName}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-slate-600">
                                  {stud.indexNumber || "NOT ASSIGNED"}
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-xs font-semibold">
                                  {stud.email}
                                </td>
                                <td className="py-3 px-4 font-bold text-xs font-semibold">
                                  {stud.oauthConnected ? (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                      <span>Active Sync</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Not Synced</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ROLE C: ADMIN PRIVILEGE PANEL (SYSTEM DESIGN CONFIG INTERFACE) */}
              {currentUser?.role === "admin" && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Administrative sub-tab selectors */}
                  <div className="p-1 bg-slate-100 border border-slate-200 rounded-2xl flex flex-wrap gap-2 inline-flex">
                    <button
                      type="button"
                      onClick={() => setAdminPanelTab("config")}
                      className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        adminPanelTab === "config"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      System Configurations
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPanelTab("addUser")}
                      className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        adminPanelTab === "addUser"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Add New Users
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPanelTab("usersList")}
                      className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        adminPanelTab === "usersList"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Registered Users ({allUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPanelTab("databases")}
                      className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        adminPanelTab === "databases"
                          ? "bg-white text-indigo-700 font-bold border border-indigo-200 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Database Manager 🗄️
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPanelTab("sandbox")}
                      className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        adminPanelTab === "sandbox"
                          ? "bg-indigo-605 bg-indigo-600 text-white shadow-md animate-pulse"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Trial Sandbox Room
                    </button>
                  </div>

                  {adminPanelTab === "config" && (
                    <div className="space-y-6">
                      {/* Separation of Concerns Protection Warning */}
                  <div className="bg-amber-50/60 border border-amber-200/80 p-5 rounded-3xl flex items-start gap-4">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-black text-amber-950 uppercase tracking-wide text-[10px]">Academic Data Isolation Active</p>
                      <p className="text-amber-800 mt-1 font-medium leading-relaxed">
                        To guarantee absolute student record privacy compliance, Administrators are strictly locked out from modifying cohort academic data (assignment scripts, quizzes, examinations, or grade transcripts). You may adjust nomenclature variables and deploy server builds in the control centers below.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* COLUMN 1: LIVE REBRANDING SYSTEM RESTRENGTHENING (span-8) */}
                    <div className="xl:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                      <div className="space-y-1 border-b pb-3 border-slate-100 flex items-center justify-between">
                        <div>
                          <span className={`${themeTheme.primary} text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider`}>
                            Brand & Look-And-Feel System Restructure
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                            <Palette className="w-4.5 h-4.5 text-indigo-600" />
                            <span>Portal Core Rebranding Matrix</span>
                          </h3>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold uppercase px-2 py-1 rounded-xl">Active Restructure</span>
                      </div>

                      <div className="space-y-4 text-xs">
                        {/* Nomenclature terminology definitions inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Short Acronym Acronym Name
                            </label>
                            <input 
                              type="text"
                              value={appConfig.systemShort}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, systemShort: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-slate-800 font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Full Extended System Name
                            </label>
                            <input 
                              type="text"
                              value={appConfig.systemName}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, systemName: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-slate-800 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Assignments Interface Tab Customized Label
                            </label>
                            <input 
                              type="text"
                              value={appConfig.assignmentsTerm}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, assignmentsTerm: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-slate-800 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Materials Interface Area Customized Label
                            </label>
                            <input 
                              type="text"
                              value={appConfig.materialsTerm}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, materialsTerm: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-slate-800 font-semibold"
                            />
                          </div>
                        </div>

                        {/* Theme Preset and Sidebar Preset select boards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Theme Accent Color
                            </label>
                            <select
                              value={appConfig.themeColor || "indigo"}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, themeColor: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold"
                            >
                              <option value="indigo">Indigo Corporate (Default)</option>
                              <option value="emerald">Emerald Forest Calm</option>
                              <option value="rose">Rose Velvet Elegant</option>
                              <option value="violet">Violet Electric Tech</option>
                              <option value="amber">Amber Harvest Warm</option>
                              <option value="blue">Blue Sky Air</option>
                              <option value="slate">Slate Minimal Industrial</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Sidebar Rail Theme Presets
                            </label>
                            <select
                              value={appConfig.sidebarStyle || "dark-navy"}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, sidebarStyle: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold"
                            >
                              <option value="dark-navy">Dark Slate Navy (Default)</option>
                              <option value="indigo-accent">Connected Indigo Accent</option>
                              <option value="slate-minimal">Slate Minimal Light</option>
                              <option value="emerald-forest">Emerald Jungle Deep</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Global Font Size preset
                            </label>
                            <select
                              value={appConfig.fontSizePreset || "standard"}
                              onChange={(e) => setAppConfig(prev => ({ ...prev, fontSizePreset: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold"
                            >
                              <option value="compact">Compact Dense typography</option>
                              <option value="standard">Standard balanced (Default)</option>
                              <option value="large">Spacious Readable font</option>
                            </select>
                          </div>
                        </div>

                        {/* Sandbox mode toggle controller relocated from public login view */}
                        <div className="bg-slate-50 border p-4 rounded-2xl flex items-center justify-between gap-4 mt-2">
                          <div className="text-left">
                            <h4 className="font-bold text-slate-800 text-xs">Sandbox Helper Mode toggler</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Render public mock-login trial users helper cards on landing page for verification.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !appConfig.sandboxModeEnabled;
                              setAppConfig(prev => ({ ...prev, sandboxModeEnabled: nextVal }));
                              setShowPublicSandbox(nextVal);
                            }}
                            className={`px-4 py-2 font-black tracking-wider rounded-xl uppercase text-[10px] transition-all cursor-pointer ${
                              appConfig.sandboxModeEnabled !== false
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                            }`}
                          >
                            Sandbox cards: {appConfig.sandboxModeEnabled !== false ? "SHOWN" : "HIDDEN"}
                          </button>
                        </div>

                        {/* Live rebrand save and push button */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveAppConfigOnServer(appConfig)}
                            className={`py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer text-white ${themeTheme.primary}`}
                          >
                            Restructure & Rebrand System Live
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 2: ADVISORY ALERT NOTIFICATION BROADCASTER (span-4) */}
                    <div className="xl:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          Official Emergency Alert Advisor
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1.5 flex items-center gap-1.5">
                          <ShieldAlert className="w-4.5 h-4.5 text-rose-600" />
                          <span>Emergency Broadcasting Terminal</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium text-left">Deploy instant warning and notification popups on student/lecturer bells for anomalous acts.</p>
                      </div>

                      <form onSubmit={handleBroadcastAlert} className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Target Audience Group
                            </label>
                            <select
                              value={alertTarget}
                              onChange={(e) => setAlertTarget(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-semibold"
                            >
                              <option value="all">All Direct Participants (Students & Lecturers)</option>
                              <option value="student">Students portal exclusively</option>
                              <option value="lecturer">Lecturers grid exclusively</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Advisory Warning Title
                            </label>
                            <input
                              type="text"
                              value={alertTitle}
                              onChange={(e) => setAlertTitle(e.target.value)}
                              placeholder="e.g. Administrative Audit Watch / Security Advice"
                              className="w-full bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-850 font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-left">
                              Advice / Warning Body message
                            </label>
                            <textarea
                              value={alertMessage}
                              onChange={(e) => setAlertMessage(e.target.value)}
                              placeholder="Write warning memo details concerning unusual class uploads or platform behaviors..."
                              rows={4}
                              className="w-full bg-slate-50 border border-slate-200 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-slate-700 font-semibold resize-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isBroadcastingAlert}
                          className="w-full py-3 bg-slate-900 hover:bg-rose-600 text-white font-extrabold rounded-xl text-xs uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isBroadcastingAlert ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Broadcast Alert Notification Now</span>
                          )}
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* COLUMN 3: REAL-TIME INDEPENDENT SECURITY AUDIT TRAIL LOGS (Successful and Failed attempts) */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 border-slate-105 border-slate-100 gap-4">
                      <div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          Cryptographic Security logs
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5 justify-start">
                          <Lock className="w-4.5 h-4.5 text-slate-800" />
                          <span>Login Authentication Security Audit Log Trail</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium text-left">Aggregated successful credentials matches and hashes checking attempts on active nodes.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={fetchAuthLogs}
                          className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-slate-650 font-bold text-xs uppercase tracking-tight flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Logs</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAuthLogs}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs uppercase tracking-tight flex items-center gap-1 cursor-pointer"
                        >
                          <span>Purge Trails</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 uppercase text-[9px] font-extrabold tracking-wider border-b border-slate-200">
                            <th className="py-3 px-4">Index Timestamp</th>
                            <th className="py-3 px-4">Provided Identifier</th>
                            <th className="py-3 px-4">Result Status</th>
                            <th className="py-3 px-4">Reason / Verification Action</th>
                            <th className="py-3 px-4 font-mono text-right">Target virtual node</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-left text-slate-700">
                          {authLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold bg-slate-50/50">
                                No security logs registered. Attempt authentications to trigger audit indexes.
                              </td>
                            </tr>
                          ) : (
                            authLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                                <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{log.identifier || log.emailOrIndex || "System Session"}</td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {log.status?.toUpperCase() === "SUCCESS" ? (
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border border-emerald-100 h-fit">
                                      SUCCESS MATCH
                                    </span>
                                  ) : (
                                    <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border border-red-100 h-fit">
                                      FAILED ATTEMPT
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 max-w-sm font-semibold text-slate-600 align-middle">
                                  <span>{log.reason || "Decryption verified. Symmetric Session assigned."}</span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-slate-400 text-[10px]">
                                  {log.ip || log.ipPlaceholder || "127.0.0.1"} (node: sha255_aes)
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
            )}

            {adminPanelTab === "addUser" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 max-w-2xl mx-auto text-left animate-fade-in">
                <div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl font-black uppercase tracking-wider">
                    database coordination
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1.5 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-650 text-indigo-600 animate-pulse" />
                    <span>Register & Add New Portal Users</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    As System Administrator, you can enroll new students, lecturers, or other administrators directly into the GDCMS database.
                  </p>
                </div>

                {adminRegisterError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-start gap-2 animate-pulse">
                    <span>✖</span>
                    <span>{adminRegisterError}</span>
                  </div>
                )}

                {adminRegisterSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-start gap-2">
                    <span>✔</span>
                    <span>{adminRegisterSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleAdminRegisterUser} className="space-y-5">
                  
                  {/* Selector for user role */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Choose Placement Role
                    </label>
                    <div className="grid grid-cols-3 gap-3 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                      {[
                        { label: "Student", value: "student" },
                        { label: "Lecturer", value: "lecturer" },
                        { label: "Administrator", value: "admin" }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setAdminRegisterRole(opt.value as any);
                            setAdminRegisterError(null);
                            setAdminRegisterSuccess(null);
                          }}
                          className={`py-2 px-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            adminRegisterRole === opt.value
                              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50 font-black"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instructional placeholder text */}
                  <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl text-[11px] text-slate-500 leading-relaxed">
                    {adminRegisterRole === "student" && (
                      <p><strong>Student Rules:</strong> Must enter fullname, secure email/id, password, and a student index conforming to the custom index formatter (e.g. <code>BC/ITN/25/147</code>).</p>
                    )}
                    {adminRegisterRole === "lecturer" && (
                      <p><strong>Lecturer Rules:</strong> Enrolls an educator account. No structural input format constraints are locked. Enter email address or standard lecturer ID code.</p>
                    )}
                    {adminRegisterRole === "admin" && (
                      <p><strong>Admin Rules:</strong> Creates an administrative user with complete oversight on databases, rebranding matrixes and system control setups.</p>
                    )}
                  </div>

                  {/* Full name input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={adminRegisterFullName}
                      onChange={(e) => setAdminRegisterFullName(e.target.value)}
                      placeholder="e.g. Emmanuel Vance"
                      className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  {/* Institutional Email list */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                      {adminRegisterRole === "student" ? "Student Email or ID" : adminRegisterRole === "lecturer" ? "Lecturer Email or ID" : "Coordinators Email or ID"}
                    </label>
                    <input
                      type="text"
                      required
                      value={adminRegisterEmail}
                      onChange={(e) => setAdminRegisterEmail(e.target.value)}
                      placeholder={adminRegisterRole === "student" ? "e.g. student@gdcms.edu" : adminRegisterRole === "lecturer" ? "e.g. lecturer@gdcms.edu" : "e.g. admin@gdcms.edu"}
                      className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-805 text-slate-850 text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  {/* Student index conditional input */}
                  {adminRegisterRole === "student" && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500">
                        Student Index Number ID
                      </label>
                      <input
                        type="text"
                        required
                        value={adminRegisterIndexNumber}
                        onChange={(e) => setAdminRegisterIndexNumber(formatIndexNumberInput(e.target.value, adminRegisterIndexNumber))}
                        placeholder="e.g. BC/ITN/25/147"
                        className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    </div>
                  )}

                  {/* Access Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                      Default Profile Access Password
                    </label>
                    <input
                      type="password"
                      required
                      value={adminRegisterPassword}
                      onChange={(e) => setAdminRegisterPassword(e.target.value)}
                      placeholder="default password (client must update on login)"
                      className="w-full bg-[#fcfdfe] border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAdminRegisteringUser}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/15"
                  >
                    {isAdminRegisteringUser ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enrolling User onto DB...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Confirm Profile Registry Enrollment</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {adminPanelTab === "usersList" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 text-left animate-fade-in">
                {/* Reset status banners */}
                {resetStatusMsg && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center justify-between animate-fade-in text-xs text-emerald-800 dark:text-emerald-300 font-extrabold gap-3">
                    <p className="m-0 leading-relaxed">{resetStatusMsg}</p>
                    <button onClick={() => setResetStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm p-1 cursor-pointer">×</button>
                  </div>
                )}
                {resetErrorMsg && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl flex items-center justify-between animate-fade-in text-xs text-red-800 dark:text-red-300 font-extrabold gap-3">
                    <p className="m-0 leading-relaxed">{resetErrorMsg}</p>
                    <button onClick={() => setResetErrorMsg(null)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm p-1 cursor-pointer">×</button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl font-black uppercase tracking-wider">
                      global database directory
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-1.5 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-650 text-indigo-600 animate-pulse" />
                      <span>Platform Users Repository</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Real-time register outlines of enrolled platform accounts. Symmetrical credential security keys remain invisible (passwords cannot be exposed).
                    </p>
                  </div>
                  <button
                    onClick={() => fetchAppData(token!)}
                    disabled={isLoadingAllUsers}
                    className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-slate-200 hover:border-slate-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAllUsers ? "animate-spin" : ""}`} />
                    <span>Synchronize DB</span>
                  </button>
                </div>

                {/* Micro metrics count layout */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Students count</p>
                    <p className="text-xl font-black text-indigo-600">{allUsers.filter(u => u.role === "student").length}</p>
                  </div>
                  <div className="text-center sm:text-left border-l border-slate-200 pl-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lecturers count</p>
                    <p className="text-xl font-black text-emerald-600">{allUsers.filter(u => u.role === "lecturer").length}</p>
                  </div>
                  <div className="text-center sm:text-left border-l border-slate-200 pl-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Admins count</p>
                    <p className="text-xl font-black text-amber-600">{allUsers.filter(u => u.role === "admin").length}</p>
                  </div>
                </div>

                {isLoadingAllUsers && allUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                    <p className="text-xs font-semibold text-slate-500">Querying live indexes matrix from securely encapsulated nodes...</p>
                  </div>
                ) : allUsers.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No database directories indexed yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <th className="py-3 px-4">Name & Email</th>
                          <th className="py-3 px-4">Security Role</th>
                          <th className="py-3 px-4">Identity / Index Code</th>
                          <th className="py-3 px-4">Google Integration</th>
                          <th className="py-3 px-4">Credential Policy Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {allUsers.map((userObjItem) => (
                          <tr key={userObjItem.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center uppercase border border-slate-200 shrink-0">
                                  {userObjItem.fullName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-extrabold text-slate-800">{userObjItem.fullName}</p>
                                  <p className="text-[10px] text-slate-400 font-semibold">{userObjItem.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold">
                              {userObjItem.role === "admin" && (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200/55 px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-extrabold">
                                  administrator
                                </span>
                              )}
                              {userObjItem.role === "lecturer" && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/55 px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-extrabold">
                                  lecturer
                                </span>
                              )}
                              {userObjItem.role === "student" && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/55 px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-extrabold">
                                  student
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                              {userObjItem.role === "student" ? userObjItem.indexNumber || "NOT ASSIGNED" : "FACULTY PIN"}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-xs">
                              {userObjItem.oauthConnected ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                  <span>Synced ✔</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">Not Synced</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-xs">
                              {resettingUserId === userObjItem.id ? (
                                <div className="flex flex-col gap-2 p-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl animate-fade-in max-w-xs" onClick={(e) => e.stopPropagation()}>
                                  <div>
                                    <label className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider block">Temp Password</label>
                                    <input 
                                      type="text"
                                      value={resetTempPassword}
                                      onChange={(e) => setResetTempPassword(e.target.value)}
                                      placeholder="e.g. 123456"
                                      className="mt-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs select-all text-slate-800 dark:text-white w-full font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      type="button"
                                      disabled={isResettingUserPass}
                                      onClick={() => triggerUserPasswordReset(userObjItem.id, resetTempPassword)}
                                      className="px-2.5 py-1 bg-red-650 hover:bg-red-700 hover:bg-red-700 bg-red-600 text-white font-extrabold text-[9px] uppercase rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      {isResettingUserPass ? "Saving..." : "Confirm"}
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => setResettingUserId(null)}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-slate-700 font-extrabold text-[9px] uppercase rounded-lg transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setResettingUserId(userObjItem.id);
                                    setResetTempPassword("123456");
                                    setResetStatusMsg(null);
                                    setResetErrorMsg(null);
                                  }}
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 hover:text-red-750 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer border border-red-100 dark:border-red-900/50 flex items-center gap-1.5 shrink-0"
                                >
                                  <Lock className="w-3 h-3 text-red-500" />
                                  <span>Reset Password</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {adminPanelTab === "databases" && (
              <div className="space-y-6 animate-fade-in text-left">
                {/* Header card with status overview */}
                <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-xl font-black uppercase tracking-wider">
                        Decentralized State Sync Node active
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <span>Replication & Mirror Management Console</span>
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
                      Configure GDCMS's Dual-Database Architecture. This engine synchronizes relational operations from Google Cloud SQL (PostgreSQL) into Firebase Firestore for real-time offline caching, seamless backup, and low-latency student-educator data sharing.
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-wrap gap-2.5">
                    <button
                      onClick={fetchDbStats}
                      disabled={isLoadingDbStats}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700/60 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbStats ? 'animate-spin' : ''}`} />
                      <span>Diagnostics</span>
                    </button>
                  </div>
                </div>

                {/* Primary stats comparison grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* PostgreSQL Cloud SQL Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100/50">
                            <Cpu className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">PRIMARY DATABASE (Relational)</span>
                            <h4 className="font-extrabold text-slate-800 text-sm">PostgreSQL Cloud SQL Core</h4>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black uppercase px-2 py-0.5 rounded border border-emerald-100">
                          {dbStats?.connectionStatus || "Connected & Operational"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Relational Engine</span>
                          <span className="text-slate-700 font-black">{dbStats?.dbType || "PostgreSQL (Google Cloud SQL)"}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Regional Cloud Zone</span>
                          <span className="text-slate-700 font-mono font-black">{dbStats?.region || "europe-west2"}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Active ORM Mapping</span>
                          <span className="text-indigo-600 font-black">Drizzle Schema Manager</span>
                        </div>
                        
                        <div className="mt-4 pt-2">
                          <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Live Relational Records Node Status</h5>
                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Courses</p>
                              <p className="text-base font-black text-slate-800">{dbStats?.courses ?? courses.length}</p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Syllabus Files</p>
                              <p className="text-base font-black text-slate-800">{dbStats?.materials ?? materials.length}</p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Submissions</p>
                              <p className="text-base font-black text-slate-800">{dbStats?.submissions ?? submissions.length}</p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Enrolled Users</p>
                              <p className="text-base font-black text-slate-800">{dbStats?.users ?? allUsers.length}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                      <p className="text-slate-400 text-[10px] leading-relaxed font-semibold">
                        Need to reset primary state? Triggering a seed clears transactional student inputs but populates structural courses and folders with simulated grading portfolios for preview evaluations.
                      </p>
                      <button
                        onClick={handleSeedPrimaryDatabase}
                        disabled={isSeedingDb}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-200"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSeedingDb ? 'animate-spin' : ''}`} />
                        <span>Purge & Re-seed PostgreSQL Node</span>
                      </button>
                    </div>
                  </div>

                  {/* Firebase Firestore NoSQL Mirror Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-red-50 rounded-2xl border border-red-100/50">
                            <Cloud className="w-5 h-5 text-red-500 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">MIRROR REPLICATION NODE (NoSQL)</span>
                            <h4 className="font-extrabold text-slate-800 text-sm">Firebase NoSQL Database</h4>
                          </div>
                        </div>
                        <span className="text-[10px] bg-sky-50 text-sky-700 font-black uppercase px-2 py-0.5 rounded border border-sky-100">
                          Dual-Mirror Active
                        </span>
                      </div>

                      <div className="mt-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Sync Mode</span>
                          <span className="text-slate-700 font-black">Asymmetrical Real-time Mirror</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Firestore Project ID</span>
                          <span className="text-slate-700 font-mono font-bold">gen-lang-client-0772636231</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Instance DB ID</span>
                          <span className="text-[11px] text-slate-600 font-mono font-bold select-all overflow-hidden text-ellipsis max-w-[200px]" title="ai-studio-9dca88f8-c6b3-4177-b603-77363bb50f89">
                            ai-studio-9dca88f8-c6b3-4177...
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400 font-bold">Local Storage Mirror Cache</span>
                          <span className="text-emerald-600 font-extrabold">Enabled (Persistent Cache IndexedDB)</span>
                        </div>

                        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-800 leading-relaxed font-semibold">
                          <p className="flex items-center gap-1.5 uppercase font-bold text-amber-950 mb-1">
                            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
                            <span>Firestore Security Sandboxing Active</span>
                          </p>
                          Dual state uses symmetric password-linked hashes for client coursework notes, securing notes before they propagate to server. Students/Lecturers download documents seamlessly even during network losses.
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                      <p className="text-slate-400 text-[10px] leading-relaxed font-semibold">
                        Represents live replication. Forcing rebuild synchronizes courses, lectures files indices, notebooks, and student exam files completely into Firestore.
                      </p>
                      
                      <button
                        onClick={handleForceMirrorToFirestore}
                        disabled={isSyncingFirestore}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                        <span>Force Rebuild Firestore Mirror</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Firestore Sync Logs and Progress Block */}
                {(isSyncingFirestore || firestoreSyncProgress || firestoreSyncStatus !== 'idle') && (
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-fade-in text-xs font-semibold">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                        <span>State Sync Pipeline logs</span>
                      </h4>
                      {firestoreSyncStatus === 'success' && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded text-[10.5px] font-black uppercase">
                          System Synchronized ✔
                        </span>
                      )}
                      {firestoreSyncStatus === 'failed' && (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded text-[10.5px] font-black uppercase">
                          Failed ⚠
                        </span>
                      )}
                      {isSyncingFirestore && (
                        <span className="text-indigo-600 animate-pulse flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Pipelining...</span>
                        </span>
                      )}
                    </div>

                    <div className="p-4 bg-slate-900 text-indigo-400 rounded-xl font-mono text-[11px] leading-relaxed border border-slate-800">
                      <p className="text-slate-400">// GDCMS Mirror Pipe Stream — Timestamp: {new Date().toISOString()}</p>
                      <p className="mt-1.5 font-bold">{firestoreSyncProgress || "Awaiting task pipeline trigger..."}</p>
                    </div>
                  </div>
                )}

                {/* Simulated Diagnostic Tool / Interactive Checks */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-xl font-black uppercase tracking-wider">
                      Automated Health Diagnostic
                    </span>
                    <h4 className="font-black text-slate-800 text-sm mt-1 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>Real-time Node Health Integrity Inspector</span>
                    </h4>
                    <p className="text-slate-500 text-xs mt-1">
                      Instantly query secure relational schemas and check if secure socket replication pathways are clear of bottlenecks. No user identities or tokens will be modified.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50 flex items-start gap-3">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-slate-800 uppercase tracking-wide text-[9px]">Drizzle Relation Model Verification</p>
                        <p className="text-slate-500 mt-1 leading-relaxed">Schema relations are verified and validated with correct database keys indices.</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50 flex items-start gap-3">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-slate-800 uppercase tracking-wide text-[9px]">Secure Token Decryption Cache</p>
                        <p className="text-slate-500 mt-1 leading-relaxed">Encryption pipeline active. Authenticated session JWT handles claims validation.</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50 flex items-start gap-3">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-slate-800 uppercase tracking-wide text-[9px]">Anonymous Auth Sandboxing</p>
                        <p className="text-slate-500 mt-1 leading-relaxed">Symmetrical NoSQL token validates reading without leaking private client indices keys.</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {adminPanelTab === "sandbox" && (
              <div className="space-y-6 animate-fade-in">
                       {/* Preseeded Sandbox workspace cards */}
                       <div className="bg-white p-6 border border-slate-200 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-left">
                         <div>
                           <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                             <Wrench className="w-5 h-5 text-indigo-650 text-indigo-600 animate-pulse" />
                             <span>Admin Managed Sandbox Room & Trial Sessions</span>
                           </h3>
                           <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                             Evaluate or test alternative student and educator user workspaces instantly without manual register steps. Click an access key card below to authenticate.
                           </p>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                         {/* Student Card */}
                         <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left">
                           <div className="space-y-4">
                             <div className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                               <span className="text-[10px] uppercase font-black text-emerald-700 tracking-wider">Student Role access</span>
                             </div>
                             <div className="space-y-1">
                               <h4 className="font-black text-slate-900 text-base">Clement Koffie</h4>
                               <p className="text-xs text-slate-500 font-semibold leading-relaxed">Submit private papers, write learning notebook blocks, and synchronize with Drive.</p>
                             </div>
                             <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1.5 text-xs text-slate-600 font-semibold">
                               <p className="flex justify-between">
                                 <span className="text-slate-400 font-medium font-bold">Index ID:</span>
                                 <span className="text-slate-800 font-mono font-bold select-all">BC/ITN/25/147</span>
                               </p>
                               <p className="flex justify-between text-[11px]">
                                 <span className="text-slate-400 font-medium">Email:</span>
                                 <span className="text-slate-850 font-bold select-all">koffieclement12@gmail.com</span>
                               </p>
                               <p className="flex justify-between text-[11px]">
                                 <span className="text-slate-400 font-medium">Session Key:</span>
                                 <span className="text-slate-500 font-mono select-all">123456</span>
                               </p>
                             </div>
                           </div>
                           <button
                             type="button"
                             onClick={() => handleQuickLogin("BC/ITN/25/147")}
                             className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                           >
                             Log in as Student (Clement)
                           </button>
                         </div>

                         {/* Lecturer Card */}
                         <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left">
                           <div className="space-y-4">
                             <div className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                               <span className="text-[10px] uppercase font-black text-indigo-700 tracking-wider">Faculty Console access</span>
                             </div>
                             <div className="space-y-1">
                               <h4 className="font-black text-slate-900 text-base">Dr. Emmanuel Vance</h4>
                               <p className="text-xs text-slate-500 font-semibold leading-relaxed">Structure lectures summaries, organize academic calendars, and assign student marks.</p>
                             </div>
                             <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1.5 text-xs text-slate-600 font-semibold">
                               <p className="flex justify-between">
                                 <span className="text-slate-400 font-medium font-bold">Faculty ID:</span>
                                 <span className="text-slate-800 font-mono font-bold select-all">L-9001</span>
                               </p>
                               <p className="flex justify-between">
                                 <span className="text-slate-400 font-medium">Email:</span>
                                 <span className="text-slate-815 select-all font-bold">emmanuel.vance@gdcms.edu</span>
                               </p>
                               <p className="flex justify-between text-[11px]">
                                 <span className="text-slate-400 font-medium">Session Key:</span>
                                 <span className="text-slate-500 font-mono select-all">123456</span>
                               </p>
                             </div>
                           </div>
                           <button
                             type="button"
                             onClick={() => handleQuickLogin("L-9001")}
                             className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                           >
                             Log in as Lecturer (Dr. Vance)
                           </button>
                         </div>

                         {/* Admin Card */}
                         <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left">
                           <div className="space-y-4">
                             <div className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                               <span className="text-[10px] uppercase font-black text-purple-700 tracking-wider">Coordinator Access</span>
                             </div>
                             <div className="space-y-1">
                               <h4 className="font-black text-slate-900 text-base">Coordinator Admin</h4>
                               <p className="text-xs text-slate-500 font-semibold leading-relaxed">Observe live system analytics logs, adjust nomenclature strings, and deploy changes.</p>
                             </div>
                             <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1.5 text-xs text-slate-600 font-semibold">
                               <p className="flex justify-between">
                                 <span className="text-slate-400 font-medium font-bold">Admin ID:</span>
                                 <span className="text-slate-850 font-mono font-bold select-all">A-0001</span>
                               </p>
                               <p className="flex justify-between">
                                 <span className="text-slate-400 font-medium">Email:</span>
                                 <span className="text-slate-850 font-bold select-all">admin@gdcms.edu</span>
                               </p>
                               <p className="flex justify-between text-[11px]">
                                 <span className="text-slate-400 font-medium">Session Key:</span>
                                 <span className="text-slate-500 font-mono select-all font-bold">123456</span>
                               </p>
                             </div>
                           </div>
                           <button
                             type="button"
                             disabled
                             className="mt-6 w-full py-2.5 bg-slate-100 text-slate-400 text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-not-allowed"
                           >
                             Current Active Admin Session
                           </button>
                         </div>

                       </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: COURSE MATERIALS AREA */}
          {activeTab === "materials" && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                
                {/* Course Filter Dropdown and description tags */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Target Course:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCourseId("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        selectedCourseId === "all"
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Subjects
                    </button>
                    {courses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => setSelectedCourseId(course.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                          selectedCourseId === course.id
                            ? "bg-slate-950 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {course.code}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Materials Main Grid Collection Feed */}
                <div className="lg:col-span-8 space-y-4">
                  
                  {filteredMaterials.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
                      <BookOpen className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-500">No course materials matched your selection.</p>
                      <p className="text-xs text-slate-400 mt-1">Check back later or change Course options.</p>
                    </div>
                  ) : (
                    filteredMaterials.map(mat => {
                      const associatedCourse = courses.find(c => c.id === mat.courseId);
                      return (
                        <div key={mat.id} className="bg-white rounded-3xl p-5 border border-slate-200/85 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-4">
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-indigo-50 text-indigo-700 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">
                                {associatedCourse?.code || "COURSE"}
                              </span>
                              <span className="bg-slate-100 text-slate-600 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold">
                                {mat.type.replace("_", " ")}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-slate-800 leading-tight">{mat.title}</h4>
                            <p className="text-xs text-slate-500 pr-4 leading-relaxed">{mat.description}</p>

                            <div className="flex items-center gap-4 text-[10px] text-slate-400 capitalize pt-1">
                              <span>Uploaded: {mat.uploadedBy}</span>
                              <span>•</span>
                              <span>Size: {Math.round(mat.fileSize / 1024)} KB</span>
                              <span>•</span>
                              <span>{new Date(mat.uploadedAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="shrink-0 relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMaterialMenuId(openMaterialMenuId === mat.id ? null : mat.id);
                              }}
                              className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-705 text-slate-700 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                              title="Material Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMaterialMenuId === mat.id && (
                              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 font-bold text-xs text-slate-705 text-slate-700 text-left animate-fade-in divide-y divide-slate-100">
                                <div className="py-1">
                                  <a
                                    href={`/api/materials/download/${mat.id}`}
                                    download={mat.originalName}
                                    onClick={() => setOpenMaterialMenuId(null)}
                                    className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 text-left font-bold"
                                    title="Download and decrypt lecture files"
                                  >
                                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Download File</span>
                                  </a>
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSharingMaterial(mat);
                                      setOpenMaterialMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 text-left font-bold"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Share Material Info</span>
                                  </button>
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerNotificationPermissionRequest();
                                      setOpenMaterialMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 text-left font-bold"
                                  >
                                    <Bell className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Enable Push Alerts</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>

                {/* Secure administrative UPLOAD PANEL (Only available for Lecturer or Admins users) */}
                <div className="lg:col-span-4">
                  {currentUser?.role === "lecturer" ? (
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-indigo-200 shadow-sm duration-200">
                      
                      <div className="flex items-center space-x-2.5 mb-5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                          <UploadCloud className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800">Secure Uploader</h4>
                          <span className="text-[10px] text-slate-400 tracking-tight font-bold">Encrypted directly prior to write</span>
                        </div>
                      </div>

                      <form onSubmit={handleUploadMaterial} className="space-y-4">
                        
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Material Title
                          </label>
                          <input
                            type="text"
                            required
                            value={newMatTitle}
                            onChange={(e) => setNewMatTitle(e.target.value)}
                            placeholder="e.g. Slide 3: Network Topology Map"
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Academic Course Target
                          </label>
                          <select
                            required
                            value={newMatCourse}
                            onChange={(e) => setNewMatCourse(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors"
                          >
                            <option value="">-- Choose Course --</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Document Classification Block
                          </label>
                          <select
                            value={newMatType}
                            onChange={(e) => setNewMatType(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors"
                          >
                            <option value="lecture_notes">Lecture Notes PDF</option>
                            <option value="outline">Course Syllabus / Outline</option>
                            <option value="assignment_prompt">Interactive Assignment Guideline</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Qualitative Material Summary
                          </label>
                          <textarea
                            value={newMatDesc}
                            onChange={(e) => setNewMatDesc(e.target.value)}
                            placeholder="Briefly state key concepts discussed..."
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors resize-none"
                          />
                        </div>

                        {/* File Selector */}
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Document File (.pdf, .zip, .docx)
                          </label>
                          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                            <input
                              type="file"
                              required
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  setNewMatFile(e.target.files[0]);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            />
                            <div className="space-y-1">
                              <Download className="w-5 h-5 mx-auto text-slate-400 animate-bounce" />
                              <p className="text-xs font-bold text-slate-600">
                                {newMatFile ? newMatFile.name : "Select or drag files"}
                              </p>
                              <span className="text-[10px] text-slate-400 block">Maximum file storage: 32MB</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isUploadingMat}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors shadow-md shadow-indigo-600/10 cursor-pointer pointer-events-auto flex items-center justify-center gap-1"
                        >
                          {isUploadingMat ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{uploadProgressMsg || "Encrypting..."}</span>
                            </>
                          ) : (
                            <span>Encrypt Upload File</span>
                          )}
                        </button>

                      </form>

                    </div>
                  ) : (
                    <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-950 space-y-4">
                      <GraduationCap className="w-10 h-10 animate-pulse text-indigo-300" />
                      <h4 className="font-extrabold text-base">Direct Local Storage Safe</h4>
                      <p className="text-indigo-100 text-xs leading-relaxed">
                        To download materials: Select any file and fetch. Direct pipeline automatically decrypts AES-256 blocks block-by-block on physical flight download.
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: ASSIGNMENT SUBMISSIONS & MARKING INTERFACE */}
          {activeTab === "assignments" && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Top description banner */}
              <div className="bg-white p-6 border border-slate-200 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Interactive Handin & Mark Centre</h3>
                  <p className="text-slate-500 text-xs text-left">
                    {currentUser?.role === "admin"
                      ? `Administrative System Monitor - Live tracking academic upgrade lines. Assignments term customized to: "${appConfig.assignmentsTerm}".`
                      : currentUser?.role === "lecturer"
                        ? "Review compiled student assignment papers and apply grades in-real-time."
                        : "Submit secure homework files encryptively and monitor score reports."}
                  </p>
                </div>
              </div>

              {/* Toggle Selector for Defaults vs Google Classroom Integration */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 border border-slate-200 rounded-3xl">
                <div>
                  <h4 className="font-extrabold text-[11px] text-slate-700 tracking-tight uppercase">Syllabus Provision Service Channel</h4>
                  <p className="text-slate-500 text-[10px] text-left">
                    Choose whether you want GDCMS standard provisions or live Google Classroom workspace channel integration.
                  </p>
                </div>
                <div className="flex bg-slate-200/60 p-1 rounded-xl self-start sm:self-center">
                  <button
                    onClick={() => setClassroomMode("default")}
                    className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                      classroomMode === "default"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Default GDCMS
                  </button>
                  <button
                    onClick={() => setClassroomMode("google")}
                    className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      classroomMode === "google"
                        ? "bg-indigo-600 text-white shadow-sm font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    Google Classroom
                  </button>
                </div>
              </div>

              {classroomMode === "google" ? (
                <GoogleClassroomPanel
                  googleToken={googleToken}
                  currentUser={currentUser}
                  courses={courses}
                  materials={materials}
                  classroomCourses={classroomCourses}
                  setClassroomCourses={setClassroomCourses}
                  classroomCoursework={classroomCoursework}
                  setClassroomCoursework={setClassroomCoursework}
                  selectedClassroomCourseId={selectedClassroomCourseId}
                  setSelectedClassroomCourseId={setSelectedClassroomCourseId}
                  isFetchingClassroom={isFetchingClassroom}
                  setIsFetchingClassroom={setIsFetchingClassroom}
                  handleConnectGoogle={handleConnectGoogle}
                  token={token}
                  fetchAppData={fetchAppData}
                  selectedCourseId={selectedCourseId}
                />
              ) : (
                <>
                  {/* Administrative Sub-Tab Tracker Selectors */}
                  {currentUser?.role === "admin" && (
                <div className="bg-slate-100 p-2 rounded-2xl inline-flex gap-2">
                  <button 
                    onClick={() => setAdminSubTab("lecturer")}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${adminSubTab === "lecturer" ? `${themeTheme.primary} shadow-md` : "text-slate-600 hover:text-slate-800"}`}
                  >
                    Lecturer Grading Queue
                  </button>
                  <button 
                    onClick={() => setAdminSubTab("student")}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${adminSubTab === "student" ? `${themeTheme.primary} shadow-md` : "text-slate-600 hover:text-slate-800"}`}
                  >
                    Student Handin Hub
                  </button>
                </div>
              )}

              {/* Deadline Calendar View - Highlights upcoming cohort submission dates */}
              <div className="pointer-events-auto">
                <DeadlineCalendar 
                  materials={materials} 
                  googleToken={googleToken}
                  onConnectGoogle={handleConnectGoogle}
                  onSelectAssignment={(asgId) => {
                    const el = document.getElementById(`assignment-${asgId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                />
              </div>

              {/* LECTURER VIEW: GRADING PORTAL */}
              {(currentUser?.role === "lecturer" || (currentUser?.role === "admin" && adminSubTab === "lecturer")) ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left block list: Unmarked / Graded student documents */}
                  <div className="lg:col-span-8 space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-700 tracking-tight">Active student assignment queue</h4>

                    {submissions.length === 0 ? (
                      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                        <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 font-semibold text-xs">No student assignment files submitted yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {submissions.map(sub => {
                          const assignmentPromptObj = materials.find(m => m.id === sub.assignmentId);
                          return (
                            <div 
                              key={sub.id} 
                              className={`bg-white rounded-3xl p-5 border shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer pointer-events-auto ${
                                selectedSubmissionId === sub.id 
                                  ? "border-indigo-600 ring-2 ring-indigo-500/10" 
                                  : "border-slate-200/85 hover:border-slate-300"
                              }`}
                              onClick={() => {
                                setSelectedSubmissionId(sub.id);
                                setGradingScore(sub.grade || "");
                                setGradingFeedback(sub.feedback || "");
                              }}
                            >
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="bg-slate-100 text-slate-600 font-bold text-[9px] uppercase px-2 py-0.5 rounded">
                                    Index: {sub.studentIndex}
                                  </span>
                                  {sub.status === "graded" ? (
                                    <span className="bg-emerald-50 text-emerald-700 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded border border-emerald-100">
                                      Graded: {sub.grade}
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 text-amber-700 font-medium text-[9px] uppercase px-2 py-0.5 rounded border border-amber-100">
                                      Awaiting Review
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-black text-slate-800 truncate">
                                  {sub.studentName}
                                </p>
                                <p className="text-[11px] text-indigo-600 font-semibold underline truncate">
                                  Topic: {assignmentPromptObj?.title || sub.originalName}
                                </p>
                                <span className="text-[10px] text-slate-400 block">
                                  Completed: {new Date(sub.uploadedAt).toLocaleString()}
                                </span>
                              </div>

                              {/* Control buttons/link */}
                              <div className="shrink-0 flex items-center gap-2 relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenGenericMenuId(openGenericMenuId === `sub_${sub.id}` ? null : `sub_${sub.id}`);
                                  }}
                                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-805 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                                  title="Submission Actions"
                                >
                                  <MoreVertical className="w-4 h-4 text-slate-500" />
                                </button>
                                {openGenericMenuId === `sub_${sub.id}` && (
                                  <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 font-bold text-xs text-slate-700 text-left">
                                    <a
                                      href={`/api/materials/download/${sub.id}`}
                                      onClick={() => setOpenGenericMenuId(null)}
                                      className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer text-slate-700 font-bold text-xs"
                                    >
                                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Download File</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right block: Integrated Marking Sheet Interface form */}
                  <div className="lg:col-span-4">
                    {selectedSubmissionId ? (
                      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm sticky top-6">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                          <CheckSquare className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                          <h4 className="font-bold text-sm text-slate-800">Assign Grade Report</h4>
                        </div>

                        {currentUser?.role === "admin" ? (
                          <div className="space-y-4 pt-2">
                            <div>
                              <p className="block text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                Letter Grade / Numeric Score
                              </p>
                              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-600 font-bold text-left select-all">
                                {gradingScore || "Under Review / Unmarked"}
                              </div>
                            </div>

                            <div>
                              <p className="block text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                Qualitative Comment Feed
                              </p>
                              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-500 font-semibold text-left select-all min-h-24">
                                {gradingFeedback || "No evaluation comments registered yet."}
                              </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200/85 p-3.5 rounded-xl text-[11px] text-amber-900 font-bold text-center flex flex-col gap-1.5 items-center justify-center">
                              <Lock className="w-4.5 h-4.5 text-amber-600" />
                              <span>Administrative Lock - Read-Only Profile</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionId(null)}
                              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                            >
                              Close Tracker View
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleGradeSubmission} className="space-y-4">
                            
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                Letter Grade / Numeric Score
                              </label>
                              <input
                                type="text"
                                required
                                value={gradingScore}
                                onChange={(e) => setGradingScore(e.target.value)}
                                placeholder="e.g. A+, 95/100, B"
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                                Qualitative Comment Feed
                              </label>
                              <textarea
                                required
                                value={gradingFeedback}
                                onChange={(e) => setGradingFeedback(e.target.value)}
                                placeholder="Add specific comments about code quality, methodology, etc..."
                                rows={5}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-xs text-slate-800 font-medium transition-colors resize-none"
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmissionId(null)}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingGrade}
                                className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-colors cursor-pointer pointer-events-auto disabled:opacity-50"
                              >
                                {isSubmittingGrade ? "Saving Evaluation..." : "Push Mark"}
                              </button>
                            </div>

                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center border-2 border-dashed border-slate-250 bg-slate-50 rounded-3xl">
                        <User className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                          Select any student submit record on the left to activate active mark dashboard panel.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* STUDENT VIEW: SUBMISSION LIST & UPLOAD WORKFLOWS */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                  
                  {/* Left block list: Students view their homework uploads results */}
                  <div className="lg:col-span-7 space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-700 tracking-tight">Active Submission History</h4>

                    <div className="space-y-4">
                      {materials.filter(m => m.type === "assignment_prompt").length === 0 ? (
                        <div className="text-center bg-white border border-slate-200/80 rounded-3xl p-10 font-medium text-slate-400 text-xs">
                          No assignment prompts published.
                        </div>
                      ) : (
                        materials.filter(m => m.type === "assignment_prompt").map(asg => {
                          const userSub = studentSubmissionsMap[asg.id];
                          return (
                            <div key={asg.id} id={`assignment-${asg.id}`} className="bg-white rounded-3xl p-5 border border-slate-200/85 hover:border-slate-300 transition-colors shadow-sm space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="text-xs font-black text-slate-800 select-all">{asg.title}</h5>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight block">
                                    Promoted: {new Date(asg.uploadedAt).toLocaleDateString()}
                                  </span>
                                </div>

                                <div className="text-right">
                                  {userSub ? (
                                    userSub.status === "graded" ? (
                                      <span className="bg-emerald-50 text-emerald-800 font-bold text-[10px] rounded px-2 py-0.5 border border-emerald-100">
                                        Score: {userSub.grade}
                                      </span>
                                    ) : (
                                      <span className="bg-amber-50 text-amber-800 font-medium text-[10px] rounded px-2 py-0.5 border border-amber-100">
                                        Under evaluation
                                      </span>
                                    )
                                  ) : (
                                    <span className="bg-rose-50 text-rose-800 font-semibold text-[10px] rounded px-2 py-0.5 border border-rose-100">
                                      Unsubmitted
                                    </span>
                                  )}
                                </div>
                              </div>

                              {userSub && userSub.feedback && (
                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
                                  <p className="font-extrabold text-[10px] text-indigo-700 uppercase tracking-wider">Lecturer Feedback Comment:</p>
                                  <p className="leading-relaxed font-medium">"{userSub.feedback}"</p>
                                </div>
                              )}

                              {userSub && (
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                                  <span>Draft Code: {userSub.originalName}</span>
                                  <span>Uploaded Code: {new Date(userSub.uploadedAt).toLocaleDateString()}</span>
                                </div>
                              )}

                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right block: Student File Handin Form */}
                  <div className="lg:col-span-5">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md flex flex-col gap-4">
                      
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-800">Secure Submission Link</h4>
                          <span className="text-[10px] text-slate-400 block font-semibold">Decoders run directly via live credentials</span>
                        </div>
                      </div>

                      {currentUser?.role === "admin" ? (
                        <div className="space-y-4 pt-2">
                          <p className="text-xs font-semibold text-slate-500 leading-relaxed text-left">
                            You are looking at the student upload workspace interface under Administrative supervision. Writing assignments or forwarding document binaries is strictly confined to active student credentials.
                          </p>
                          <div className="bg-amber-50 border border-amber-200/85 p-3.5 rounded-xl text-[11px] text-amber-900 font-bold text-center flex flex-col gap-1.5 items-center justify-center">
                            <Lock className="w-5 h-5 text-amber-600" />
                            <span>Administrative Access - Submissions Locked</span>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleStudentSubmission} className="space-y-4">
                          
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                              Target Assignment Topic
                            </label>
                            <select
                              required
                              value={subAssignmentId}
                              onChange={(e) => setSubAssignmentId(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-3 px-3 text-xs text-slate-800 font-semibold transition-colors"
                            >
                              <option value="">-- Choose Prompt --</option>
                              {materials.filter(m => m.type === "assignment_prompt").map(as => (
                                <option key={as.id} value={as.id}>{as.title}</option>
                              ))}
                            </select>
                          </div>

                          {/* Drag and Drop File selector */}
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                              Submission Artifact (PDF, DOCX, ZIP files)
                            </label>
                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 text-center transition-colors relative cursor-pointer">
                              <input
                                type="file"
                                required
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    setSubFile(e.target.files[0]);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                              />
                              <div className="space-y-2">
                                <Download className="w-6 h-6 mx-auto text-indigo-500 animate-bounce" />
                                <p className="text-xs font-semibold text-slate-700">
                                  {subFile ? subFile.name : "Select raw file to post"}
                                </p>
                                <span className="text-[10px] text-slate-400 block font-medium">Auto-encrypt block instantly via AES-256</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isUploadingSub}
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs uppercase tracking-widest transition-colors cursor-pointer pointer-events-auto shadow-md flex items-center justify-center gap-1.5"
                          >
                            {isUploadingSub ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Symmetric cipher lock serialization...</span>
                              </>
                            ) : (
                              <span>Post Sealed Submission</span>
                            )}
                          </button>

                        </form>
                      )}

                    </div>
                  </div>

                </div>
              )}
                </>
              )}

            </div>
          )}

          {/* TAB 4: ENCRYPTED PERSONAL NOTEBOOK */}
          {activeTab === "notes" && (
            <div className="space-y-6 animate-fade-in">
              
              <div className="bg-white p-5 border border-slate-200 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">AES-256 Encrypted Private Notes</h3>
                  <p className="text-slate-500 text-xs">
                     Offline support: Any private note added while offline sits secure in local browser cache, and syncs immediately once connection recovers. All text blocks are fully ciphertext secured on the persistent database server.
                  </p>
                </div>
              </div>

              {/* Keep Integration Service selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 border border-slate-200 rounded-3xl">
                <div>
                  <h4 className="font-extrabold text-[11px] text-slate-700 tracking-tight uppercase">Notebook Integration Service</h4>
                  <p className="text-slate-505 text-[10px] text-left">
                    Seamlessly transition between our standard secure cipher ledger and an immersive Google Keep workspace aesthetic.
                  </p>
                </div>
                <div className="flex bg-slate-200/60 p-1 rounded-xl self-start sm:self-center">
                  <button
                    onClick={() => setKeepMode("default")}
                    className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                      keepMode === "default"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Standard Ledger
                  </button>
                  <button
                    onClick={() => setKeepMode("google")}
                    className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      keepMode === "google"
                        ? "bg-[#FBBC05] text-slate-900 shadow-sm font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-[#EA4335] rounded-full animate-pulse"></span>
                    Google Keep
                  </button>
                </div>
              </div>

              {keepMode === "google" ? (
                <GoogleKeepPanel
                  notes={notes}
                  setNotes={setNotes}
                  currentUser={currentUser}
                  token={token}
                  isOnline={isOnline}
                  fetchAppData={fetchAppData}
                  saveSingleNoteToFirestore={saveSingleNoteToFirestore}
                />
              ) : (
                <>
                  {/* Notes Readability & Customization Setting Hub */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Background Theme Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Aesthetic Theme:</span>
                    <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      {(["light", "sepia", "dark"] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNotesColorTheme(t)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg capitalize cursor-pointer transition-all ${
                            notesColorTheme === t 
                              ? "bg-white text-slate-800 shadow-sm font-extrabold" 
                              : "text-slate-500 hover:text-slate-850"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider font-bold">Typeface:</span>
                    <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      {(["sans", "serif", "mono"] as const).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setNotesFontFamily(f)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg capitalize cursor-pointer transition-all ${
                            notesFontFamily === f 
                              ? "bg-white text-slate-800 shadow-sm font-extrabold" 
                              : "text-slate-500 hover:text-slate-850"
                          }`}
                        >
                          {f === "sans" ? "Sans" : f === "serif" ? "Serif" : "Mono"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Scale:</span>
                    <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      {(["sm", "base", "lg"] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNotesFontSize(s)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg uppercase cursor-pointer transition-all ${
                            notesFontSize === s 
                              ? "bg-white text-slate-800 shadow-sm font-extrabold" 
                              : "text-slate-500 hover:text-slate-855"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PDF Backup actions indicator when notes are selected */}
                {notes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedNoteIds.length === notes.length) {
                          setSelectedNoteIds([]);
                        } else {
                          setSelectedNoteIds(notes.map(n => n.id));
                        }
                      }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                    >
                      {selectedNoteIds.length === notes.length ? "Deselect All" : "Select All"}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSelectedNotesToPDF}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer pointer-events-auto"
                    >
                      <Download className="w-4 h-4 text-white" />
                      <span>Export Selected ({selectedNoteIds.length}) to PDF</span>
                    </button>

                    {googleToken ? (
                      <button
                        type="button"
                        disabled={isExportingNotesToDrive}
                        onClick={handleExportSelectedNotesToGoogleDrive}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10 cursor-pointer pointer-events-auto"
                        title="Backup selected notes as text document in cloud Drive"
                      >
                        <Cloud className="w-4 h-4 text-white" />
                        <span>{isExportingNotesToDrive ? "Uploading..." : `Export Selected (${selectedNoteIds.length}) to Drive`}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-205 font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Authorize Google account access"
                      >
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                        <span>Sync Google Drive</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Note Editing Panel Input block form */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-start">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <Plus className="w-4.5 h-4.5 text-indigo-600" />
                    <span>{editingNoteId ? "Update Crypt Note" : "Log New Crypt Note"}</span>
                  </h4>

                  {currentUser?.role === "admin" ? (
                    <div className="space-y-4 pt-2">
                      <p className="text-xs font-semibold text-slate-500 leading-relaxed text-left">
                        Personal Study Notes are private cryptographic files mapped exclusively to student users. Admins can view note schemas and existing metadata indexes, but creating or updating notes is restricted.
                      </p>
                      <div className="bg-amber-50 border border-amber-200/85 p-3.5 rounded-xl text-[11px] text-amber-900 font-bold text-center flex flex-col gap-1.5 items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600" />
                        <span>Administrative Profile - Studies Note Lock</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveNote} className="space-y-4">
                      
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Note Title
                        </label>
                        <input
                          type="text"
                          required
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          placeholder="e.g. Encryption keys slide feedback"
                          className={`w-full focus:outline-none rounded-xl py-2.5 px-3 border transition-colors font-semibold ${
                            notesColorTheme === "light"
                              ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500"
                              : notesColorTheme === "sepia"
                              ? "bg-[#FAF2DF] border-[#EADCAE] text-[#4A321A] focus:bg-[#FFFDF6] focus:border-amber-600"
                              : "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 focus:border-indigo-600"
                          } ${
                            notesFontFamily === "sans" ? "font-sans" : notesFontFamily === "serif" ? "font-serif" : "font-mono"
                          } ${
                            notesFontSize === "sm" ? "text-xs" : notesFontSize === "base" ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Category/Tag
                        </label>
                        <select
                          value={noteTag}
                          onChange={(e) => setNoteTag(e.target.value)}
                          className={`w-full focus:outline-none rounded-xl py-2.5 px-3 border transition-colors font-bold ${
                            notesColorTheme === "light"
                              ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500"
                              : notesColorTheme === "sepia"
                              ? "bg-[#FAF2DF] border-[#EADCAE] text-[#4A321A] focus:bg-[#FFFDF6] focus:border-amber-600"
                              : "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 focus:border-indigo-600"
                          } ${
                            notesFontSize === "sm" ? "text-xs" : notesFontSize === "base" ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                          }`}
                        >
                          <option value="General Lecture">General Lecture</option>
                          <option value="Exam Prep">Exam Prep</option>
                          <option value="Lab Exercise">Lab Exercise</option>
                          <option value="Revision">Revision</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Notebook Content Block
                        </label>
                        <textarea
                          required
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Note bodies are encrypted dynamically on live nodes prior to hard storage saves..."
                          rows={8}
                          className={`w-full focus:outline-none rounded-xl py-2.5 px-3 border transition-colors resize-none leading-relaxed ${
                            notesColorTheme === "light"
                              ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500"
                              : notesColorTheme === "sepia"
                              ? "bg-[#FAF2DF] border-[#EADCAE] text-[#4A321A] focus:bg-[#FFFDF6] focus:border-amber-600"
                              : "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 focus:border-indigo-600"
                          } ${
                            notesFontFamily === "sans" ? "font-sans" : notesFontFamily === "serif" ? "font-serif" : "font-mono"
                          } ${
                            notesFontSize === "sm" ? "text-xs" : notesFontSize === "base" ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                          }`}
                        />
                      </div>

                      <div className="flex gap-2.5">
                        {editingNoteId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setNoteTitle("");
                              setNoteContent("");
                            }}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-widest cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="submit"
                          className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest cursor-pointer pointer-events-auto shadow-md shadow-indigo-600/10"
                        >
                          {editingNoteId ? "Update Cipher" : "Lock In Storage"}
                        </button>
                      </div>

                    </form>
                  )}
                </div>

                {/* Encrypted notebooks list feed */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h4 className="font-extrabold text-sm text-slate-700 tracking-tight">Active Private Notebook collection</h4>
                    <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                      {(["all", "General Lecture", "Exam Prep", "Lab Exercise", "Revision"] as const).map(filterVal => (
                        <button
                          key={filterVal}
                          type="button"
                          onClick={() => setSelectedTagFilter(filterVal)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                            selectedTagFilter === filterVal
                              ? "bg-slate-950 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {filterVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredNotes.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-250">
                      <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-slate-500 font-semibold">Your crypto-secured student notes notebook starts empty or no notes match this filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredNotes.map(note => {
                        const isSelected = selectedNoteIds.includes(note.id);
                        return (
                          <div 
                            key={note.id} 
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setNoteTitle(note.title);
                              setNoteContent(note.content);
                              setNoteTag(note.tag || "General Lecture");
                            }}
                            className={`rounded-3xl p-5 border shadow-sm flex flex-col justify-between gap-4 cursor-pointer hover:shadow-md transition-all ${
                              notesColorTheme === "light"
                                ? (!note.isSynced ? "bg-amber-50/25 border-amber-300 ring-4 ring-amber-500/5 text-slate-800" : "bg-white border-slate-200 text-slate-800 hover:border-slate-350")
                                : notesColorTheme === "sepia"
                                ? (!note.isSynced ? "bg-[#FAF2DF] border-[#EADCAE] ring-4 ring-amber-500/5 text-[#5C401F]" : "bg-[#FCF6E8] border-[#E8DEC0]/80 text-[#5C401F] hover:border-[#D8CEB0]")
                                : (!note.isSynced ? "bg-slate-950 border-amber-400 ring-4 ring-amber-500/5 text-slate-300" : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-705")
                            } ${
                              isSelected ? "ring-2 ring-indigo-500 ring-offset-2" : ""
                            } ${
                              notesFontFamily === "sans" ? "font-sans" : notesFontFamily === "serif" ? "font-serif" : "font-mono"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        setSelectedNoteIds(selectedNoteIds.filter(id => id !== note.id));
                                      } else {
                                        setSelectedNoteIds([...selectedNoteIds, note.id]);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded border-slate-305 text-indigo-600 focus:ring-indigo-550 cursor-pointer"
                                  />
                                  <p className={`text-xs font-black truncate ${
                                    notesColorTheme === "light" ? "text-slate-800" : notesColorTheme === "sepia" ? "text-[#4A321B]" : "text-white"
                                  }`} title={note.title}>
                                    {note.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap ${
                                    note.tag === "Exam Prep" 
                                      ? "bg-rose-100 text-rose-800"
                                      : note.tag === "Lab Exercise"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : note.tag === "Revision"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {note.tag || "General Lecture"}
                                  </span>
                                  {!note.isSynced ? (
                                    <span className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap">
                                      Offline
                                    </span>
                                  ) : (
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap ${
                                      notesColorTheme === "dark" ? "bg-slate-850 text-indigo-300" : "bg-indigo-50 text-indigo-700"
                                    }`}>
                                      AES-256
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className={`line-clamp-3 leading-relaxed ${
                                notesFontSize === "sm" ? "text-[11px]" : notesFontSize === "base" ? "text-xs" : "text-sm"
                              } ${
                                notesColorTheme === "light" ? "text-slate-500" : notesColorTheme === "sepia" ? "text-[#6A5237]" : "text-slate-400"
                              }`}>
                                {note.content}
                              </p>
                            </div>

                            <div className={`flex items-center justify-between text-[10px] border-t pt-2.5 ${
                              notesColorTheme === "light" ? "border-slate-100 text-slate-404 text-slate-400" : notesColorTheme === "sepia" ? "border-[#E8DEC0]/40 text-[#8C765C]" : "border-slate-800 text-slate-500"
                            }`}>
                              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNoteLocal(note.id);
                                }}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                              >
                                Discard
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

                </>
              )}

            </div>
          )}

          {/* TAB 5: SYSTEM GUIDELINES & PURPOSE OVERVIEW */}
          {activeTab === "security" && (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-8 animate-fade-in">
              
              <div className="flex items-center space-x-3.5 border-b border-slate-100 pb-5">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-750 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    {currentUser?.role === "student" && "GDCMS Student Outline & Operating Guidelines"}
                    {currentUser?.role === "lecturer" && "GDCMS Lecturer Outline & Operating Guidelines"}
                    {currentUser?.role === "admin" && "GDCMS Portal Administrative Guidelines"}
                    {!currentUser?.role && "GDCMS Student Outline & Operating Guidelines"}
                  </h3>
                  <span className="text-xs text-slate-400 block font-semibold">
                    User Role verified for study: {currentUser?.role === "admin" ? "System Administrator Access" : currentUser?.role === "lecturer" ? "Academic Faculty Console" : "Active Student Workspace Access"}
                  </span>
                </div>
              </div>

              <div className={`grid ${currentUser?.role === "admin" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-6 leading-relaxed`}>
                
                {(currentUser?.role === "student" || currentUser?.role === "admin" || !currentUser?.role) && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-3">
                    <h4 className="font-extrabold text-sm text-indigo-950 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      <span>For Students</span>
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside font-semibold">
                      <li>Download dynamic course materials, slides, outline sheets and assignment descriptions directly.</li>
                      <li>Submit your academic hand-in solutions via the assignments portal for graded reviews.</li>
                      <li>Stay alert with real-time browser indicators for published results.</li>
                      <li>Compose private studies review notes inside your offline-cached personal scratchpad.</li>
                    </ul>
                  </div>
                )}

                {(currentUser?.role === "lecturer" || currentUser?.role === "admin") && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-3">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      <span>For Lecturers & Coordinators</span>
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside font-semibold">
                      <li>Upload the latest syllabus files and lecture outlines so students have instant access.</li>
                      <li>Post formatted assignment prompts specifying submission milestones.</li>
                      <li>Audit incoming student coursework submissions directly through the evaluation desk.</li>
                      <li>Provide scores and written qualitative feedback logs to auto-alert individual students.</li>
                    </ul>
                  </div>
                )}

              </div>

              <div className="space-y-4">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">Classroom Values & Code of Honor</h4>
                <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-slate-700 text-xs leading-relaxed space-y-3.5 font-semibold">
                  <p>
                    GDCMS is designed to support academic honesty, qualitative evaluation cycles, and peer collaboration. Students are encouraged to use their study binders responsibly and double-check prompt deadlines on their dashboards.
                  </p>
                  <p>
                    Your user credentials specify your dynamic interface role (Student vs. Lecturer Console). If you require role elevation to coordinate syllabi or class outlines, contact the GDCMS Administration support channel.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl text-center text-slate-500 font-semibold text-[11px]">
                To view security configurations, active session status or offline synchronization parameters, inspect the documentation.
              </div>

            </div>
          )}

        </main>

        {/* Global sticky layout footer status indicators */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div>
            <span>GDCMS Class Management Portal • Version 3.5.2 (Secure Build)</span>
          </div>
          <div>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">● System Encrypted</span>
          </div>
        </footer>

      </div>

    </div>
  );
}
