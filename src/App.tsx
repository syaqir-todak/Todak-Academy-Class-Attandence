import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { LayoutDashboard, Monitor, QrCode } from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ADMIN_EMAIL,
  COURSES,
  type AppView,
  type AttendanceRecordDoc,
  type CourseCuConfigDoc,
  type SessionDoc,
} from './types';
import { buildMergedCourseConfig } from './utils/attendance';
import {
  getStoredQrBaseOrigin,
  parseQrPayload,
  setStoredQrBaseOrigin,
} from './utils/qr';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthView } from './components/AuthView';
import { StudentCheckInView } from './components/StudentCheckInView';
import { InstructorConsoleView } from './components/InstructorConsoleView';
import { KioskView } from './components/KioskView';

function readInitialScanFromUrl(): { sessionId: string; token: string } | null {
  if (!window.location.search) return null;
  return parseQrPayload(window.location.href);
}

const TODAK_LOGO_PATH = '/assets/aistudio/NEW_TODAK_ACADEMY_BLACK_ENG_cac8403d.png';

function TodakAttendanceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);

  const [initialScan, setInitialScan] = useState<{
    sessionId: string;
    token: string;
  } | null>(() => readInitialScanFromUrl());

  const [activeView, setActiveView] = useState<AppView>('checkin');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [qrBaseOrigin, setQrBaseOrigin] = useState<string>(() =>
    getStoredQrBaseOrigin()
  );

  const handleChangeQrBaseOrigin = (nextOrigin: string) => {
    setQrBaseOrigin(nextOrigin);
    setStoredQrBaseOrigin(nextOrigin);
  };

  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecordDoc[]>([]);
  const [instructorAttendance, setInstructorAttendance] = useState<
    AttendanceRecordDoc[]
  >([]);
  const [courseConfigs, setCourseConfigs] = useState<
    Record<string, CourseCuConfigDoc>
  >(() => {
    const initial: Record<string, CourseCuConfigDoc> = {};
    for (const c of COURSES) {
      initial[c.id] = buildMergedCourseConfig(c.id);
    }
    return initial;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setIsInstructor(false);
        setRoleChecked(true);
      } else {
        setRoleChecked(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    const verifyRole = async () => {
      let instructorAccess = user.email === ADMIN_EMAIL && user.emailVerified;
      if (!instructorAccess && user.emailVerified) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          instructorAccess = adminDoc.exists();
        } catch {
          instructorAccess = false;
        }
      }

      if (cancelled) return;
      setIsInstructor(instructorAccess);
      setRoleChecked(true);
      if (!instructorAccess) {
        setActiveView('checkin');
      } else if (!initialScan) {
        setActiveView('console');
      }
    };

    void verifyRole();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !roleChecked || !user) {
      setSessions([]);
      setMyAttendance([]);
      setInstructorAttendance([]);
      return;
    }

    const myAttendanceQuery = query(
      collection(db, 'attendance'),
      where('studentUid', '==', user.uid)
    );

    const unsubMyAttendance = onSnapshot(
      myAttendanceQuery,
      (snapshot) => {
        const list: AttendanceRecordDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AttendanceRecordDoc, 'id'>),
        }));
        list.sort((a, b) => {
          const ta = a.checkedInAt?.toMillis() ?? 0;
          const tb = b.checkedInAt?.toMillis() ?? 0;
          return tb - ta;
        });
        setMyAttendance(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    );

    const configsQuery = query(collection(db, 'courseCuConfigs'));
    const unsubConfigs = onSnapshot(
      configsQuery,
      (snapshot) => {
        const next: Record<string, CourseCuConfigDoc> = {};
        for (const c of COURSES) {
          next[c.id] = buildMergedCourseConfig(c.id);
        }
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as CourseCuConfigDoc;
          next[docSnap.id] = buildMergedCourseConfig(docSnap.id, data);
        }
        setCourseConfigs(next);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'courseCuConfigs');
      }
    );

    if (!isInstructor) {
      setSessions([]);
      setInstructorAttendance([]);
      return () => {
        unsubMyAttendance();
        unsubConfigs();
      };
    }

    const sessionsQuery = query(collection(db, 'sessions'));
    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const list: SessionDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SessionDoc, 'id'>),
        }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis() ?? 0;
          const tb = b.createdAt?.toMillis() ?? 0;
          return tb - ta;
        });
        setSessions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      }
    );

    const instructorAttendanceQuery = query(collection(db, 'attendance'));
    const unsubInstructorAttendance = onSnapshot(
      instructorAttendanceQuery,
      (snapshot) => {
        const list: AttendanceRecordDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AttendanceRecordDoc, 'id'>),
        }));
        list.sort((a, b) => {
          const ta = a.checkedInAt?.toMillis() ?? 0;
          const tb = b.checkedInAt?.toMillis() ?? 0;
          return tb - ta;
        });
        setInstructorAttendance(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    );

    return () => {
      unsubMyAttendance();
      unsubConfigs();
      unsubSessions();
      unsubInstructorAttendance();
    };
  }, [authReady, roleChecked, user, isInstructor]);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      const firstActive = sessions.find((s) => !s.isEnded);
      setSelectedSessionId((firstActive || sessions[0]).id);
    } else if (
      sessions.length > 0 &&
      selectedSessionId &&
      !sessions.some((s) => s.id === selectedSessionId)
    ) {
      const firstActive = sessions.find((s) => !s.isEnded);
      setSelectedSessionId((firstActive || sessions[0]).id);
    }
  }, [sessions, selectedSessionId]);

  const attendeeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rec of instructorAttendance) {
      counts[rec.sessionId] = (counts[rec.sessionId] || 0) + 1;
    }
    return counts;
  }, [instructorAttendance]);

  const kioskSessionAttendance = useMemo(() => {
    const activeId = selectedSessionId || sessions[0]?.id;
    if (!activeId) return [];
    return instructorAttendance.filter((r) => r.sessionId === activeId);
  }, [instructorAttendance, selectedSessionId, sessions]);

  const handleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady || (user && !roleChecked)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Loading Todak Academy...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveView(isInstructor ? 'console' : 'checkin')}
            aria-label="Todak Academy Home"
            className="flex items-center whitespace-nowrap shrink-0 cursor-pointer"
          >
            {headerLogoFailed ? (
              <span className="text-lg font-bold tracking-tight text-[#0F172A]">
                Todak Academy
              </span>
            ) : (
              <img
                src={TODAK_LOGO_PATH}
                alt="Todak Academy"
                referrerPolicy="no-referrer"
                onError={() => setHeaderLogoFailed(true)}
                className="h-9 sm:h-10 w-auto object-contain object-left"
              />
            )}
          </button>

          {user && isInstructor && (
            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              {(
                [
                  ['checkin', 'Student Check-In'],
                  ['console', 'Instructor Console'],
                  ['kiosk', 'Classroom Attendee'],
                ] as const
              ).map(([viewKey, label]) => {
                const isActive = activeView === viewKey;
                return (
                  <button
                    key={viewKey}
                    type="button"
                    onClick={() => setActiveView(viewKey)}
                    className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'border-[#4D7C0F] text-[#0F172A]'
                        : 'border-transparent text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={signingIn}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {signingIn ? 'Signing In...' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </header>

      {!user ? (
        <AuthView
          onSignIn={handleSignIn}
          signingIn={signingIn}
          authError={authError}
          pendingScan={initialScan}
        />
      ) : !isInstructor || activeView === 'checkin' ? (
        <StudentCheckInView
          user={user}
          initialScan={initialScan}
          onClearInitialScan={() => setInitialScan(null)}
          myAttendance={myAttendance}
          courseConfigs={courseConfigs}
        />
      ) : activeView === 'console' ? (
        <InstructorConsoleView
          user={user}
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          allInstructorAttendance={instructorAttendance}
          courseConfigs={courseConfigs}
          qrBaseOrigin={qrBaseOrigin}
          onChangeQrBaseOrigin={handleChangeQrBaseOrigin}
          onLaunchKiosk={(sessionId) => {
            setSelectedSessionId(sessionId);
            setActiveView('kiosk');
          }}
        />
      ) : (
        <KioskView
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          attendeeCounts={attendeeCounts}
          sessionAttendance={kioskSessionAttendance}
          qrBaseOrigin={qrBaseOrigin}
          onGoToConsole={() => setActiveView('console')}
        />
      )}

      {user && isInstructor && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur border-t border-[#E2E8F0] grid grid-cols-3 items-center"
        >
          <button
            type="button"
            onClick={() => setActiveView('checkin')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
              activeView === 'checkin' ? 'text-[#3F6212]' : 'text-[#64748B]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Check-In</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('console')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
              activeView === 'console' ? 'text-[#3F6212]' : 'text-[#64748B]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Console</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('kiosk')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
              activeView === 'kiosk' ? 'text-[#3F6212]' : 'text-[#64748B]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Attendee</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TodakAttendanceApp />
    </ErrorBoundary>
  );
}
