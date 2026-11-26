# Security Specification — CampusPulse QR Clock-In

## 1. Data Invariants
1. **Secret QR Token Isolation**: `activeToken` lives strictly inside `/sessions/{sessionId}/private/qrState` and can only be read by the session's `instructorUid` or a verified admin. Students cannot read `activeToken` from Firestore.
2. **Atomic Single-Use Rotation**: A student can only create `/attendance/{sessionId}_{studentUid}` in an atomic batch that simultaneously updates `/sessions/{sessionId}/private/qrState` (proving `existing().activeToken == incoming().lastConsumedToken` and rotating to a distinct `activeToken`) and increments `tokenSequence` on `/sessions/{sessionId}`.
3. **Verified Google Identity**: Every read and write requires `request.auth != null && request.auth.token.email_verified == true`. Students cannot spoof `studentUid` or `studentEmail`.
4. **Immutable Attendance Records**: Once created, attendance records cannot be modified or deleted by students.
5. **Strict PII & List Isolation**: `allow list` on `/attendance` evaluates `resource.data.studentUid == request.auth.uid || resource.data.instructorUid == request.auth.uid || isAdmin()` without `get()` lookups.

## 2. Dirty Dozen Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Stale / Reused QR Token**: Student submits `tokenUsed` that no longer matches `qrState.activeToken`.
2. **Unrotated Batch Bypass**: Student creates `/attendance/{id}` without rotating `qrState.activeToken` in the same batch (`getAfter` fails).
3. **Same-Token Rotation**: Student updates `qrState.activeToken` to the exact same token string (`incoming().activeToken != existing().activeToken` fails).
4. **Duplicate Session Check-In**: Student creates `/attendance/{otherDocId}` not matching `{sessionId}_{request.auth.uid}`.
5. **Identity Spoofing**: Student sets `studentUid` or `studentEmail` to another user's UID or email.
6. **Shadow Field Injection**: Payload includes an extra undeclared key like `isAdmin: true` or `locationOverride: true`.
7. **Unverified Email**: Request from an auth token where `email_verified` is `false`.
8. **Student Reading Secret Token**: Student calls `getDoc` on `/sessions/{sessionId}/private/qrState`.
9. **Closed Session Check-In**: Student attempts to clock in when `session.isOpen == false`.
10. **Invalid GPS Coordinate Bounds**: Student submits `latitude: 999` or `longitude: -500`.
11. **Client Timestamp Tampering**: Client submits a backdated `checkedInAt` or `createdAt` instead of `request.time`.
12. **Blanket Roster Scraping**: Student queries `/attendance` without filtering to `studentUid == request.auth.uid`.
