import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Link2,
  ShieldAlert,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AttendanceRecordDoc,
  CourseCuConfigDoc,
  DeviceLockDoc,
  SessionDoc,
} from '../types';
import {
  checkSessionDeviceLock,
  submitQrClockIn,
} from '../services/attendanceService';
import {
  calculateStudentCuProgress,
  getStudentCuStatusForSession,
  isTaklimatUnit,
} from '../utils/attendance';
import { CuEligibilityFlag, CuProgressMeter } from './CuEligibilityStatus';
import {
  formatSessionDateLabel,
  getOrCreatePersistentDeviceId,
  parseQrPayload,
} from '../utils/qr';

interface StudentCheckInViewProps {
  user: User;
  initialScan: { sessionId: string; token: string } | null;
  onClearInitialScan: () => void;
  myAttendance: AttendanceRecordDoc[];
  courseConfigs: Record<string, CourseCuConfigDoc>;
}

export function StudentCheckInView({
  user,
  initialScan,
  onClearInitialScan,
  myAttendance,
  courseConfigs,
}: StudentCheckInViewProps) {
  const [scannedTarget, setScannedTarget] = useState<{
    sessionId: string;
    token: string;
  } | null>(initialScan);

  const [session, setSession] = useState<SessionDoc | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [deviceLock, setDeviceLock] = useState<DeviceLockDoc | null>(null);

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = 'todak-qr-reader';

  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    classLab: string;
    trainerName: string;
    sessionTitle: string;
    courseName?: string;
    batch?: string;
    week?: string;
    tokenSequence: number;
  } | null>(null);

  const cuProgressList = useMemo(
    () => calculateStudentCuProgress(myAttendance, courseConfigs),
    [myAttendance, courseConfigs]
  );

  const scannedSessionCuStatus = useMemo(() => {
    if (!session) return null;
    return getStudentCuStatusForSession({
      studentUid: user.uid,
      studentName: user.displayName || user.email || 'Student',
      studentEmail: user.email || '',
      courseId: session.courseId,
      courseName: session.courseName,
      cuCode: session.cuCode,
      batch: session.batch,
      fallbackTitle: session.title,
      records: myAttendance,
      courseConfigs,
    });
  }, [session, user.uid, user.displayName, user.email, myAttendance, courseConfigs]);

  useEffect(() => {
    if (initialScan) {
      setScannedTarget(initialScan);
      setReceipt(null);
      setSubmitError(null);
    }
  }, [initialScan]);

  const stopCameraScanner = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    setScannerActive(false);
    if (instance) {
      try {
        await instance.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        instance.clear();
      } catch {
        // Ignore DOM cleanup edge cases
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopCameraScanner();
    };
  }, [stopCameraScanner]);

  useEffect(() => {
    if (!scannedTarget) {
      setSession(null);
      setSessionMissing(false);
      setDeviceLock(null);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);
    setSessionMissing(false);
    const path = `sessions/${scannedTarget.sessionId}`;

    const unsubscribe = onSnapshot(
      doc(db, 'sessions', scannedTarget.sessionId),
      (snap) => {
        setSessionLoading(false);
        if (snap.exists()) {
          setSession({
            id: snap.id,
            ...(snap.data() as Omit<SessionDoc, 'id'>),
          });
          setSessionMissing(false);
        } else {
          setSession(null);
          setSessionMissing(true);
        }
      },
      (error) => {
        setSessionLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    const checkLock = async () => {
      try {
        const deviceId = await getOrCreatePersistentDeviceId();
        const lock = await checkSessionDeviceLock(scannedTarget.sessionId, deviceId);
        if (!cancelled) {
          setDeviceLock(lock);
        }
      } catch {
        if (!cancelled) {
          setDeviceLock(null);
        }
      }
    };
    void checkLock();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [scannedTarget?.sessionId, user.uid]);

  const startCameraScanner = async () => {
    setCameraError(null);
    setSubmitError(null);
    setReceipt(null);

    if (scannerRef.current) {
      await stopCameraScanner();
    }

    setScannerActive(true);
    window.setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode(scannerRegionId);
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const parsed = parseQrPayload(decodedText);
            if (parsed) {
              setScannedTarget(parsed);
              setManualError(null);
              void stopCameraScanner();
            } else {
              setCameraError('QR code scanned is not a Todak Academy attendance code.');
            }
          },
          () => {
            // Continuous frame decode errors are expected while aiming camera
          }
        );
      } catch (err) {
        setScannerActive(false);
        scannerRef.current = null;
        setCameraError(
          err instanceof Error
            ? `Camera unavailable: ${err.message}. You can paste a check-in link below instead.`
            : 'Camera permission denied or unavailable. You can paste a check-in link below.'
        );
      }
    }, 60);
  };

  const handleManualParse = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setSubmitError(null);
    setReceipt(null);

    const parsed = parseQrPayload(manualInput);
    if (!parsed) {
      setManualError('Enter a valid Todak Academy QR check-in link.');
      return;
    }

    setScannedTarget(parsed);
    setManualInput('');
  };

  const existingRecord = scannedTarget
    ? myAttendance.find((r) => r.sessionId === scannedTarget.sessionId) || null
    : null;

  const deviceLockedByOther = Boolean(
    deviceLock && deviceLock.studentUid !== user.uid
  );

  const handleClockIn = async () => {
    if (!session || !scannedTarget || deviceLockedByOther) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitQrClockIn({
        user,
        session,
        scannedToken: scannedTarget.token,
      });

      setReceipt({
        classLab: session.classLab,
        trainerName: session.trainerName,
        sessionTitle: session.title,
        courseName: session.courseName,
        batch: session.batch,
        week: session.week,
        tokenSequence: result.tokenSequence,
      });
      setScannedTarget(null);
      onClearInitialScan();
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to complete clock-in.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetScan = () => {
    setScannedTarget(null);
    setSubmitError(null);
    setReceipt(null);
    onClearInitialScan();
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 md:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 min-w-0 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[#E2E8F0]">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                  Student Check-In
                </h1>
                <p className="text-xs text-[#64748B] mt-1">
                  Signed in as{' '}
                  <span className="font-medium text-[#0F172A]">
                    {user.displayName || user.email}
                  </span>{' '}
                  <span aria-hidden="true">·</span>{' '}
                  <span>{user.email}</span>
                </p>
              </div>
            </div>

            {receipt && (
              <div className="p-5 bg-[#F7FEE7] border border-[#BEF264] rounded-xl space-y-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#3F6212] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#1A2E05]">
                      Congratulations! Thank you for attending class today.
                    </p>
                    <p className="text-xs font-medium text-[#365314]">
                      Great job showing up—keep the momentum going!
                    </p>
                    <p className="text-xs text-[#3F6212] pt-0.5">
                      {receipt.sessionTitle}
                      {receipt.courseName ? ` · ${receipt.courseName}` : ''}
                      {receipt.batch ? ` · ${receipt.batch}` : ''}
                      {receipt.week ? ` · ${receipt.week}` : ''} · {receipt.classLab} · Trainer {receipt.trainerName} · Token #{receipt.tokenSequence}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!scannedTarget ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-semibold text-[#0F172A]">
                      01. Scan Classroom QR Code
                    </h2>
                    {scannerActive && (
                      <button
                        type="button"
                        onClick={() => void stopCameraScanner()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A] min-h-[36px] px-2 cursor-pointer"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        Stop Camera
                      </button>
                    )}
                  </div>

                  {scannerActive ? (
                    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#0F172A]">
                      <div id={scannerRegionId} className="w-full min-h-[260px]" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCameraScanner()}
                      className="w-full min-h-[52px] px-5 py-3.5 text-sm font-semibold text-white bg-[#3F6212] rounded-xl hover:bg-[#365314] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      Open Camera to Scan QR
                    </button>
                  )}

                  {cameraError && (
                    <p role="alert" className="text-xs text-[#DC2626] font-medium">
                      {cameraError}
                    </p>
                  )}
                </div>

                <form
                  onSubmit={handleManualParse}
                  className="pt-5 border-t border-[#E2E8F0] space-y-2.5"
                >
                  <label
                    htmlFor="manual-qr-input"
                    className="block text-xs font-medium text-[#475569]"
                  >
                    Or paste a check-in link from the classroom screen
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="manual-qr-input"
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="https://.../?session=...&token=..."
                        className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Load Code
                    </button>
                  </div>
                  {manualError && (
                    <p role="alert" className="text-xs text-[#DC2626]">
                      {manualError}
                    </p>
                  )}
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-mono tabular-nums text-[#64748B]">
                      Scanned Token ···{scannedTarget.token.slice(-6)}
                    </p>
                    {sessionLoading ? (
                      <div className="h-6 w-48 bg-[#F1F5F9] rounded mt-1.5 animate-pulse" />
                    ) : session ? (
                      <div className="mt-1">
                        {session.courseName && (
                          <p className="text-xs font-medium text-[#3F6212]">
                            {session.courseName}
                            {session.batch ? ` · ${session.batch}` : ''}
                          </p>
                        )}
                        <h2 className="text-lg font-bold text-[#0F172A] mt-0.5 break-words">
                          {session.title}
                        </h2>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {session.classLab}
                          {session.week ? ` · ${session.week}` : ''} · Trainer {session.trainerName}
                          {formatSessionDateLabel(session.sessionDate)
                            ? ` · ${formatSessionDateLabel(session.sessionDate)}`
                            : ''}
                        </p>
                      </div>
                    ) : sessionMissing ? (
                      <p className="text-sm font-semibold text-[#DC2626] mt-1">
                        Class session not found. Please scan a current classroom QR code.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="text-xs font-medium text-[#475569] hover:text-[#0F172A] min-h-[36px] px-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Scan Again
                  </button>
                </div>

                {scannedSessionCuStatus && (
                  <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#0F172A]">
                        Your {scannedSessionCuStatus.cuCode} Attendance Status
                      </span>
                      <CuEligibilityFlag
                        isEligible={scannedSessionCuStatus.isExamEligible}
                        requiredPercentage={
                          scannedSessionCuStatus.requiredPercentage
                        }
                        daysNeededFor80={scannedSessionCuStatus.daysNeededFor80}
                      />
                    </div>
                    <CuProgressMeter
                      percentage={scannedSessionCuStatus.percentage}
                      percentageLabel={scannedSessionCuStatus.percentageLabel}
                      isEligible={scannedSessionCuStatus.isExamEligible}
                      requiredPercentage={
                        scannedSessionCuStatus.requiredPercentage
                      }
                    />
                    <p className="text-[11px] font-mono tabular-nums text-[#475569]">
                      {scannedSessionCuStatus.attendedDays} /{' '}
                      {scannedSessionCuStatus.targetDays} target days ·{' '}
                      {scannedSessionCuStatus.requiredPercentage}% exam gate:{' '}
                      {scannedSessionCuStatus.minRequiredDays} days
                    </p>
                  </div>
                )}

                {existingRecord ? (
                  <div className="p-4 bg-[#F7FEE7] border border-[#BEF264] rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-[#365314]">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#3F6212]" />
                      <p className="text-sm font-semibold">
                        You have already clocked into this session
                      </p>
                    </div>
                    <p className="text-xs font-mono tabular-nums text-[#3F6212]">
                      {existingRecord.classLab} · Token #{existingRecord.tokenSequence}
                    </p>
                  </div>
                ) : deviceLockedByOther && deviceLock ? (
                  <div
                    role="alert"
                    className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-start gap-3 text-xs text-[#991B1B]"
                  >
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#DC2626]" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#991B1B]">
                        This device has already clocked in
                      </p>
                      <p className="leading-relaxed">
                        This phone was already used to record attendance as{' '}
                        <strong className="text-[#7F1D1D]">{deviceLock.studentName}</strong>.
                        Only one Google account can clock in per phone for this session.
                      </p>
                    </div>
                  </div>
                ) : (
                  session && (
                    <>
                      {session.isEnded ? (
                        <div className="p-3.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg flex items-center gap-2.5 text-xs text-[#334155]">
                          <AlertCircle className="w-4 h-4 shrink-0 text-[#475569]" />
                          <span>
                            This class session has ended. Check-ins are closed, and attendance records are saved in history.
                          </span>
                        </div>
                      ) : !session.isOpen ? (
                        <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg flex items-center gap-2.5 text-xs text-[#92400E]">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            This session is currently paused by the instructor.
                          </span>
                        </div>
                      ) : null}

                      {submitError && (
                        <div
                          role="alert"
                          className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#991B1B]"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-2">
                            <p className="font-medium leading-relaxed">{submitError}</p>
                            <button
                              type="button"
                              onClick={handleResetScan}
                              className="font-semibold underline cursor-pointer"
                            >
                              Scan the current QR code
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleClockIn()}
                        disabled={submitting || !session.isOpen || Boolean(session.isEnded)}
                        className="w-full min-h-[52px] px-6 py-3.5 text-sm font-semibold text-white bg-[#3F6212] rounded-xl hover:bg-[#365314] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {submitting
                          ? 'Recording Attendance...'
                          : session.isEnded
                            ? 'Class Session Ended'
                            : 'Clock In Now'}
                      </button>
                    </>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 min-w-0 space-y-6">
          {/* Student CU Attendance Percentage & 80% Exam Eligibility */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl">
            <div className="p-5 border-b border-[#E2E8F0] flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  CU Attendance & Exam Status
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Minimum required attendance per CU before sitting for each exam
                </p>
              </div>
            </div>

            {cuProgressList.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Your Competency Unit percentage and exam eligibility will appear here once you attend a course CU class.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E2E8F0]">
                {cuProgressList.map((item) => (
                  <li key={item.key} className="p-4 sm:px-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {item.cuCode} — {item.unitName}
                        </p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {item.courseShortName}
                          {item.levelLabel && (
                            <>
                              <span aria-hidden="true"> · </span>
                              {item.levelLabel}
                            </>
                          )}
                          <span aria-hidden="true"> · </span>
                          {item.batch}
                          <span aria-hidden="true"> · </span>
                          {isTaklimatUnit(item)
                            ? `${item.targetDays} ${item.targetDays === 1 ? 'day' : 'days'}`
                            : `${item.weeks} weeks`}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold font-mono tabular-nums whitespace-nowrap shrink-0 ${
                          item.isExamEligible ? 'text-[#15803D]' : 'text-[#DC2626]'
                        }`}
                      >
                        {item.percentageLabel}
                      </span>
                    </div>

                    <CuProgressMeter
                      percentage={item.percentage}
                      percentageLabel={item.percentageLabel}
                      isEligible={item.isExamEligible}
                      requiredPercentage={item.requiredPercentage}
                      showPercentageLabel={false}
                    />

                    <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                      <span className="font-mono tabular-nums text-[#475569]">
                        {item.attendedDays} / {item.targetDays} days (min {item.minRequiredDays} · {item.requiredPercentage}%)
                      </span>
                      <CuEligibilityFlag
                        isEligible={item.isExamEligible}
                        requiredPercentage={item.requiredPercentage}
                        daysNeededFor80={item.daysNeededFor80}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl">
            <div className="p-5 border-b border-[#E2E8F0] flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Your Clock-In History
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#64748B]">
                {myAttendance.length} recorded
              </span>
            </div>

            {myAttendance.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-[#0F172A]">
                  No clock-ins yet
                </p>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Scan a classroom QR code to record your attendance with your Google account.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E2E8F0]">
                {myAttendance.map((rec) => {
                  const dateLabel = rec.checkedInAt
                    ? rec.checkedInAt.toDate().toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now';

                  return (
                    <li key={rec.id} className="p-4 sm:px-5 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {rec.sessionTitle}
                        </p>
                        <span className="text-xs font-mono tabular-nums text-[#64748B] whitespace-nowrap shrink-0">
                          {dateLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#475569]">
                        {rec.courseName && (
                          <>
                            <span className="text-[#3F6212] font-medium">
                              {rec.courseName}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {rec.batch && (
                          <>
                            <span>{rec.batch}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{rec.classLab}</span>
                        <span aria-hidden="true">·</span>
                        <span>Trainer {rec.trainerName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Token #{rec.tokenSequence}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
