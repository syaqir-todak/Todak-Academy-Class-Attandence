# Todak Academy — Classroom Attendance System

A serverless, real-time classroom QR attendance web application built for **Todak Academy**. Instructors project a rotating QR code in class, students sign in with Google and scan simultaneously with zero queues, and attendance automatically tracks toward the **80% Competency Unit (CU) exam eligibility requirement**.

---

## Key Features

- **Simultaneous QR Clock-In (`Student Check-In`)**: Every student in the classroom scans the active QR code using their phone camera (`html5-qrcode`) or by pasting/opening the check-in link—no queues or shared tablets required.
- **Rolling QR Protection & One-Account-Per-Phone Lock**:
  - Timed QR rotation (`15s`, `30s`, `60s`, or manual) with a 1-step previous-token grace window prevents screenshot sharing.
  - Per-session `deviceLocks` enforce one Google account per device per class session, while atomic Firestore batch writes ensure `attendance` and `deviceLocks` succeed together.
- **Classroom Attendee Projector Mode (`Classroom Attendee`)**: Fullscreen projector view with live countdown, QR sequence number, real-time check-in count, and sortable/searchable attendance roster.
- **Instructor Console (`Instructor Console`)**:
  - **Program & CU Classes**: Create and manage sessions tied to a Course, Competency Unit / Module, Batch, Week, Room/Lab, and Date.
  - **Standalone / General Classes**: Create ad-hoc classes without attaching a program/CU (e.g., *Short Course*, *Part-Time Course*, *1-Day Class*, *School Program*, *Workshop*).
  - **80% Exam Eligibility Tracking & Visual Flags**: Green (`Eligible >= 80%`) and Red (`Below 80%`) progress meters and status flags in both the Instructor Console and Student Check-In view, using exact integer 80% thresholds.
  - **CU Setup Table**: Editable per-course curriculum configuration (module code, part/level, name, duration weeks, and target class days excluding semester holidays) persisted in Firestore.
  - **One-Click CSV Exports**:
    - **Session CSV** named with the CU/module title and week number (`{CU} - Week {N}.csv`).
    - **Full CU Compiled Sheet** combining every attendance date across an entire CU/Batch into a single matrix CSV (`H` markers, attended days, target days, `%`, and 80% exam eligibility).
    - **Tab-delimited `H` Copy** for fast pasting into Google Sheets attendance planners.

---

## Supported Courses & Curriculum Defaults

Default schedules (excluding *Cuti Semester* holidays) are preconfigured in `src/utils/attendance.ts` and customizable in **CU Setup**:

1. **DKM 3D Animation Production Operation** (`dkm-3d-animation`) — 18 active modules across 53 active weeks (Cuti Semester 1 & 2 excluded).
2. **DKM Creative Multimedia Development** (`dkm-creative-multimedia`) — 27 active modules (Part 1 & Part 2, excluding Cuti Semester 01–04).
3. **SKM 3D Production Operation Support** (`skm-3d-production-support`) — 15 active modules across 78 active weeks (Cuti Sem 01 & 02 excluded).
4. **SKM 3D Game Assets Production** (`skm-3d-game-assets`) — 16 active modules (excluding Cuti Semester 01 & 02).

> **Taklimat Rule**: All `TAKLIMAT` modules across every course default to **1 target day** (100% / 1 day required) and omit the `(1w)` week suffix in class selection dropdowns.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 8 |
| **Styling & Motion** | Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `motion` |
| **Auth & Database** | Firebase Authentication (Google Sign-In) & Cloud Firestore |
| **QR Code Tools** | `qrcode.react` (client-side SVG generation) & `html5-qrcode` (camera scanning) |
| **Security Linting** | ESLint + `@firebase/eslint-plugin-security-rules` |

---

## Project Structure

```text
├── firebase-applet-config.json   # Public Firebase web app & Firestore DB config
├── firebase-blueprint.json       # Firestore entity schemas & collection definitions
├── firestore.rules               # Hardened Firestore security rules (default-deny)
├── eslint.config.mjs             # ESLint config for Firestore security rules
├── index.html                    # Entry HTML & Google Fonts (Plus Jakarta Sans, Public Sans, JetBrains Mono)
├── public/                       # Static assets (Todak Academy logo)
└── src/
    ├── App.tsx                   # Auth state, role verification, navigation shell & real-time listeners
    ├── firebase.ts               # Firebase initialization, connection check & structured error handler
    ├── types.ts                  # Shared TypeScript interfaces, course IDs, rooms & standalone types
    ├── components/
    │   ├── AuthView.tsx          # Google Sign-In landing screen (preserves scanned QR query params)
    │   ├── StudentCheckInView.tsx# Camera/link QR check-in, CU progress & 80% status cards
    │   ├── InstructorConsoleView.tsx # Session management, logs, CSV exports, CU Progress & CU Setup
    │   ├── KioskView.tsx         # Projector QR display, countdown & live check-in roster
    │   ├── CuEligibilityStatus.tsx # Green/red 80% eligibility flag & progress meter components
    │   └── ErrorBoundary.tsx     # Graceful Firestore/runtime error fallback UI
    ├── services/
    │   └── attendanceService.ts  # Firestore batch writes for sessions, QR rotation, clock-in & CU setup
    └── utils/
        ├── attendance.ts         # Curriculum defaults, 80% integer math, progress & CSV compiler
        └── qr.ts                 # Token generation, QR URL parsing, persistent device ID & date helpers
```

---

## Local Development

### Prerequisites

- **Node.js 20+** (or **Bun**)
- A **Firebase project** with **Google Sign-In** enabled in Firebase Authentication and **Cloud Firestore** provisioned.

### Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3000
npm run dev
```

### Verification Commands

```bash
# TypeScript type-check
npm run lint

# Lint Firestore security rules
npx eslint firestore.rules

# Production static build (outputs to dist/)
npm run build
```

---

## Deployment (Custom Web URL e.g. `todak-academy-class-attendance.web.app`)

Because the app runs entirely on Firebase Auth + Firestore with zero custom backend server in production, you can deploy the static `dist/` folder directly to **Firebase Hosting**, **Vercel**, or **Cloudflare Pages** for a clean web URL:

1. **Build the app**:
   ```bash
   npm run build
   ```
2. **Deploy to Firebase Hosting** (example):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting   # Choose dist as public directory, configure as SPA (rewrite all URLs to /index.html)
   firebase deploy --only hosting,firestore:rules
   ```
3. **Allow Google Sign-In on your new domain**:
   - In **Firebase Console → Authentication → Settings → Authorized domains**, add your custom web domain (e.g., `todak-academy-class-attendance.web.app` or `attendance.todak.com`).
4. **Update QR Base URL in the app**:
   - Open **Instructor Console → Sessions & Logs → QR Base URL** and set it to your deployed origin so projected QR codes open directly on your production domain.

---

## Access Control & Security Notes

- **Admin / Instructor Access**: Granted to verified accounts matching the primary admin email or UIDs registered in the Firestore `/admins/{uid}` collection (read-only from clients; add additional trainers in the Firebase Console).
- **Student Isolation**: Students can only list/read their own `attendance` records (`studentUid == request.auth.uid`), can only read a single `sessions/{sessionId}` document when scanning, and cannot read `/sessions/{sessionId}/private/qrState`.
- **Spreadsheet Export Safety**: CSV cells are escaped for quotes/newlines and prefixed against spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR).
- **Rules Review**: Always review and deploy `firestore.rules` alongside your Firebase project configuration before sharing the app broadly.
