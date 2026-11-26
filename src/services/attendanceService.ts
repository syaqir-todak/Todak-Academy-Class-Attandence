import type { User } from 'firebase/auth';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  type AttendanceRecordDoc,
  type CourseCuConfigDoc,
  type CourseId,
  type CuUnitConfig,
  type DeviceLockDoc,
  type SessionDoc,
} from '../types';
import {
  formatCuPrefixedTitle,
  getCourseById,
  isValidCourseIdSlug,
  isValidCuCode,
  sanitizeUnitItem,
} from '../utils/attendance';
import {
  generateSecureToken,
  generateSessionId,
  getOrCreatePersistentDeviceId,
  getTodayDateInputValue,
  isValidDateInputValue,
} from '../utils/qr';

function sanitizeString(value: string, maxLength: number, fallback: string): string {
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : fallback;
}

export interface SessionFormInput {
  trainerName: string;
  classLab: string;
  title: string;
  courseId?: string;
  courseName?: string;
  cuCode?: string;
  batch?: string;
  week: string;
  sessionDate: string;
  autoRotateSeconds?: number;
}

function sanitizeOptionalWeek(value: string): string {
  return value.trim().slice(0, 40);
}

function sanitizeOptionalBatch(value?: string): string {
  return (value || '').trim().slice(0, 64);
}

function normalizeAutoRotateSeconds(value?: number): number {
  if (value === 0 || value === 15 || value === 30 || value === 60) {
    return value;
  }
  return 30;
}

export async function saveCourseCuConfig(
  user: User,
  courseId: CourseId,
  unitListInput: CuUnitConfig[],
  options?: {
    courseName?: string;
    courseShortName?: string;
    isDeleted?: boolean;
  }
): Promise<void> {
  if (!isValidCourseIdSlug(courseId)) {
    throw new Error('Program ID must be 2-64 characters using letters, numbers, hyphens, or underscores.');
  }

  const builtIn = getCourseById(courseId);
  const courseName = (options?.courseName || builtIn?.name || courseId)
    .trim()
    .slice(0, 120);
  if (courseName.length < 2) {
    throw new Error('Program name must be at least 2 characters.');
  }

  const courseShortName = (
    options?.courseShortName ||
    builtIn?.shortName ||
    courseName
  )
    .trim()
    .slice(0, 60);

  const sanitizedList = unitListInput
    .slice(0, 50)
    .map((item, idx) => sanitizeUnitItem(item, idx + 1));

  if (sanitizedList.length === 0) {
    throw new Error('At least one subject / Competency Unit row is required.');
  }

  const payload: Record<string, unknown> = {
    courseId,
    courseName,
    unitList: sanitizedList,
    updatedByUid: user.uid,
    updatedAt: serverTimestamp(),
  };

  if (courseShortName.length >= 1) {
    payload.courseShortName = courseShortName;
  }
  if (typeof options?.isDeleted === 'boolean') {
    payload.isDeleted = options.isDeleted;
  } else {
    payload.isDeleted = false;
  }

  const ref = doc(db, 'courseCuConfigs', courseId);
  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `courseCuConfigs/${courseId}`);
  }
}

export async function deleteCourseProgram(
  user: User,
  courseId: CourseId,
  existingConfig?: CourseCuConfigDoc | null
): Promise<void> {
  if (!isValidCourseIdSlug(courseId)) {
    throw new Error('Invalid Program ID.');
  }

  const builtIn = getCourseById(courseId);
  if (builtIn) {
    const fallbackUnits =
      existingConfig?.unitList && existingConfig.unitList.length > 0
        ? existingConfig.unitList
        : [{ cuCode: 'CU01', unitName: 'Archived Module', weeks: 1, targetDays: 5, requiredPercentage: 80 }];
    await saveCourseCuConfig(user, courseId, fallbackUnits, {
      courseName: existingConfig?.courseName || builtIn.name,
      courseShortName: existingConfig?.courseShortName || builtIn.shortName,
      isDeleted: true,
    });
    return;
  }

  const ref = doc(db, 'courseCuConfigs', courseId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courseCuConfigs/${courseId}`);
  }
}

export async function createSessionWithQr(
  user: User,
  input: SessionFormInput
): Promise<string> {
  const trainerName = sanitizeString(input.trainerName, 100, 'Trainer');
  const classLab = sanitizeString(input.classLab, 64, 'Jaka');
  const validCourseId = isValidCourseIdSlug(input.courseId)
    ? input.courseId
    : undefined;
  const builtInCourse = getCourseById(validCourseId);
  const cuCode = isValidCuCode(input.cuCode) ? input.cuCode : undefined;
  const formattedTitle = cuCode
    ? formatCuPrefixedTitle(cuCode, input.title)
    : input.title.trim();
  const title = sanitizeString(formattedTitle, 120, 'Class Session');
  const batch = sanitizeOptionalBatch(input.batch);
  const week = sanitizeOptionalWeek(input.week);
  const sessionDate = isValidDateInputValue(input.sessionDate)
    ? input.sessionDate.trim()
    : getTodayDateInputValue();
  const autoRotateSeconds = normalizeAutoRotateSeconds(input.autoRotateSeconds);

  if (title.length < 2) {
    throw new Error('Session class title must be at least 2 characters.');
  }

  const sessionId = generateSessionId(classLab);
  const activeToken = generateSecureToken(24);

  const sessionRef = doc(db, 'sessions', sessionId);
  const qrStateRef = doc(db, 'sessions', sessionId, 'private', 'qrState');

  const sessionPayload: Record<string, unknown> = {
    trainerName,
    classLab,
    title,
    sessionDate,
    autoRotateSeconds,
    instructorUid: user.uid,
    isOpen: true,
    isEnded: false,
    tokenSequence: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (validCourseId) {
    sessionPayload.courseId = validCourseId;
    const resolvedName = (
      input.courseName ||
      builtInCourse?.name ||
      validCourseId
    )
      .trim()
      .slice(0, 120);
    if (resolvedName.length >= 2) {
      sessionPayload.courseName = resolvedName;
    }
    if (cuCode) {
      sessionPayload.cuCode = cuCode;
    }
  } else {
    const standaloneLabel = (input.courseName || '').trim().slice(0, 120);
    if (standaloneLabel.length >= 2) {
      sessionPayload.courseName = standaloneLabel;
    }
  }
  if (batch.length > 0) {
    sessionPayload.batch = batch;
  }
  if (week.length > 0) {
    sessionPayload.week = week;
  }

  const qrStatePayload = {
    sessionId,
    instructorUid: user.uid,
    activeToken,
    tokenSequence: 1,
    updatedAt: serverTimestamp(),
  };

  const batchWrite = writeBatch(db);
  batchWrite.set(sessionRef, sessionPayload);
  batchWrite.set(qrStateRef, qrStatePayload);

  try {
    await batchWrite.commit();
    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `sessions/${sessionId}`);
  }
}

export async function updateSessionDetails(
  sessionId: string,
  input: SessionFormInput
): Promise<void> {
  const trainerName = sanitizeString(input.trainerName, 100, 'Trainer');
  const classLab = sanitizeString(input.classLab, 64, 'Jaka');
  const validCourseId = isValidCourseIdSlug(input.courseId)
    ? input.courseId
    : undefined;
  const builtInCourse = getCourseById(validCourseId);
  const cuCode = isValidCuCode(input.cuCode) ? input.cuCode : undefined;
  const formattedTitle = cuCode
    ? formatCuPrefixedTitle(cuCode, input.title)
    : input.title.trim();
  const title = sanitizeString(formattedTitle, 120, 'Class Session');
  const batch = sanitizeOptionalBatch(input.batch);
  const week = sanitizeOptionalWeek(input.week);
  const sessionDate = input.sessionDate.trim();

  if (title.length < 2) {
    throw new Error('Session class title must be at least 2 characters.');
  }
  if (!isValidDateInputValue(sessionDate)) {
    throw new Error('Please choose a valid class date.');
  }

  const updatePayload: Record<string, unknown> = {
    trainerName,
    classLab,
    title,
    batch,
    week,
    sessionDate,
    updatedAt: serverTimestamp(),
  };

  if (validCourseId) {
    updatePayload.courseId = validCourseId;
    const resolvedName = (
      input.courseName ||
      builtInCourse?.name ||
      validCourseId
    )
      .trim()
      .slice(0, 120);
    if (resolvedName.length >= 2) {
      updatePayload.courseName = resolvedName;
    }
    if (cuCode) {
      updatePayload.cuCode = cuCode;
    } else {
      updatePayload.cuCode = deleteField();
    }
  } else {
    updatePayload.courseId = deleteField();
    updatePayload.cuCode = deleteField();
    const standaloneLabel = (input.courseName || '').trim().slice(0, 120);
    if (standaloneLabel.length >= 2) {
      updatePayload.courseName = standaloneLabel;
    } else {
      updatePayload.courseName = deleteField();
    }
  }

  const sessionRef = doc(db, 'sessions', sessionId);
  try {
    await updateDoc(sessionRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function updateSessionAutoRotateSeconds(
  sessionId: string,
  seconds: number
): Promise<void> {
  const autoRotateSeconds = normalizeAutoRotateSeconds(seconds);
  const sessionRef = doc(db, 'sessions', sessionId);
  try {
    await updateDoc(sessionRef, {
      autoRotateSeconds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function toggleSessionOpen(
  sessionId: string,
  isOpen: boolean
): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  try {
    await updateDoc(sessionRef, {
      isOpen,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function endClassSession(sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  try {
    await updateDoc(sessionRef, {
      isOpen: false,
      isEnded: true,
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function rotateSessionQrManually(
  session: SessionDoc,
  knownActiveToken?: string
): Promise<string> {
  if (session.isEnded) {
    throw new Error('Cannot rotate QR code after a class session has ended.');
  }

  const sessionRef = doc(db, 'sessions', session.id);
  const qrStateRef = doc(db, 'sessions', session.id, 'private', 'qrState');

  let prevToken = knownActiveToken;
  let currentSeq = session.tokenSequence;

  if (!prevToken) {
    const snap = await getDoc(qrStateRef);
    if (!snap.exists()) {
      throw new Error('QR state not found for this session.');
    }
    const data = snap.data() as { activeToken: string; tokenSequence: number };
    prevToken = data.activeToken;
    currentSeq = data.tokenSequence;
  }

  const freshToken = generateSecureToken(24);
  const nextSeq = currentSeq + 1;

  const batch = writeBatch(db);
  batch.update(qrStateRef, {
    activeToken: freshToken,
    previousToken: prevToken,
    tokenSequence: nextSeq,
    updatedAt: serverTimestamp(),
  });
  batch.update(sessionRef, {
    tokenSequence: nextSeq,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return freshToken;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${session.id}/private/qrState`);
  }
}

export async function deleteSessionAndState(sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  const qrStateRef = doc(db, 'sessions', sessionId, 'private', 'qrState');
  const batch = writeBatch(db);
  batch.delete(qrStateRef);
  batch.delete(sessionRef);
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `sessions/${sessionId}`);
  }
}

export async function removeAttendanceAndUnlockDevice(
  record: AttendanceRecordDoc
): Promise<void> {
  const attendanceRef = doc(db, 'attendance', record.id);
  const batch = writeBatch(db);
  batch.delete(attendanceRef);
  if (record.deviceId) {
    const lockRef = doc(db, 'deviceLocks', `${record.sessionId}_${record.deviceId}`);
    batch.delete(lockRef);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendance/${record.id}`);
  }
}

export async function checkSessionDeviceLock(
  sessionId: string,
  deviceId: string
): Promise<DeviceLockDoc | null> {
  const lockId = `${sessionId}_${deviceId}`;
  try {
    const snap = await getDoc(doc(db, 'deviceLocks', lockId));
    if (!snap.exists()) return null;
    return snap.data() as DeviceLockDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `deviceLocks/${lockId}`);
  }
}

export interface ClockInResult {
  recordId: string;
  tokenSequence: number;
}

export async function submitQrClockIn(params: {
  user: User;
  session: SessionDoc;
  scannedToken: string;
}): Promise<ClockInResult> {
  const { user, session, scannedToken } = params;

  if (!user.email) {
    throw new Error('Your Google account must have a verified email address to clock in.');
  }
  if (session.isEnded) {
    throw new Error('This class session has ended. Check-ins are closed and attendance records are saved in history.');
  }
  if (!session.isOpen) {
    throw new Error('This class session is currently closed for clock-ins.');
  }

  const deviceId = await getOrCreatePersistentDeviceId();
  const existingLock = await checkSessionDeviceLock(session.id, deviceId);
  if (existingLock && existingLock.studentUid !== user.uid) {
    throw new Error(
      `This device has already been used to clock in as ${existingLock.studentName}. Only one student account can clock in per phone.`
    );
  }

  const recordId = `${session.id}_${user.uid}`;
  const lockId = `${session.id}_${deviceId}`;
  const studentName = sanitizeString(
    user.displayName || user.email.split('@')[0] || 'Student',
    100,
    'Student'
  );
  const studentEmail = sanitizeString(user.email, 160, user.email);

  const attendanceRef = doc(db, 'attendance', recordId);
  const deviceLockRef = doc(db, 'deviceLocks', lockId);

  const attendancePayload: Record<string, unknown> = {
    sessionId: session.id,
    trainerName: session.trainerName,
    classLab: session.classLab,
    sessionTitle: session.title,
    instructorUid: session.instructorUid,
    studentUid: user.uid,
    studentName,
    studentEmail,
    deviceId,
    tokenUsed: scannedToken,
    tokenSequence: session.tokenSequence,
    checkedInAt: serverTimestamp(),
  };

  if (typeof session.courseId === 'string' && session.courseId.length > 0) {
    attendancePayload.courseId = session.courseId;
  }
  if (typeof session.courseName === 'string' && session.courseName.length >= 2) {
    attendancePayload.courseName = session.courseName;
  }
  if (typeof session.cuCode === 'string' && isValidCuCode(session.cuCode)) {
    attendancePayload.cuCode = session.cuCode;
  }
  if (typeof session.batch === 'string') {
    attendancePayload.batch = session.batch;
  }
  if (typeof session.sessionDate === 'string' && isValidDateInputValue(session.sessionDate)) {
    attendancePayload.sessionDate = session.sessionDate;
  }

  const batchWrite = writeBatch(db);
  batchWrite.set(attendanceRef, attendancePayload);

  batchWrite.set(deviceLockRef, {
    sessionId: session.id,
    deviceId,
    studentUid: user.uid,
    studentName,
    lockedAt: serverTimestamp(),
  });

  try {
    await batchWrite.commit();
    return {
      recordId,
      tokenSequence: session.tokenSequence,
    };
  } catch (error) {
    const latestLock = await checkSessionDeviceLock(session.id, deviceId).catch(() => null);
    if (latestLock && latestLock.studentUid !== user.uid) {
      throw new Error(
        `This device has already been used to clock in as ${latestLock.studentName}. Only one student account can clock in per phone.`
      );
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('permission') || message.includes('insufficient')) {
      throw new Error(
        'This QR code has expired. Please scan the current QR code on the classroom screen.'
      );
    }
    handleFirestoreError(error, OperationType.WRITE, `attendance/${recordId}`);
  }
}
