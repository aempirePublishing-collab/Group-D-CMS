# GDCMS — Global Decentralized Coursework Management System

GDCMS is a modern, professional, high-performance academic management hub designed for lecturers and students to manage coursework, upload study materials, track grades, and backup/sync study journals seamlessly.

---

## 🚀 Key Architectural Features

### 1. Dual-Database Mirror Engine
- **Local Relational State (PostgreSQL + Drizzle ORM):** Powers fast relational operations, user cohorts tracking, structure-validated syllabus schemas, and submission rosters.
- **Firebase Firestore Replicas:** Synchronizes records securely to secondary cloud-hosted databases for cross-device synchronization and real-time offline persistence capability.

### 2. Multi-Role Portal Experiences
- **Student Environment:** Seamlessly logs private notebooks, uploads coursework ciphers, visualizes academic charts, tracks syllabus material links, and receives real-time advisories.
- **Lecturer Environment:** Creates coursework files, monitors student hand-ins, evaluates submitted scripts, and publishes assignment grades instantly.
- **System Administrator:** Audits system health indexes, seeds administrative configurations, and broadcasts instant priority safety bulletin banners.

### 3. Google Workspace Security Bridge
- **Google Calendar Integration:** Dynamically pushes and visualizes upcoming syllabus study review timelines / assignment deadlines to the user's primary Google Calendar account.
- **Google Classroom Sync:** Imports active assignments and coursework directly from Classroom into local portfolios.
- **Google Keep Virtual Adapter:** Embeds post-it color sticker notebooks with symmetric note encryption and seamless exports to the real Google Keep app.

---

## 🛠️ Getting Started & Installation

### Environment Setup
Create a `.env` file at the root with the following parameters:
```env
# Google GenAI API Secret Choice
GEMINI_API_KEY="your-gemini-api-key"

# GDCMS Primary Deploy Host URL
APP_URL="http://localhost:3000"

# Google Workspace Integration Service Account Credentials
CLIENT_ID="your-google-oauth-client-id"
CLIENT_SECRET="your-google-oauth-client-secret"
```

### Dependency Installation
```bash
npm install
```

### Dev Server Startup
```bash
npm run dev
```

### Production Bundling
```bash
npm run build
npm start
```

---

## 🛡️ Security & Reliability Policies
- **Symmetric Note Privacy:** Private notebooks and study cards are auto-encrypted on-the-fly before storing securely in databases.
- **Smart Popup Redirection:** To bypass default web browsers' sandboxed popup blockers, GDCMS dynamically intercepts popup blocks, giving users the option to safely login in the active frame.
- **Offline Resiliency:** Full offline support caches changes in local storage when connection is lost and syncs as soon as the client is back online.
