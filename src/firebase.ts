import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Course, Material, Submission, PersonalNote, NotificationItem } from "./types";

import firebaseConfig from "../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);

// Initialize Firestore with high-efficiency persistent offline caching and correct Database ID
export const db = initializeFirestore(
  app, 
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

// Authenticate anonymously so we comply with secure security rules
export async function ensureFirebaseAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log("GDCMS: Firebase Auth registered active offline session.");
    } catch (e) {
      console.warn("GDCMS: Firebase authentication warning (normal if offline):", e);
    }
  }
}

// 1. Sync Courses
export async function syncCoursesToFirestore(courses: Course[]) {
  await ensureFirebaseAuth();
  try {
    const batch = writeBatch(db);
    courses.forEach(course => {
      const courseRef = doc(db, "courses", course.id);
      batch.set(courseRef, {
        id: course.id,
        code: course.code,
        name: course.name,
        lecturerId: course.lecturerId,
        description: course.description || "",
        outlineUrl: course.outlineUrl || "",
        outlineName: course.outlineName || ""
      });
    });
    await batch.commit();
    console.log("GDCMS: Synced courses to Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to sync courses to Firestore", err);
  }
}

// 2. Sync Materials
export async function syncMaterialsToFirestore(materials: Material[]) {
  await ensureFirebaseAuth();
  try {
    const batch = writeBatch(db);
    materials.forEach(mat => {
      const matRef = doc(db, "materials", mat.id);
      batch.set(matRef, {
        id: mat.id,
        courseId: mat.courseId,
        title: mat.title,
        description: mat.description || "",
        type: mat.type,
        uploadedBy: mat.uploadedBy,
        uploadedAt: mat.uploadedAt,
        fileKey: mat.fileKey,
        originalName: mat.originalName,
        mimeType: mat.mimeType,
        fileSize: mat.fileSize || 0,
        deadline: mat.deadline || ""
      });
    });
    await batch.commit();
    console.log("GDCMS: Synced materials to Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to sync materials to Firestore", err);
  }
}

// 3. Sync Submissions
export async function syncSubmissionsToFirestore(submissions: Submission[]) {
  await ensureFirebaseAuth();
  try {
    const batch = writeBatch(db);
    submissions.forEach(sub => {
      const subRef = doc(db, "submissions", sub.id);
      batch.set(subRef, {
        id: sub.id,
        assignmentId: sub.assignmentId,
        studentId: sub.studentId,
        studentIndex: sub.studentIndex,
        studentName: sub.studentName,
        fileKey: sub.fileKey,
        originalName: sub.originalName,
        uploadedAt: sub.uploadedAt,
        grade: sub.grade || "",
        feedback: sub.feedback || "",
        gradedBy: sub.gradedBy || "",
        gradedAt: sub.gradedAt || "",
        status: sub.status
      });
    });
    await batch.commit();
    console.log("GDCMS: Synced submissions to Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to sync submissions to Firestore", err);
  }
}

// 4. Sync Personal Notes
export async function syncNotesToFirestore(notes: PersonalNote[]) {
  await ensureFirebaseAuth();
  try {
    const batch = writeBatch(db);
    notes.forEach(note => {
      const noteRef = doc(db, "notes", note.id);
      batch.set(noteRef, {
        id: note.id,
        studentId: note.studentId || "anonymous",
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt,
        tag: note.tag || "General Lecture"
      });
    });
    await batch.commit();
    console.log("GDCMS: Synced notes to Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to sync notes to Firestore", err);
  }
}

// 5. Sync Notifications
export async function syncNotificationsToFirestore(notifications: NotificationItem[]) {
  await ensureFirebaseAuth();
  try {
    const batch = writeBatch(db);
    notifications.forEach(notif => {
      const notifRef = doc(db, "notifications", notif.id);
      batch.set(notifRef, {
        id: notif.id,
        userId: notif.userId || "all",
        title: notif.title,
        message: notif.message,
        type: notif.type || "global",
        createdAt: notif.createdAt,
        isRead: notif.isRead || false
      });
    });
    await batch.commit();
    console.log("GDCMS: Synced notifications to Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to sync notifications to Firestore", err);
  }
}

// Offline loaders that query local Firestore cache
export async function getOfflineCourses(): Promise<Course[]> {
  await ensureFirebaseAuth();
  const querySnapshot = await getDocs(collection(db, "courses"));
  const courses: Course[] = [];
  querySnapshot.forEach(doc => {
    courses.push(doc.data() as Course);
  });
  return courses;
}

export async function getOfflineMaterials(): Promise<Material[]> {
  await ensureFirebaseAuth();
  const querySnapshot = await getDocs(collection(db, "materials"));
  const m: Material[] = [];
  querySnapshot.forEach(doc => {
    m.push(doc.data() as Material);
  });
  return m;
}

export async function getOfflineSubmissions(): Promise<Submission[]> {
  await ensureFirebaseAuth();
  const querySnapshot = await getDocs(collection(db, "submissions"));
  const s: Submission[] = [];
  querySnapshot.forEach(doc => {
    s.push(doc.data() as Submission);
  });
  return s;
}

export async function getOfflineNotes(): Promise<PersonalNote[]> {
  await ensureFirebaseAuth();
  const querySnapshot = await getDocs(collection(db, "notes"));
  const n: PersonalNote[] = [];
  querySnapshot.forEach(doc => {
    n.push({
      ...doc.data(),
      isSynced: true // They are synced in the offline firestore layer
    } as PersonalNote);
  });
  return n;
}

export async function getOfflineNotifications(): Promise<NotificationItem[]> {
  await ensureFirebaseAuth();
  const querySnapshot = await getDocs(collection(db, "notifications"));
  const notifications: NotificationItem[] = [];
  querySnapshot.forEach(doc => {
    notifications.push(doc.data() as NotificationItem);
  });
  return notifications;
}

export async function saveSingleNoteToFirestore(note: PersonalNote) {
  await ensureFirebaseAuth();
  try {
    const noteRef = doc(db, "notes", note.id);
    await setDoc(noteRef, {
      id: note.id,
      studentId: note.studentId || "anonymous",
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt,
      tag: note.tag || "General Lecture"
    });
    console.log("GDCMS: Saved single note to Firestore.", note.id);
  } catch (e) {
    console.warn("GDCMS: Local FireStore save single note failed (normal if offline but will queue):", e);
  }
}

export async function deleteSingleNoteFromFirestore(noteId: string) {
  await ensureFirebaseAuth();
  try {
    const noteRef = doc(db, "notes", noteId);
    await deleteDoc(noteRef);
    console.log("GDCMS: Deleted single note from Firestore.", noteId);
  } catch (e) {
    console.warn("GDCMS: FireStore delete single note failed (will queue):", e);
  }
}

// 6. Sync / Seed Trial and Registered Users to Firestore
export async function seedTrialUsersToFirestore() {
  await ensureFirebaseAuth();
  try {
    const trials = [
      {
        id: "student_1",
        indexNumber: "BC/ITN/25/147",
        fullName: "Clement Koffie",
        email: "koffieclement12@gmail.com",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_2",
        indexNumber: "BC/ITN/25/112",
        fullName: "Sarah Jenkins",
        email: "sarah.j@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_3",
        indexNumber: "BC/ITN/25/115",
        fullName: "Alex Rivera",
        email: "alex.r@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_4",
        indexNumber: "BC/ITN/25/119",
        fullName: "Jordan Vance",
        email: "jordan.v@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_5",
        indexNumber: "BC/ITN/25/122",
        fullName: "Taylor Swift",
        email: "taylor.s@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_6",
        indexNumber: "BC/ITN/25/133",
        fullName: "Daniel Craig",
        email: "daniel.c@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_7",
        indexNumber: "BC/ITN/25/154",
        fullName: "Elena Rostova",
        email: "elena.r@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_8",
        indexNumber: "BC/ITN/25/177",
        fullName: "Fatima Al-Sayed",
        email: "fatima.as@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_9",
        indexNumber: "BC/ITN/25/188",
        fullName: "Marcus Aurelius",
        email: "marcus.a@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "student_10",
        indexNumber: "BC/ITN/25/199",
        fullName: "Zoe Kravitz",
        email: "zoe.k@student.edu",
        role: "student",
        oauthConnected: false
      },
      {
        id: "lecturer_1",
        indexNumber: "L-9001",
        fullName: "Dr. Emmanuel Vance",
        email: "emmanuel.vance@gdcms.edu",
        role: "lecturer",
        oauthConnected: true
      },
      {
        id: "lecturer_2",
        indexNumber: "L-9002",
        fullName: "Prof. Alan Turing",
        email: "alan.turing@gdcms.edu",
        role: "lecturer",
        oauthConnected: false
      },
      {
        id: "lecturer_3",
        indexNumber: "L-9003",
        fullName: "Dr. Grace Hopper",
        email: "grace.hopper@gdcms.edu",
        role: "lecturer",
        oauthConnected: false
      },
      {
        id: "admin_1",
        indexNumber: "A-0001",
        fullName: "Admin Coordinator",
        email: "admin@gdcms.edu",
        role: "admin",
        oauthConnected: false
      },
      {
        id: "admin_2",
        indexNumber: "A-0002",
        fullName: "Secondary Admin Coordinator",
        email: "admin2@gdcms.edu",
        role: "admin",
        oauthConnected: false
      }
    ];
    
    const batch = writeBatch(db);
    trials.forEach(u => {
      const uRef = doc(db, "users", u.id);
      batch.set(uRef, {
        id: u.id,
        indexNumber: u.indexNumber,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        oauthConnected: u.oauthConnected
      });
    });
    await batch.commit();
    console.log("GDCMS: 15 system accounts successfully exported and synchronous-locked in Firebase Firestore.");
  } catch (err) {
    console.warn("GDCMS: Failed to seed trial users to Firestore", err);
  }
}

