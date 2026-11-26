import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  Copy,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  Square,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AttendanceRecordDoc,
  SessionDoc,
  SessionQrStateDoc,
} from '../types';
import {
  endClassSession,
  rotateSessionQrManually,
  toggleSessionOpen,
} from '../services/attendanceService';
import {
  buildQrCheckInUrl,
  formatSessionDateLabel,
} from '../utils/qr';

interface KioskViewProps {
  sessions: SessionDoc[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  attendeeCounts: Record<string, number>;
  sessionAttendance: AttendanceRecordDoc[];
  qrBaseOrigin: string;
  onGoToConsole: () => void;
}

export function KioskView({
  sessions,
  selectedSessionId,
  onSelectSession,
  attendeeCounts,
  sessionAttendance,
  qrBaseOrigin,
  onGoToConsole,
}: KioskViewProps) {
  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;

  const autoRotateSeconds = activeSession?.autoRotateSeconds ?? 30;

  const [qrState, setQrState] = useState<SessionQrStateDoc | null>(null);
  const [toggling, setToggling] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(autoRotateSeconds);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const kioskRef = useRef<HTMLDivElement | null>(null);
  const autoRotatingRef = useRef(false);

  useEffect(() => {
    if (!activeSession) {
      setQrState(null);
      return;
    }

    const path = `sessions/${activeSession.id}/private/qrState`;
    const unsubscribe = onSnapshot(
      doc(db, 'sessions', activeSession.id, 'private', 'qrState'),
      (snap) => {
        if (snap.exists()) {
          setQrState(snap.data() as SessionQrStateDoc);
        } else {
          setQrState(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [activeSession?.id]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setSecondsLeft(autoRotateSeconds);
  }, [activeSession?.id, qrState?.activeToken, autoRotateSeconds]);

  useEffect(() => {
    if (
      autoRotateSeconds <= 0 ||
      !activeSession ||
      !activeSession.isOpen ||
      activeSession.isEnded ||
      !qrState
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (!autoRotatingRef.current) {
            autoRotatingRef.current = true;
            void rotateSessionQrManually(activeSession, qrState.activeToken)
              .catch(() => {
                // Keep projector view running smoothly on transient timer ticks
              })
              .finally(() => {
                autoRotatingRef.current = false;
              });
          }
          return autoRotateSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    autoRotateSeconds,
    activeSession?.id,
    activeSession?.isOpen,
    activeSession?.isEnded,
    activeSession?.tokenSequence,
    qrState?.activeToken,
  ]);

  const entryOrderMap = useMemo(() => {
    const chronological = [...sessionAttendance].sort((a, b) => {
      const ta = a.checkedInAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.checkedInAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.tokenSequence - b.tokenSequence;
    });
    const map = new Map<string, number>();
    chronological.forEach((rec, idx) => {
      map.set(rec.id, idx + 1);
    });
    return map;
  }, [sessionAttendance]);

  const sortedAttendance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? sessionAttendance.filter(
          (rec) =>
            rec.studentName.toLowerCase().includes(q) ||
            rec.studentEmail.toLowerCase().includes(q)
        )
      : sessionAttendance;

    return [...filtered].sort((a, b) => {
      const ta = a.checkedInAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.checkedInAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) {
        return sortOrder === 'asc' ? ta - tb : tb - ta;
      }
      return sortOrder === 'asc'
        ? a.tokenSequence - b.tokenSequence
        : b.tokenSequence - a.tokenSequence;
    });
  }, [sessionAttendance, searchQuery, sortOrder]);

  if (!activeSession) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center max-w-xl mx-auto">
          <h1 className="text-xl font-semibold text-[#0F172A]">
            No classroom sessions available
          </h1>
          <p className="text-sm text-[#475569] mt-2 leading-relaxed">
            Create a class session in the Instructor Console to display the live QR code in Classroom Attendee.
          </p>
          <button
            type="button"
            onClick={onGoToConsole}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Instructor Console
          </button>
        </div>
      </main>
    );
  }

  let checkInUrl = '';
  if (qrState) {
    try {
      checkInUrl = buildQrCheckInUrl(activeSession.id, qrState.activeToken, qrBaseOrigin);
    } catch {
      checkInUrl = buildQrCheckInUrl(activeSession.id, qrState.activeToken);
    }
  }

  const attendeeCount = attendeeCounts[activeSession.id] || 0;
  const latestRecord = sessionAttendance[0] || null;

  const handleToggleOpen = async () => {
    setActionError(null);
    setToggling(true);
    try {
      await toggleSessionOpen(activeSession.id, !activeSession.isOpen);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not update session status.'
      );
    } finally {
      setToggling(false);
    }
  };

  const handleEndSession = async () => {
    setActionError(null);
    setEndingSession(true);
    try {
      await endClassSession(activeSession.id);
      setConfirmEnd(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not end class session.'
      );
    } finally {
      setEndingSession(false);
    }
  };

  const handleCopyLink = async () => {
    if (!checkInUrl) return;
    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Clipboard access unavailable.');
    }
  };

  const handleFullscreen = async () => {
    if (!kioskRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await kioskRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked in embedded frames
    }
  };

  return (
    <main
      ref={kioskRef}
      className={`min-h-[calc(100vh-4rem)] bg-[#F8FAFC] ${
        isFullscreen ? 'p-8 overflow-y-auto' : 'py-8 px-6 pb-24 md:pb-12'
      }`}
    >
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <label
              htmlFor="attendee-session-select"
              className="text-xs font-medium text-[#64748B] whitespace-nowrap"
            >
              Active Class
            </label>
            <select
              id="attendee-session-select"
              value={activeSession.id}
              onChange={(e) => {
                onSelectSession(e.target.value);
                setConfirmEnd(false);
              }}
              className="min-h-[40px] px-3 py-1.5 text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] max-w-sm truncate"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courseName ? `${s.courseName} · ` : ''}
                  {s.batch ? `${s.batch} · ` : ''}
                  {s.classLab} — {s.title}
                  {s.week ? ` (${s.week})` : ''}
                  {s.isEnded ? ' (Ended)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!activeSession.isEnded && (
              <>
                <button
                  type="button"
                  onClick={() => void handleToggleOpen()}
                  disabled={toggling}
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {activeSession.isOpen ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-[#D97706]" />
                      Pause Class
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#3F6212]" />
                      Resume Class
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  disabled={!checkInUrl}
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#3F6212]" />
                      Copied Link
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#475569]" />
                      Copy Link
                    </>
                  )}
                </button>

                {confirmEnd ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={endingSession}
                      onClick={() => void handleEndSession()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {endingSession ? 'Ending...' : 'Confirm End Class'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEnd(false)}
                      className="px-2.5 py-2 min-h-[40px] text-xs font-medium text-[#475569] hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmEnd(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-[#CBD5E1] rounded-lg bg-white text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Square className="w-3 h-3 fill-current text-[#475569]" />
                    End Class
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => void handleFullscreen()}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors cursor-pointer whitespace-nowrap"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  Fullscreen
                </>
              )}
            </button>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-sm text-[#DC2626] font-medium">
            {actionError}
          </p>
        )}

        <div className="bg-white border border-[#E2E8F0] rounded-xl grid grid-cols-1 lg:grid-cols-12 items-stretch overflow-hidden">
          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-white">
            <div className="text-center mb-6 space-y-1">
              <p className="text-xs font-mono tabular-nums text-[#64748B]">
                QR Sequence #{activeSession.tokenSequence}
              </p>
              {activeSession.isEnded ? (
                <p className="text-lg font-semibold text-[#0F172A]">
                  Class session ended
                </p>
              ) : !activeSession.isOpen ? (
                <p className="text-lg font-semibold text-[#B45309]">
                  Check-ins paused
                </p>
              ) : autoRotateSeconds > 0 ? (
                <p className="text-lg font-semibold font-mono tabular-nums text-[#3F6212]">
                  Refreshes in {secondsLeft}s
                </p>
              ) : (
                <p className="text-sm font-medium text-[#475569]">
                  Manual QR rotation
                </p>
              )}
            </div>

            {activeSession.isEnded ? (
              <div className="w-[300px] h-[300px] border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center space-y-3">
                <p className="text-base font-semibold text-[#0F172A]">
                  Session Ended
                </p>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Check-ins are closed. This class and all attendee records remain saved in Instructor Console History.
                </p>
                <button
                  type="button"
                  onClick={onGoToConsole}
                  className="mt-2 inline-flex items-center justify-center px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors cursor-pointer whitespace-nowrap"
                >
                  View Class History
                </button>
              </div>
            ) : !activeSession.isOpen ? (
              <div className="w-[300px] h-[300px] border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
                <p className="text-base font-semibold text-[#0F172A]">
                  Session Paused
                </p>
                <p className="text-sm text-[#64748B] mt-1.5">
                  Click Resume Class above to display the active QR code.
                </p>
              </div>
            ) : qrState ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={qrState.activeToken}
                  initial={{ opacity: 0.4, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="p-6 bg-white border border-[#E2E8F0] rounded-xl"
                >
                  <QRCodeSVG
                    value={checkInUrl}
                    size={isFullscreen ? 340 : 280}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#0F172A"
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="w-[300px] h-[300px] bg-[#F1F5F9] rounded-xl animate-pulse" />
            )}
          </div>

          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-[#F8FAFC]">
            <div className="space-y-6">
              <div>
                {activeSession.courseName && (
                  <p className="text-xs font-semibold text-[#3F6212] mb-1">
                    {activeSession.courseName}
                    {activeSession.batch ? ` · ${activeSession.batch}` : ''}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                  <span className="font-medium text-[#0F172A]">
                    {activeSession.classLab}
                  </span>
                  {activeSession.week && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#3F6212]">
                        {activeSession.week}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Trainer {activeSession.trainerName}</span>
                  {formatSessionDateLabel(activeSession.sessionDate) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatSessionDateLabel(activeSession.sessionDate)}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      activeSession.isEnded
                        ? 'text-[#334155] font-semibold'
                        : activeSession.isOpen
                          ? 'text-[#3F6212] font-semibold'
                          : 'text-[#B45309] font-semibold'
                    }
                  >
                    {activeSession.isEnded
                      ? 'Ended'
                      : activeSession.isOpen
                        ? 'Accepting check-ins'
                        : 'Paused'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] mt-2">
                  {activeSession.title}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-6 py-4 border-y border-[#E2E8F0]">
                <div>
                  <p className="text-xs text-[#64748B]">Students Clocked In</p>
                  <p className="text-3xl font-bold font-mono tabular-nums text-[#0F172A] mt-1">
                    {attendeeCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Current QR Code</p>
                  <p className="text-3xl font-bold font-mono tabular-nums text-[#3F6212] mt-1">
                    #{activeSession.tokenSequence}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#64748B]">
                  Latest Student Check-In
                </p>
                {latestRecord ? (
                  <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">
                        {latestRecord.studentName}
                      </p>
                      <p className="text-xs text-[#475569] truncate">
                        {latestRecord.studentEmail}
                      </p>
                      <p className="text-xs text-[#3F6212] font-medium mt-1">
                        Checked in · QR #{latestRecord.tokenSequence}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-[#64748B] whitespace-nowrap shrink-0">
                      {latestRecord.checkedInAt
                        ? latestRecord.checkedInAt.toDate().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Just now'}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-[#475569]">
                    Waiting for students to scan the QR code to record attendance.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Attendance Roster
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#64748B]">
                {sessionAttendance.length}{' '}
                {sessionAttendance.length === 1 ? 'student' : 'students'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-64 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name or email..."
                  aria-label="Filter attendance roster"
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#475569]" />
                <span>
                  {sortOrder === 'asc'
                    ? 'Time of Entry: Earliest'
                    : 'Time of Entry: Latest'}
                </span>
              </button>
            </div>
          </div>

          {sortedAttendance.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-[#0F172A]">
                {sessionAttendance.length === 0
                  ? 'No students checked in yet'
                  : 'No students match your filter'}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                {sessionAttendance.length === 0
                  ? 'Student names, emails, status, and entry timestamps will appear live as they scan.'
                  : 'Clear the search box to show all checked-in students.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">QR Seq</th>
                    <th className="py-3 px-4 text-right">Time of Entry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {sortedAttendance.map((rec, index) => {
                    const entryNumber = entryOrderMap.get(rec.id) ?? index + 1;
                    const timeStr = rec.checkedInAt
                      ? rec.checkedInAt.toDate().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                          {entryNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#0F172A]">
                          {rec.studentName}
                        </td>
                        <td className="py-3 px-4 text-[#475569]">
                          {rec.studentEmail}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#F7FEE7] border border-[#BEF264] text-[#365314] text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3F6212]" />
                            Checked In
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] whitespace-nowrap">
                          #{rec.tokenSequence}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0F172A] whitespace-nowrap">
                          {timeStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
