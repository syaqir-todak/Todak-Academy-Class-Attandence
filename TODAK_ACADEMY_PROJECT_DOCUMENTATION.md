# Todak Academy Classroom Attendance System — Complete Project Blueprint & Production Setup Guide

This single document compiles everything built in this project—architecture, packages, visual design, UI screens, anti-cheating & simultaneous-scan engineering, Firestore database schema, security rules, and step-by-step instructions to recreate and deploy your own real production version **without Cloud Run billing**.

---

## 1. System Overview & How It Works

The **Todak Academy Classroom Attendance System** is a real-time, serverless web application designed for classroom projectors, instructors, and students' mobile phones.

- **Zero Backend Server Required**: Everything runs directly between the user's browser and Google **Firebase** (Firebase Authentication + Cloud Firestore). Because there is no custom Node/Express server required in production, you can host the built static site for free on **Firebase Hosting**, **Vercel**, or **Cloudflare Pages**.
- **Free Browser-Based QR Generation & Scanning**:
  - **QR Generator (`qrcode.react`)**: Generates QR SVG codes locally in the browser—unlimited codes, zero API fees.
  - **QR Camera Scanner (`html5-qrcode`)**: Uses the student phone's rear camera locally in the browser—unlimited scans, zero API fees.
- **Role-Based Experience**:
  - **Students** authenticate with Google Sign-In in one tap (automatically capturing verified Google name + email) and see only **Student Check-In** + their own check-in history.
  - **Instructors / Admins** (verified email matching `syaqir@todak.com` or listed in the `/admins/{uid}` Firestore collection) get three views: **Student Check-In**, **Instructor Console**, and **Classroom Attendee**.

---

## 2. Tech Stack & Dependencies

| Layer | Technology / Package | Purpose |
| --- | --- | --- |
| **Framework** | `react` (`^19`), `react-dom`, `typescript` | Component architecture & type safety |
| **Build Tool** | `vite`, `@vitejs/plugin-react` | Fast dev server and static production bundle (`dist/`) |
| **Styling** | `tailwindcss` (`@tailwindcss/vite` v4) | Utility-first layout and Todak green theme |
| **Database & Auth** | `firebase` (`^13`) | Google Sign-In (`firebase/auth`) + real-time `onSnapshot` / atomic `writeBatch` (`firebase/firestore`) |
| **QR Code Display** | `qrcode.react` | Free client-side SVG QR rendering |
| **QR Camera Reader** | `html5-qrcode` | Free mobile camera QR scanning |
| **Icons & Motion** | `lucide-react`, `motion` | Crisp UI icons and smooth QR swap transitions |
| **Security Linting** | `@firebase/eslint-plugin-security-rules`, `eslint` | Validates `firestore.rules` before deployment |

### Required Browser Permission (`metadata.json` / HTTPS)
- Camera access (`camera`) requires serving the app over **HTTPS** in production (automatic on Firebase Hosting, Vercel, Cloudflare Pages, and `localhost`).

---

## 3. Visual Identity, Color Palette & Typography

### Color System (Todak Academy Green + Neutral Slate)
- **Primary Canvas (60%)**: `#F8FAFC` background, `#0F172A` primary ink, `#475569` / `#64748B` muted text.
- **Card Surfaces (30%)**: `#FFFFFF` cards with `1px solid #E2E8F0` hairline borders and `#F1F5F9` segmented tab tracks.
- **Primary Brand Accent (10%)**: Deep Todak Academy Green (WCAG AA compliant with crisp white button text):
  - **Primary Button**: `#3F6212` (hover `#365314`) with `#FFFFFF` text
  - **Active Tab Border & Focus Ring**: `#4D7C0F`
  - **Selected Row / Receipt Tint**: `#F7FEE7` background with `#BEF264` border and `#365314` / `#1A2E05` ink
- **Semantic States**:
  - **Present (`H` / Checked In)**: `#16A34A` badge with white `H` or `#F7FEE7` chip
  - **Paused / Warning**: `#D97706` / `#B45309`
  - **Destructive / End / Error**: `#DC2626` (hover `#B91C1C`)

### Typography (`index.html` + `src/index.css`)
- **Display / Headings**: `Plus Jakarta Sans` (`text-wrap: balance`)
- **Body Copy**: `Public Sans`
- **Timers, Entry Numbers & Sequences**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` so countdown timers and tables never jitter.

### Logo Asset
- Stored in `public/assets/aistudio/NEW_TODAK_ACADEMY_BLACK_ENG_cac8403d.png` (for your real project, place it in `public/assets/todak-logo.png` and reference `/assets/todak-logo.png`).
- Displayed in the sticky top navigation bar and the Google Sign-In landing page.

---

## 4. Application Screens & Features

### A. Navigation Bar (`src/App.tsx`)
- Single-row sticky header (`h-14`):
  - **Left**: Todak Academy logo (clicks back to Console for instructors or Check-In for students).
  - **Center (Instructors Only)**: 3 tabs:
    1. `Student Check-In`
    2. `Instructor Console`
    3. `Classroom Attendee`
  - **Right**: `Sign In` (deep Todak green) or `Sign Out`.
- **Mobile Bottom Bar**: Fixed 3-button bottom navigation on small screens for instructors (`Check-In`, `Console`, `Attendee`).

### B. Sign-In Landing Screen (`src/components/AuthView.tsx`)
- Todak Academy logo, headline (*"Simultaneous classroom QR check-in with zero queues."*), and **Sign in with Google** button.
- Automatically preserves any `?session=...&token=...` URL parameters if a student scanned the QR code with their phone camera before signing in, taking them straight to confirm clock-in after Google login.

### C. Student Check-In View (`src/components/StudentCheckInView.tsx`)
- **Student-only view** (students never see Instructor Console or Classroom Attendee).
- **No GPS check required**: Students scan or paste the link directly inside the classroom.
- **Camera Scanner + Link Fallback**:
  - `Open Camera to Scan QR` launches rear camera (`facingMode: 'environment'`).
  - Manual link paste box (`https://.../?session=...&token=...`) works as fallback if camera permission is blocked.
- **Checks Before Clock-In**:
  1. Verifies session exists, is open (`isOpen === true`), and has not permanently ended (`!isEnded`).
  2. Checks if the student's Google UID already clocked into that session.
  3. Checks `deviceLocks/{sessionId}_{deviceId}` to block another Google account from using the same phone for the same session.
- **Congratulatory Success Receipt**:
  - On successful check-in, displays a green celebration card:
    - *"Congratulations! Thank you for attending class today."*
    - *"Great job showing up—keep the momentum going!"*
    - Plus class title, week, room, trainer name, and QR token sequence number.
- **Your Clock-In History**: Right-hand list of the student's past verified clock-ins.

### D. Instructor Console (`src/components/InstructorConsoleView.tsx`)
- **Left Sidebar — Class Sessions & History**:
  - **New Class Form**:
    - `Trainer Name` (defaults to logged-in instructor's Google name)
    - `Class / Lab` dropdown with all 11 Todak Academy rooms: `Jaka`, `Ratna`, `Rakai`, `Wana`, `Menjaya`, `Remaung`, `Shima`, `Pungga`, `Gana`, `Siong`, `Auditorium`
    - `Week` free-text input (e.g., `Week 1`, `W04`)
    - `Session Class Title` (min 2 chars, max 120 chars)
    - `Date` (`YYYY-MM-DD`, defaults to today)
  - **Active vs History Segmented Tabs**:
    - `Active` shows ongoing classes (`!isEnded`).
    - `History` shows ended classes (`isEnded === true`) sorted newest-ended first, with a **Filter by Week** dropdown populated dynamically from archived session weeks.
- **Right Main Panel — Session Management & Google Sheet Export**:
  - **Top Action Buttons**: `Open Classroom Attendee`, `Edit Class` (inline edit with the same Room dropdown + Week + Date + Title + Trainer), `Pause / Resume Session`, `End Class` (two-step confirm), `Delete` (trash icon).
  - **Classroom QR Settings Box** (moved here from the projector view):
    - `Auto-Refresh` dropdown (`Every 15s`, `Every 30s`, `Every 60s`, `Manual Only`) saved to Firestore (`autoRotateSeconds`) so Classroom Attendee updates in real time.
    - `Rotate QR Now` button (generates a fresh token immediately while keeping the prior token valid for 1 cycle).
    - `QR Base URL` field (when needed in preview/staging environments).
  - **Attendance Log & Google Sheet (*Rekod Kehadiran Pelajar*) Integration**:
    - Search bar by student name or email.
    - Table columns: `Date`, `Student Name`, `Email`, `Sheet Mark` (green **`H`** badge matching *Hadir*), `Clock-In Time`, and `Remove` (which deletes the attendance record AND unlocks that phone's `deviceLock` if an instructor needs to reset a student's mistake).
    - **`Copy H Markers`** button: Copies tab-separated `Student Name<TAB>H` lines to the clipboard so the instructor can paste directly into Google Sheets.
    - **`Download CSV`** button: Exports a clean 2-column UTF-8 CSV (`Date,Student Name`) ready for spreadsheet import.

### E. Classroom Attendee Projector View (`src/components/KioskView.tsx`)
- **Streamlined Toolbar**:
  - Active Class selector dropdown
  - `Pause Class` / `Resume Class`
  - `Copy Link`
  - `End Class` (with inline confirmation)
  - `Fullscreen` (`Exit Fullscreen` when active)
- **Left QR Panel**:
  - Shows `QR Sequence #N`, live countdown (`Refreshes in Xs` in Todak green tabular monospace), and the scannable QR code (`qrcode.react`).
  - Clean layout without cluttering tagline text or bottom token strings.
- **Right Session Panel**:
  - Room, Week badge, Trainer Name, Class Date, Status, and Class Title (clean without extra embedded logo or bottom device-lock notice).
  - Live counters (`Students Clocked In`, `Current QR Code` sequence).
  - `Latest Student Check-In` card showing name, email, sequence, and timestamp.
- **Detailed Attendance Roster Table**:
  - Search filter + `Time of Entry: Earliest / Latest` sort toggle.
  - Columns: `#` (entry order), `Student Name`, `Email`, `Status` (`Checked In` green badge), `QR Seq`, `Time of Entry`.

---

## 5. Key Engineering Solutions (Why Everything Works Together)

### 1. Simultaneous Scanning With Zero Queues
- **Original Problem**: If QR tokens are invalidated by the *first student* who scans, 20 students scanning at the same time block or fail each other.
- **Solution**:
  - Students **never modify** `/sessions/{sessionId}/private/qrState`. Only the instructor's Classroom Attendee timer or `Rotate QR Now` button rotates tokens.
  - When rotating from Token A -> Token B, the system saves `activeToken = B` and `previousToken = A`.
  - Firestore rules allow a student to check in if `incoming().tokenUsed == activeToken || incoming().tokenUsed == previousToken`. That gives students scanning right as the timer ticks over a 1-cycle grace window while preventing old screenshots from working later.
  - Each student writes atomically (`writeBatch`) to their own `attendance/{sessionId}_{studentUid}` and `deviceLocks/{sessionId}_{deviceId}`, so 50 students scanning in the exact same second never collide.

### 2. Blocking 1 Phone / Multiple Google Accounts Cheating
- **Solution (`src/utils/qr.ts` + Firestore `deviceLocks`)**:
  - `getOrCreatePersistentDeviceId()` generates a unique device ID (`dev_...`) and mirrors it across **three** browser stores (`localStorage`, `IndexedDB`, and a 1-year cookie). Clearing one store restores it from the others.
  - When Student A clocks in on a phone, the atomic batch writes both `attendance/{sessionId}_{studentA_uid}` and `deviceLocks/{sessionId}_{deviceId}` with `studentUid = studentA_uid`.
  - Firestore `existsAfter` + `getAfter` rules force both documents to be written together or both fail.
  - If Student B logs into Google on that same phone and scans the QR code, `deviceLocks/{sessionId}_{deviceId}` already exists and is immutable (`allow update: if false`), so Student B is blocked both in the UI and at the Firestore database security layer.
  - Instructors can reset a legitimate error using `Remove` on Student A's row, which deletes both the attendance record and the `deviceLock`.

---

## 6. Database Schema & Complete Firestore Security Rules

### Collections
1. `/sessions/{sessionId}`
   - `trainerName` (`string`, 1..100)
   - `classLab` (`string`, 1..64)
   - `title` (`string`, 2..120)
   - `week` (`string`, optional, 0..40)
   - `sessionDate` (`string`, optional, `YYYY-MM-DD`)
   - `autoRotateSeconds` (`number`, optional, `0 | 15 | 30 | 60`)
   - `instructorUid` (`string`, UID)
   - `isOpen` (`boolean`)
   - `isEnded` (`boolean`, optional)
   - `tokenSequence` (`number`, >= 1)
   - `createdAt`, `updatedAt`, `endedAt` (`timestamp`)
2. `/sessions/{sessionId}/private/qrState`
   - Readable/writable **only** by admins so students cannot query secret tokens without scanning the projector.
   - `sessionId`, `instructorUid`, `activeToken`, `previousToken` (optional), `tokenSequence`, `updatedAt`.
3. `/attendance/{sessionId}_{studentUid}`
   - Immutable student check-in records (`allow update: if false`).
   - `sessionId`, `trainerName`, `classLab`, `sessionTitle`, `instructorUid`, `studentUid`, `studentName`, `studentEmail`, `deviceId`, `tokenUsed`, `tokenSequence`, `checkedInAt`.
4. `/deviceLocks/{sessionId}_{deviceId}`
   - Immutable per-session device lock (`allow update: if false`).
   - `sessionId`, `deviceId`, `studentUid`, `studentName`, `lockedAt`.
5. `/admins/{uid}`
   - Optional collection of additional instructor UIDs (`{ email: "..." }`). Locked against client writes; manage via Firebase Console.

### Complete `firestore.rules` (Ready for Your Real Firebase Project)
> Replace `'syaqir@todak.com'` in `isAdmin()` if you want a different primary admin email, or add extra instructors in the `/admins/{uid}` collection in Firebase Console.

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function incoming() { return request.resource.data; }
    function existing() { return resource.data; }
    function isSignedIn() { return request.auth != null; }
    function isEmailVerified() { return isSignedIn() && request.auth.token.email_verified == true; }
    function isValidId(id) { return id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$'); }
    function isValidDeviceId(id) { return id is string && id.size() >= 16 && id.size() <= 64 && id.matches('^[a-zA-Z0-9_\\-]+$'); }
    function isValidToken(tok) { return tok is string && tok.size() >= 12 && tok.size() <= 64 && tok.matches('^[a-zA-Z0-9_\\-]+$'); }

    function isAdmin() {
      return isEmailVerified() && (
        request.auth.token.email == 'syaqir@todak.com' ||
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }

    function isSessionNotEnded(data) {
      return !('isEnded' in data) || data.isEnded == false;
    }

    function isValidSession(data) {
      return data.keys().hasAll([
        'trainerName', 'classLab', 'title', 'instructorUid', 'isOpen', 'tokenSequence', 'createdAt', 'updatedAt'
      ]) &&
      data.keys().hasOnly([
        'trainerName', 'classLab', 'title', 'week', 'sessionDate', 'autoRotateSeconds',
        'instructorUid', 'isOpen', 'isEnded', 'tokenSequence', 'createdAt', 'updatedAt', 'endedAt'
      ]) &&
      data.trainerName is string && data.trainerName.size() >= 1 && data.trainerName.size() <= 100 &&
      data.classLab is string && data.classLab.size() >= 1 && data.classLab.size() <= 64 &&
      data.title is string && data.title.size() >= 2 && data.title.size() <= 120 &&
      (!('week' in data) || (data.week is string && data.week.size() <= 40)) &&
      (!('sessionDate' in data) || (data.sessionDate is string && data.sessionDate.size() == 10 && data.sessionDate.matches('^\\d{4}-\\d{2}-\\d{2}$'))) &&
      (!('autoRotateSeconds' in data) || (data.autoRotateSeconds is number && (data.autoRotateSeconds == 0 || data.autoRotateSeconds == 15 || data.autoRotateSeconds == 30 || data.autoRotateSeconds == 60))) &&
      isValidId(data.instructorUid) &&
      data.isOpen is bool &&
      (!('isEnded' in data) || data.isEnded is bool) &&
      data.tokenSequence is number && data.tokenSequence >= 1 && data.tokenSequence <= 1000000 &&
      data.createdAt is timestamp &&
      data.updatedAt is timestamp &&
      (!('endedAt' in data) || data.endedAt is timestamp);
    }

    function isValidQrState(data) {
      return data.keys().hasAll(['sessionId', 'instructorUid', 'activeToken', 'tokenSequence', 'updatedAt']) &&
      data.keys().hasOnly([
        'sessionId', 'instructorUid', 'activeToken', 'previousToken',
        'lastConsumedToken', 'lastConsumedByUid', 'lastConsumedByName', 'tokenSequence', 'updatedAt'
      ]) &&
      isValidId(data.sessionId) &&
      isValidId(data.instructorUid) &&
      isValidToken(data.activeToken) &&
      (!('previousToken' in data) || isValidToken(data.previousToken)) &&
      (!('lastConsumedToken' in data) || isValidToken(data.lastConsumedToken)) &&
      (!('lastConsumedByUid' in data) || isValidId(data.lastConsumedByUid)) &&
      (!('lastConsumedByName' in data) || (data.lastConsumedByName is string && data.lastConsumedByName.size() >= 1 && data.lastConsumedByName.size() <= 100)) &&
      data.tokenSequence is number && data.tokenSequence >= 1 && data.tokenSequence <= 1000000 &&
      data.updatedAt is timestamp;
    }

    function isValidAttendance(data) {
      return data.keys().hasAll([
        'sessionId', 'trainerName', 'classLab', 'sessionTitle', 'instructorUid',
        'studentUid', 'studentName', 'studentEmail', 'deviceId', 'tokenUsed', 'tokenSequence', 'checkedInAt'
      ]) &&
      data.keys().hasOnly([
        'sessionId', 'trainerName', 'classLab', 'sessionTitle', 'instructorUid',
        'studentUid', 'studentName', 'studentEmail', 'deviceId', 'tokenUsed', 'tokenSequence', 'checkedInAt'
      ]) &&
      isValidId(data.sessionId) &&
      data.trainerName is string && data.trainerName.size() >= 1 && data.trainerName.size() <= 100 &&
      data.classLab is string && data.classLab.size() >= 1 && data.classLab.size() <= 64 &&
      data.sessionTitle is string && data.sessionTitle.size() >= 2 && data.sessionTitle.size() <= 120 &&
      isValidId(data.instructorUid) &&
      isValidId(data.studentUid) &&
      data.studentName is string && data.studentName.size() >= 1 && data.studentName.size() <= 100 &&
      data.studentEmail is string && data.studentEmail.size() >= 3 && data.studentEmail.size() <= 160 &&
      isValidDeviceId(data.deviceId) &&
      isValidToken(data.tokenUsed) &&
      data.tokenSequence is number && data.tokenSequence >= 1 && data.tokenSequence <= 1000000 &&
      data.checkedInAt is timestamp;
    }

    function isValidDeviceLock(data) {
      return data.keys().hasAll(['sessionId', 'deviceId', 'studentUid', 'studentName', 'lockedAt']) &&
      data.keys().hasOnly(['sessionId', 'deviceId', 'studentUid', 'studentName', 'lockedAt']) &&
      isValidId(data.sessionId) &&
      isValidDeviceId(data.deviceId) &&
      isValidId(data.studentUid) &&
      data.studentName is string && data.studentName.size() >= 1 && data.studentName.size() <= 100 &&
      data.lockedAt is timestamp;
    }

    match /admins/{uid} {
      allow get: if isEmailVerified() && isValidId(uid) && request.auth.uid == uid;
      allow list, create, update, delete: if false;
    }

    match /sessions/{sessionId} {
      allow get: if isEmailVerified() && isValidId(sessionId);
      allow list: if isAdmin();

      allow create: if isAdmin() &&
        isValidId(sessionId) &&
        isValidSession(incoming()) &&
        incoming().instructorUid == request.auth.uid &&
        incoming().tokenSequence == 1 &&
        isSessionNotEnded(incoming()) &&
        !('endedAt' in incoming()) &&
        incoming().createdAt == request.time &&
        incoming().updatedAt == request.time &&
        existsAfter(/databases/$(database)/documents/sessions/$(sessionId)/private/qrState);

      allow update: if isEmailVerified() &&
        isValidId(sessionId) &&
        isValidSession(incoming()) &&
        incoming().instructorUid == existing().instructorUid &&
        incoming().createdAt == existing().createdAt &&
        incoming().updatedAt == request.time &&
        isSessionNotEnded(existing()) &&
        (
          (
            isAdmin() &&
            incoming().diff(existing()).affectedKeys().hasOnly([
              'trainerName', 'classLab', 'title', 'week', 'sessionDate', 'autoRotateSeconds', 'isOpen', 'tokenSequence', 'updatedAt'
            ]) &&
            incoming().tokenSequence >= existing().tokenSequence &&
            incoming().tokenSequence <= existing().tokenSequence + 1
          ) ||
          (
            isAdmin() &&
            incoming().diff(existing()).affectedKeys().hasOnly(['isOpen', 'isEnded', 'endedAt', 'updatedAt']) &&
            incoming().isOpen == false &&
            incoming().isEnded == true &&
            incoming().endedAt == request.time
          )
        );

      allow delete: if isAdmin() && isValidId(sessionId);

      match /private/qrState {
        allow get: if isAdmin() && isValidId(sessionId);
        allow list: if false;

        allow create: if isAdmin() &&
          isValidId(sessionId) &&
          isValidQrState(incoming()) &&
          incoming().sessionId == sessionId &&
          incoming().instructorUid == request.auth.uid &&
          incoming().tokenSequence == 1 &&
          incoming().updatedAt == request.time &&
          !('previousToken' in incoming()) &&
          !('lastConsumedToken' in incoming()) &&
          !('lastConsumedByUid' in incoming()) &&
          !('lastConsumedByName' in incoming()) &&
          existsAfter(/databases/$(database)/documents/sessions/$(sessionId));

        allow update: if isAdmin() &&
          isValidId(sessionId) &&
          isValidQrState(incoming()) &&
          incoming().sessionId == existing().sessionId &&
          incoming().instructorUid == existing().instructorUid &&
          incoming().activeToken != existing().activeToken &&
          incoming().updatedAt == request.time &&
          isSessionNotEnded(get(/databases/$(database)/documents/sessions/$(sessionId)).data) &&
          incoming().diff(existing()).affectedKeys().hasOnly(['activeToken', 'previousToken', 'tokenSequence', 'updatedAt']) &&
          incoming().previousToken == existing().activeToken &&
          incoming().tokenSequence == existing().tokenSequence + 1;

        allow delete: if isAdmin() && isValidId(sessionId);
      }
    }

    match /deviceLocks/{lockId} {
      allow get: if isEmailVerified() && isValidId(lockId);
      allow list: if isAdmin();

      allow create: if isEmailVerified() &&
        isValidId(lockId) &&
        isValidDeviceLock(incoming()) &&
        lockId == (incoming().sessionId + '_' + incoming().deviceId) &&
        incoming().studentUid == request.auth.uid &&
        incoming().lockedAt == request.time &&
        exists(/databases/$(database)/documents/sessions/$(incoming().sessionId)) &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.isOpen == true &&
        isSessionNotEnded(get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data) &&
        existsAfter(/databases/$(database)/documents/attendance/$(incoming().sessionId + '_' + request.auth.uid)) &&
        getAfter(/databases/$(database)/documents/attendance/$(incoming().sessionId + '_' + request.auth.uid)).data.deviceId == incoming().deviceId;

      allow update: if false;
      allow delete: if isAdmin() && isValidId(lockId);
    }

    match /attendance/{recordId} {
      allow get: if isEmailVerified() && isValidId(recordId) && (
        existing().studentUid == request.auth.uid || isAdmin()
      );
      allow list: if isEmailVerified() && (
        existing().studentUid == request.auth.uid || isAdmin()
      );

      allow create: if isEmailVerified() &&
        isValidId(recordId) &&
        isValidAttendance(incoming()) &&
        recordId == (incoming().sessionId + '_' + request.auth.uid) &&
        incoming().studentUid == request.auth.uid &&
        incoming().studentEmail == request.auth.token.email &&
        incoming().checkedInAt == request.time &&
        exists(/databases/$(database)/documents/sessions/$(incoming().sessionId)) &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.isOpen == true &&
        isSessionNotEnded(get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data) &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.instructorUid == incoming().instructorUid &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.trainerName == incoming().trainerName &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.classLab == incoming().classLab &&
        get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.title == incoming().sessionTitle &&
        incoming().tokenSequence <= get(/databases/$(database)/documents/sessions/$(incoming().sessionId)).data.tokenSequence &&
        (
          get(/databases/$(database)/documents/sessions/$(incoming().sessionId)/private/qrState).data.activeToken == incoming().tokenUsed ||
          (
            'previousToken' in get(/databases/$(database)/documents/sessions/$(incoming().sessionId)/private/qrState).data &&
            get(/databases/$(database)/documents/sessions/$(incoming().sessionId)/private/qrState).data.previousToken == incoming().tokenUsed
          )
        ) &&
        existsAfter(/databases/$(database)/documents/deviceLocks/$(incoming().sessionId + '_' + incoming().deviceId)) &&
        getAfter(/databases/$(database)/documents/deviceLocks/$(incoming().sessionId + '_' + incoming().deviceId)).data.studentUid == request.auth.uid;

      allow update: if false;
      allow delete: if isAdmin() && isValidId(recordId);
    }
  }
}
```

---

## 7. Step-by-Step Instructions to Build & Launch Your Real Production App (Free Hosting)

Follow these steps when you create your permanent real-world project (for example in VS Code + GitHub + Firebase Hosting or Vercel):

### Step 1 — Export / Copy the Codebase
1. Download or copy all files from this workspace (`src/`, `public/`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `firestore.rules`).
2. Run `npm install` locally to install all packages.

### Step 2 — Create Your Own Free Firebase Project (Spark Plan)
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project (stays on the **free Spark plan**—no credit card needed for Auth, Firestore, or Hosting).
2. **Enable Authentication**:
   - Open **Build -> Authentication -> Sign-in method**.
   - Enable **Google** provider and set a project support email.
3. **Create Firestore Database**:
   - Open **Build -> Firestore Database -> Create database**.
   - Start in **Production mode** (choose `asia-southeast1` Singapore or nearest region for Malaysia).
4. **Register a Web App**:
   - Go to **Project Settings -> Your apps -> Add app (`</>`)**.
   - Copy the generated `firebaseConfig` object (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
5. **Update `firebase-applet-config.json` and `src/firebase.ts`**:
   - Put your new config into `firebase-applet-config.json` (if using the default `(default)` Firestore database in your new Firebase project, initialize `getFirestore(app)` without a custom database ID, or set `"firestoreDatabaseId": "(default)"`).

### Step 3 — Set Your Production URL & Authorized Domains
1. In `src/utils/qr.ts`, `getDefaultCheckInOrigin()` simply returns `window.location.origin` once deployed on your real domain (you can remove the `ais-dev-` / `ais-pre-` preview check).
2. **CRITICAL**: Once you know your live domain (e.g., `todak-attendance.web.app` or `attendance.todak.com`), go to **Firebase Console -> Authentication -> Settings -> Authorized domains** and add your domain—otherwise Google Sign-In popup will fail.

### Step 4 — Add Instructors / Admins
1. Keep `'syaqir@todak.com'` in `ADMIN_EMAIL` (`src/types.ts`) and in `firestore.rules`.
2. To add more trainers without editing code, sign them in once to get their Firebase **User UID** from **Authentication -> Users**, then create a document `/admins/<their_uid>` in Firestore with `{ "email": "trainer@todak.com" }`.

### Step 5 — Deploy Firestore Rules & Static Site for Free
Using **Firebase Hosting (Free Spark Tier, no billing required)**:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting firestore
# Choose your new Firebase project
# Set public directory to: dist
# Configure as single-page app (rewrite all urls to /index.html): Yes

npm run build
firebase deploy --only firestore:rules,hosting
```
*(Alternative: Push to GitHub and connect to **Vercel** or **Cloudflare Pages** with build command `npm run build` and output directory `dist`—also free and zero billing required.)*

### Step 6 — Using the System in Class with Google Sheets
1. Trainer opens **Instructor Console**, selects Room (`Jaka`..`Auditorium`), fills `Week`, `Title`, `Date`, sets `Auto-Refresh` (`15s`/`30s`/`60s`), and opens **Classroom Attendee** on the projector (`Fullscreen`).
2. Students scan the QR on their phones, sign in with Google, and receive the congratulatory check-in confirmation.
3. Trainer clicks **End Class** when attendance closes—the session archives into **History** filterable by Week.
4. Trainer clicks **Copy H Markers** (`Student Name\tH`) or **Download CSV** (`Date, Student Name`) to update the master *Rekod Kehadiran Pelajar* Google Sheet.
