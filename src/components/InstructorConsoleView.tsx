import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Archive,
  Check,
  Copy,
  Download,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import {
  CAMPUS_ROOMS,
  COURSES,
  QR_ROTATE_INTERVALS,
  STANDALONE_CLASS_TYPES,
  type AttendanceRecordDoc,
  type CourseCuConfigDoc,
  type CourseId,
  type CuUnitConfig,
  type SessionDoc,
} from '../types';
import {
  createSessionWithQr,
  deleteSessionAndState,
  endClassSession,
  removeAttendanceAndUnlockDevice,
  rotateSessionQrManually,
  saveCourseCuConfig,
  toggleSessionOpen,
  updateSessionAutoRotateSeconds,
  updateSessionDetails,
} from '../services/attendanceService';
import {
  buildMergedCourseConfig,
  buildSessionCsvFilename,
  calculateStudentCuProgress,
  compileFullCuAttendanceCsv,
  escapeCsvCellValue,
  findUnitInConfig,
  getCourseById,
  getDefaultUnitList,
  getMinRequiredDaysFor80,
  isTaklimatUnit,
  isValidCuCode,
  normalizeCuCode,
} from '../utils/attendance';
import {
  formatSessionDateLabel,
  getTodayDateInputValue,
  isDevPreviewOrigin,
  isValidDateInputValue,
} from '../utils/qr';
import { CuEligibilityFlag, CuProgressMeter } from './CuEligibilityStatus';

interface InstructorConsoleViewProps {
  user: User;
  sessions: SessionDoc[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  allInstructorAttendance: AttendanceRecordDoc[];
  courseConfigs: Record<string, CourseCuConfigDoc>;
  qrBaseOrigin: string;
  onChangeQrBaseOrigin: (origin: string) => void;
  onLaunchKiosk: (sessionId: string) => void;
}

type ConsoleSubTab = 'sessions' | 'progress' | 'setup';
type EligibilityFilter = 'all' | 'eligible' | 'below';
type SessionMode = 'program' | 'standalone';

function cloneUnitList(list: CuUnitConfig[]): CuUnitConfig[] {
  return list.map((item) => ({ ...item }));
}

export function InstructorConsoleView({
  user,
  sessions,
  selectedSessionId,
  onSelectSession,
  allInstructorAttendance,
  courseConfigs,
  qrBaseOrigin,
  onChangeQrBaseOrigin,
  onLaunchKiosk,
}: InstructorConsoleViewProps) {
  const [consoleTab, setConsoleTab] = useState<ConsoleSubTab>('sessions');

  const activeSessions = useMemo(
    () => sessions.filter((s) => !s.isEnded),
    [sessions]
  );
  const endedSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => Boolean(s.isEnded))
        .sort((a, b) => {
          const ta = a.endedAt?.toMillis() ?? a.updatedAt?.toMillis() ?? 0;
          const tb = b.endedAt?.toMillis() ?? b.updatedAt?.toMillis() ?? 0;
          return tb - ta;
        }),
    [sessions]
  );

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) || null;

  const [sessionFilter, setSessionFilter] = useState<'active' | 'history'>(() =>
    selectedSession?.isEnded ||
    (activeSessions.length === 0 && endedSessions.length > 0)
      ? 'history'
      : 'active'
  );
  const [sidebarCourseFilter, setSidebarCourseFilter] = useState<string>('all');
  const [sidebarCuFilter, setSidebarCuFilter] = useState<string>('all');
  const [sidebarBatchFilter, setSidebarBatchFilter] = useState<string>('all');
  const [historyWeekFilter, setHistoryWeekFilter] = useState<string>('all');

  const availableSessionBatches = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const b = (s.batch || '').trim();
      if (b) set.add(b);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [sessions]);

  const sidebarCuFilterChoices = useMemo(() => {
    if (sidebarCourseFilter === '__standalone__') {
      return [];
    }
    if (sidebarCourseFilter !== 'all') {
      const validCourse = getCourseById(sidebarCourseFilter);
      if (!validCourse) return [];
      return buildMergedCourseConfig(
        validCourse.id,
        courseConfigs[validCourse.id]
      ).unitList.map((u) => u.cuCode);
    }
    const set = new Set<string>();
    for (const c of COURSES) {
      const cfg = buildMergedCourseConfig(c.id, courseConfigs[c.id]);
      for (const u of cfg.unitList) set.add(u.cuCode);
    }
    for (const s of sessions) {
      if (s.cuCode) set.add(s.cuCode);
    }
    return Array.from(set);
  }, [sidebarCourseFilter, courseConfigs, sessions]);

  const availableHistoryWeeks = useMemo(() => {
    const set = new Set<string>();
    let hasUnspecified = false;
    for (const s of endedSessions) {
      const w = (s.week || '').trim();
      if (w) {
        set.add(w);
      } else {
        hasUnspecified = true;
      }
    }
    const sorted = Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { weeks: sorted, hasUnspecified };
  }, [endedSessions]);

  const baseList = sessionFilter === 'active' ? activeSessions : endedSessions;

  const visibleSessions = useMemo(() => {
    return baseList.filter((s) => {
      if (sidebarCourseFilter === '__standalone__') {
        if (s.courseId && getCourseById(s.courseId)) return false;
      } else if (
        sidebarCourseFilter !== 'all' &&
        s.courseId !== sidebarCourseFilter
      ) {
        return false;
      }
      if (sidebarCuFilter !== 'all' && s.cuCode !== sidebarCuFilter) {
        return false;
      }
      if (sidebarBatchFilter !== 'all') {
        const b = (s.batch || '').trim();
        if (b !== sidebarBatchFilter) return false;
      }
      if (sessionFilter === 'history' && historyWeekFilter !== 'all') {
        const w = (s.week || '').trim();
        if (historyWeekFilter === '__none__') {
          if (w) return false;
        } else if (w !== historyWeekFilter) {
          return false;
        }
      }
      return true;
    });
  }, [
    baseList,
    sidebarCourseFilter,
    sidebarCuFilter,
    sidebarBatchFilter,
    sessionFilter,
    historyWeekFilter,
  ]);

  useEffect(() => {
    if (visibleSessions.length > 0) {
      const stillVisible = visibleSessions.some(
        (s) => s.id === selectedSessionId
      );
      if (!stillVisible) {
        onSelectSession(visibleSessions[0].id);
      }
    }
  }, [visibleSessions, selectedSessionId, onSelectSession]);

  const activeSession =
    (selectedSession &&
    visibleSessions.some((s) => s.id === selectedSession.id)
      ? selectedSession
      : visibleSessions[0]) || null;

  const defaultTrainer = user.displayName || user.email?.split('@')[0] || '';

  // Create session form state
  const [showCreateForm, setShowCreateForm] = useState(sessions.length === 0);
  const [sessionMode, setSessionMode] = useState<SessionMode>('program');
  const [standaloneType, setStandaloneType] = useState<string>(
    STANDALONE_CLASS_TYPES[0]
  );
  const [customStandaloneLabel, setCustomStandaloneLabel] = useState('');
  const [courseId, setCourseId] = useState<CourseId>('dkm-creative-multimedia');

  const createCourseUnitList = useMemo(
    () => buildMergedCourseConfig(courseId, courseConfigs[courseId]).unitList,
    [courseId, courseConfigs]
  );

  const [cuCode, setCuCode] = useState<string>(
    () =>
      buildMergedCourseConfig(
        'dkm-creative-multimedia',
        courseConfigs['dkm-creative-multimedia']
      ).unitList[0]?.cuCode || 'CU01'
  );
  const [batch, setBatch] = useState('Batch 1');
  const [trainerName, setTrainerName] = useState(defaultTrainer);
  const [classLab, setClassLab] = useState<string>(CAMPUS_ROOMS[0]);
  const [week, setWeek] = useState('');
  const [title, setTitle] = useState(() => {
    const first = buildMergedCourseConfig(
      'dkm-creative-multimedia',
      courseConfigs['dkm-creative-multimedia']
    ).unitList[0];
    return first?.unitName || '';
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => getTodayDateInputValue());
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync valid cuCode whenever selected course changes
  useEffect(() => {
    const exists = createCourseUnitList.some((u) => u.cuCode === cuCode);
    if (!exists && createCourseUnitList[0]) {
      setCuCode(createCourseUnitList[0].cuCode);
    }
  }, [createCourseUnitList, cuCode]);

  useEffect(() => {
    if (sessionMode === 'program' && !titleManuallyEdited) {
      const unit = createCourseUnitList.find((u) => u.cuCode === cuCode);
      if (unit) {
        setTitle(unit.unitName);
      }
    }
  }, [sessionMode, createCourseUnitList, cuCode, titleManuallyEdited]);

  // Edit session form state
  const [isEditing, setIsEditing] = useState(false);
  const [editSessionMode, setEditSessionMode] =
    useState<SessionMode>('program');
  const [editStandaloneType, setEditStandaloneType] = useState<string>(
    STANDALONE_CLASS_TYPES[0]
  );
  const [editCustomStandaloneLabel, setEditCustomStandaloneLabel] =
    useState('');
  const [editCourseId, setEditCourseId] = useState<CourseId>(COURSES[0].id);
  const [editCuCode, setEditCuCode] = useState<string>('CU01');
  const [editBatch, setEditBatch] = useState('');
  const [editTrainerName, setEditTrainerName] = useState('');
  const [editClassLab, setEditClassLab] = useState<string>(CAMPUS_ROOMS[0]);
  const [editWeek, setEditWeek] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSessionDate, setEditSessionDate] = useState(() =>
    getTodayDateInputValue()
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const editCourseUnitList = useMemo(() => {
    const list = buildMergedCourseConfig(
      editCourseId,
      courseConfigs[editCourseId]
    ).unitList;
    if (editCuCode && !list.some((u) => u.cuCode === editCuCode)) {
      return [
        {
          cuCode: editCuCode,
          unitName: editCuCode,
          weeks: 1,
          targetDays: 5,
        },
        ...list,
      ];
    }
    return list;
  }, [editCourseId, courseConfigs, editCuCode]);

  // Session actions & log state
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRemoveRecordId, setConfirmRemoveRecordId] = useState<
    string | null
  >(null);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [csvDownloaded, setCsvDownloaded] = useState(false);
  const [sessionFullCuDownloaded, setSessionFullCuDownloaded] = useState(false);
  const [copiedMarkers, setCopiedMarkers] = useState(false);
  const [rotatingQr, setRotatingQr] = useState(false);
  const [savingRotateInterval, setSavingRotateInterval] = useState(false);

  // CU Progress & 80% Exam Eligibility state
  const [progressCourseFilter, setProgressCourseFilter] =
    useState<string>('all');
  const [progressBatchFilter, setProgressBatchFilter] = useState<string>('all');
  const [progressCuFilter, setProgressCuFilter] = useState<string>('all');
  const [progressStatusFilter, setProgressStatusFilter] =
    useState<EligibilityFilter>('all');
  const [progressSearch, setProgressSearch] = useState('');
  const [progressCsvDownloaded, setProgressCsvDownloaded] = useState(false);
  const [progressFullCuDownloaded, setProgressFullCuDownloaded] =
    useState(false);

  // Editable CU Setup state
  const [setupCourseId, setSetupCourseId] = useState<CourseId>(
    'dkm-creative-multimedia'
  );
  const [draftUnits, setDraftUnits] = useState<CuUnitConfig[]>(() =>
    cloneUnitList(
      buildMergedCourseConfig(
        'dkm-creative-multimedia',
        courseConfigs['dkm-creative-multimedia']
      ).unitList
    )
  );
  const [setupDirty, setSetupDirty] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupSavedMessage, setSetupSavedMessage] = useState<string | null>(
    null
  );
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (!setupDirty) {
      const merged = buildMergedCourseConfig(
        setupCourseId,
        courseConfigs[setupCourseId]
      );
      setDraftUnits(cloneUnitList(merged.unitList));
    }
  }, [setupCourseId, courseConfigs, setupDirty]);

  const sessionAttendance = useMemo(() => {
    if (!activeSession) return [];
    return allInstructorAttendance
      .filter((r) => r.sessionId === activeSession.id)
      .sort((a, b) => {
        const ta = a.checkedInAt?.toMillis() ?? 0;
        const tb = b.checkedInAt?.toMillis() ?? 0;
        return ta - tb;
      });
  }, [allInstructorAttendance, activeSession]);

  const filteredAttendance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessionAttendance;
    return sessionAttendance.filter(
      (rec) =>
        rec.studentName.toLowerCase().includes(q) ||
        rec.studentEmail.toLowerCase().includes(q)
    );
  }, [sessionAttendance, searchQuery]);

  // Cumulative CU progress rows across all instructor attendance
  const allCuProgress = useMemo(
    () => calculateStudentCuProgress(allInstructorAttendance, courseConfigs),
    [allInstructorAttendance, courseConfigs]
  );

  const cuProgressByKey = useMemo(() => {
    const map = new Map<string, (typeof allCuProgress)[number]>();
    for (const row of allCuProgress) {
      map.set(row.key, row);
    }
    return map;
  }, [allCuProgress]);

  const availableProgressBatches = useMemo(() => {
    const set = new Set<string>(availableSessionBatches);
    for (const row of allCuProgress) {
      if (row.batch) set.add(row.batch);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [availableSessionBatches, allCuProgress]);

  const progressCuChoices = useMemo(() => {
    if (progressCourseFilter !== 'all') {
      return buildMergedCourseConfig(
        progressCourseFilter as CourseId,
        courseConfigs[progressCourseFilter]
      ).unitList.map((u) => ({
        cuCode: u.cuCode,
        label: `${u.cuCode} · ${u.unitName}`,
      }));
    }
    const map = new Map<string, string>();
    for (const c of COURSES) {
      const cfg = buildMergedCourseConfig(c.id, courseConfigs[c.id]);
      for (const u of cfg.unitList) {
        if (!map.has(u.cuCode)) {
          map.set(u.cuCode, `${u.cuCode} · ${u.unitName}`);
        }
      }
    }
    return Array.from(map.entries()).map(([code, label]) => ({
      cuCode: code,
      label,
    }));
  }, [progressCourseFilter, courseConfigs]);

  const filteredCuProgress = useMemo(() => {
    const q = progressSearch.trim().toLowerCase();
    return allCuProgress.filter((row) => {
      if (
        progressCourseFilter !== 'all' &&
        row.courseId !== progressCourseFilter
      ) {
        return false;
      }
      if (progressBatchFilter !== 'all' && row.batch !== progressBatchFilter) {
        return false;
      }
      if (progressCuFilter !== 'all' && row.cuCode !== progressCuFilter) {
        return false;
      }
      if (progressStatusFilter === 'eligible' && !row.isExamEligible) {
        return false;
      }
      if (progressStatusFilter === 'below' && row.isExamEligible) {
        return false;
      }
      if (q) {
        const matchesStudent =
          row.studentName.toLowerCase().includes(q) ||
          row.studentEmail.toLowerCase().includes(q) ||
          row.unitName.toLowerCase().includes(q) ||
          row.cuCode.toLowerCase().includes(q);
        if (!matchesStudent) return false;
      }
      return true;
    });
  }, [
    allCuProgress,
    progressCourseFilter,
    progressBatchFilter,
    progressCuFilter,
    progressStatusFilter,
    progressSearch,
  ]);

  const progressStats = useMemo(() => {
    const total = filteredCuProgress.length;
    const eligible = filteredCuProgress.filter((r) => r.isExamEligible).length;
    const below = total - eligible;

    let selectedUnitPreview: CuUnitConfig | null = null;
    if (progressCourseFilter !== 'all' && isValidCuCode(progressCuFilter)) {
      const cfg = buildMergedCourseConfig(
        progressCourseFilter as CourseId,
        courseConfigs[progressCourseFilter]
      );
      selectedUnitPreview = findUnitInConfig(cfg, progressCuFilter);
    }

    return { total, eligible, below, selectedUnitPreview };
  }, [
    filteredCuProgress,
    progressCourseFilter,
    progressCuFilter,
    courseConfigs,
  ]);

  const activeSessionFullCuCsv = useMemo(() => {
    const validCourse = getCourseById(activeSession?.courseId);
    if (
      !validCourse ||
      !activeSession?.cuCode ||
      !isValidCuCode(activeSession.cuCode)
    ) {
      return null;
    }
    return compileFullCuAttendanceCsv({
      courseId: validCourse.id,
      cuCode: activeSession.cuCode,
      batchFilter: activeSession.batch?.trim() || 'all',
      sessions,
      records: allInstructorAttendance,
      courseConfigs,
    });
  }, [activeSession, sessions, allInstructorAttendance, courseConfigs]);

  const progressFullCuCsv = useMemo(() => {
    if (
      progressCourseFilter === 'all' ||
      progressCuFilter === 'all' ||
      !isValidCuCode(progressCuFilter)
    ) {
      return null;
    }
    return compileFullCuAttendanceCsv({
      courseId: progressCourseFilter as CourseId,
      cuCode: progressCuFilter,
      batchFilter: progressBatchFilter,
      sessions,
      records: allInstructorAttendance,
      courseConfigs,
    });
  }, [
    progressCourseFilter,
    progressCuFilter,
    progressBatchFilter,
    sessions,
    allInstructorAttendance,
    courseConfigs,
  ]);

  const setupTotals = useMemo(() => {
    const totalModules = draftUnits.length;
    const totalWeeks = draftUnits.reduce(
      (sum, u) => sum + (Number(u.weeks) || 0),
      0
    );
    const totalDays = draftUnits.reduce(
      (sum, u) => sum + (Number(u.targetDays) || 0),
      0
    );
    const mergedMeta = buildMergedCourseConfig(
      setupCourseId,
      courseConfigs[setupCourseId]
    );
    return {
      totalModules,
      totalWeeks,
      totalDays,
      excludedHolidays: mergedMeta.excludedHolidays || [],
    };
  }, [draftUnits, setupCourseId, courseConfigs]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (trainerName.trim().length < 1) {
      setFormError('Trainer Name is required.');
      return;
    }
    if (sessionMode === 'program' && batch.trim().length < 1) {
      setFormError('Batch is required for Program & CU classes (e.g. Batch 1).');
      return;
    }
    if (classLab.trim().length < 1) {
      setFormError('Class / Lab is required.');
      return;
    }
    if (title.trim().length < 2) {
      setFormError('Session Class Title must be at least 2 characters.');
      return;
    }
    if (!isValidDateInputValue(sessionDate)) {
      setFormError('Please select a valid Class Date.');
      return;
    }

    const standaloneLabel =
      standaloneType === '__none__'
        ? ''
        : standaloneType === '__custom__'
          ? customStandaloneLabel.trim()
          : standaloneType;

    setCreating(true);
    try {
      const newId = await createSessionWithQr(user, {
        trainerName: trainerName.trim(),
        classLab: classLab.trim(),
        courseId: sessionMode === 'program' ? courseId : undefined,
        courseName: sessionMode === 'standalone' ? standaloneLabel : undefined,
        cuCode: sessionMode === 'program' ? cuCode : undefined,
        batch: batch.trim(),
        week: week.trim(),
        title: title.trim(),
        sessionDate: sessionDate.trim(),
      });
      setSessionFilter('active');
      onSelectSession(newId);
      setClassLab(CAMPUS_ROOMS[0]);
      setWeek('');
      setTitleManuallyEdited(false);
      if (sessionMode === 'program') {
        const unit = createCourseUnitList.find((u) => u.cuCode === cuCode);
        setTitle(unit?.unitName || '');
      } else {
        setTitle('');
        setCustomStandaloneLabel('');
      }
      setSessionDate(getTodayDateInputValue());
      setShowCreateForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create class session.'
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditForm = () => {
    if (!activeSession || activeSession.isEnded) return;
    const matchedCourse = getCourseById(activeSession.courseId);
    if (matchedCourse) {
      setEditSessionMode('program');
      setEditCourseId(matchedCourse.id);
      const defaultCode =
        buildMergedCourseConfig(
          matchedCourse.id,
          courseConfigs[matchedCourse.id]
        ).unitList[0]?.cuCode || 'CU01';
      setEditCuCode(
        isValidCuCode(activeSession.cuCode) ? activeSession.cuCode : defaultCode
      );
      setEditStandaloneType(STANDALONE_CLASS_TYPES[0]);
      setEditCustomStandaloneLabel('');
    } else {
      setEditSessionMode('standalone');
      setEditCourseId(COURSES[0].id);
      setEditCuCode(
        buildMergedCourseConfig(
          COURSES[0].id,
          courseConfigs[COURSES[0].id]
        ).unitList[0]?.cuCode || 'CU01'
      );
      const existingLabel = (activeSession.courseName || '').trim();
      if (!existingLabel) {
        setEditStandaloneType('__none__');
        setEditCustomStandaloneLabel('');
      } else if (
        STANDALONE_CLASS_TYPES.includes(
          existingLabel as (typeof STANDALONE_CLASS_TYPES)[number]
        )
      ) {
        setEditStandaloneType(existingLabel);
        setEditCustomStandaloneLabel('');
      } else {
        setEditStandaloneType('__custom__');
        setEditCustomStandaloneLabel(existingLabel);
      }
    }
    setEditBatch(activeSession.batch || '');
    setEditTrainerName(activeSession.trainerName);
    setEditClassLab(activeSession.classLab || CAMPUS_ROOMS[0]);
    setEditWeek(activeSession.week || '');
    setEditTitle(activeSession.title);
    setEditSessionDate(activeSession.sessionDate || getTodayDateInputValue());
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || activeSession.isEnded) return;
    setEditError(null);

    if (editTrainerName.trim().length < 1) {
      setEditError('Trainer Name is required.');
      return;
    }
    if (editSessionMode === 'program' && editBatch.trim().length < 1) {
      setEditError('Batch is required for Program & CU classes.');
      return;
    }
    if (editClassLab.trim().length < 1) {
      setEditError('Class / Lab is required.');
      return;
    }
    if (editTitle.trim().length < 2) {
      setEditError('Session Class Title must be at least 2 characters.');
      return;
    }
    if (!isValidDateInputValue(editSessionDate)) {
      setEditError('Please select a valid Class Date.');
      return;
    }

    const editStandaloneLabel =
      editStandaloneType === '__none__'
        ? ''
        : editStandaloneType === '__custom__'
          ? editCustomStandaloneLabel.trim()
          : editStandaloneType;

    setSavingEdit(true);
    try {
      await updateSessionDetails(activeSession.id, {
        trainerName: editTrainerName.trim(),
        classLab: editClassLab.trim(),
        courseId: editSessionMode === 'program' ? editCourseId : undefined,
        courseName:
          editSessionMode === 'standalone' ? editStandaloneLabel : undefined,
        cuCode: editSessionMode === 'program' ? editCuCode : undefined,
        batch: editBatch.trim(),
        week: editWeek.trim(),
        title: editTitle.trim(),
        sessionDate: editSessionDate.trim(),
      });
      setIsEditing(false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Failed to update session details.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    setConsoleError(null);
    setEndingSession(true);
    try {
      await endClassSession(sessionId);
      setConfirmEndId(null);
      setIsEditing(false);
      setSessionFilter('history');
      setHistoryWeekFilter('all');
      onSelectSession(sessionId);
    } catch (err) {
      setConsoleError(
        err instanceof Error ? err.message : 'Unable to end class session.'
      );
    } finally {
      setEndingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setConsoleError(null);
    try {
      await deleteSessionAndState(sessionId);
      setConfirmDeleteId(null);
      setIsEditing(false);
    } catch (err) {
      setConsoleError(
        err instanceof Error ? err.message : 'Unable to delete session.'
      );
    }
  };

  const handleChangeRotateInterval = async (seconds: number) => {
    if (!activeSession || activeSession.isEnded) return;
    setConsoleError(null);
    setSavingRotateInterval(true);
    try {
      await updateSessionAutoRotateSeconds(activeSession.id, seconds);
    } catch (err) {
      setConsoleError(
        err instanceof Error ? err.message : 'Could not update QR timer.'
      );
    } finally {
      setSavingRotateInterval(false);
    }
  };

  const handleManualRotateQr = async () => {
    if (!activeSession || activeSession.isEnded) return;
    setConsoleError(null);
    setRotatingQr(true);
    try {
      await rotateSessionQrManually(activeSession);
    } catch (err) {
      setConsoleError(
        err instanceof Error ? err.message : 'Could not rotate QR code.'
      );
    } finally {
      setRotatingQr(false);
    }
  };

  const triggerCsvDownload = (filename: string, csvContent: string) => {
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!activeSession || sessionAttendance.length === 0) return;

    const headers = ['Date', 'Student Name'];
    const fallbackDate =
      activeSession.sessionDate || getTodayDateInputValue();

    const rows = sessionAttendance.map((r) => {
      const recordDate =
        activeSession.sessionDate ||
        (r.checkedInAt
          ? r.checkedInAt.toDate().toISOString().slice(0, 10)
          : fallbackDate);
      return [recordDate, r.studentName];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCellValue).join(','))
      .join('\n');

    triggerCsvDownload(buildSessionCsvFilename(activeSession), csv);
    setCsvDownloaded(true);
    window.setTimeout(() => setCsvDownloaded(false), 2000);
  };

  const handleDownloadSessionFullCuCsv = () => {
    if (!activeSessionFullCuCsv || activeSessionFullCuCsv.studentCount === 0) {
      return;
    }
    triggerCsvDownload(
      activeSessionFullCuCsv.filename,
      activeSessionFullCuCsv.csvContent
    );
    setSessionFullCuDownloaded(true);
    window.setTimeout(() => setSessionFullCuDownloaded(false), 2000);
  };

  const handleCopyHMarkers = async () => {
    if (sessionAttendance.length === 0) return;
    setConsoleError(null);
    const lines = sessionAttendance
      .map((rec) => `${rec.studentName}\tH`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedMarkers(true);
      window.setTimeout(() => setCopiedMarkers(false), 2000);
    } catch {
      setConsoleError('Clipboard access unavailable for copying attendance.');
    }
  };

  const handleDownloadProgressCsv = () => {
    if (filteredCuProgress.length === 0) return;
    const headers = [
      'Course',
      'Batch',
      'CU / Module Code',
      'Class / Unit Name',
      'Weeks',
      'Student Name',
      'Email',
      'Attended Days',
      'Target Days',
      '80% Minimum Days',
      'Completion %',
      'Exam Eligibility',
    ];
    const rows = filteredCuProgress.map((row) => [
      row.courseName,
      row.batch,
      row.cuCode,
      row.unitName,
      row.weeks,
      row.studentName,
      row.studentEmail,
      row.attendedDays,
      row.targetDays,
      row.minRequiredDays,
      row.percentageLabel,
      row.isExamEligible ? 'Exam Eligible' : `Need ${row.daysNeededFor80} more`,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCellValue).join(','))
      .join('\n');

    triggerCsvDownload('todak-academy-cu-80-eligibility.csv', csv);
    setProgressCsvDownloaded(true);
    window.setTimeout(() => setProgressCsvDownloaded(false), 2000);
  };

  const handleDownloadProgressFullCuCsv = () => {
    if (!progressFullCuCsv || progressFullCuCsv.studentCount === 0) return;
    triggerCsvDownload(progressFullCuCsv.filename, progressFullCuCsv.csvContent);
    setProgressFullCuDownloaded(true);
    window.setTimeout(() => setProgressFullCuDownloaded(false), 2000);
  };

  const handleDraftUnitField = (
    index: number,
    field: 'cuCode' | 'unitName' | 'levelLabel' | 'weeks' | 'targetDays',
    value: string
  ) => {
    setSetupSavedMessage(null);
    setSetupError(null);
    setSetupDirty(true);
    setDraftUnits((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        if (field === 'cuCode') {
          return {
            ...row,
            cuCode: value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32),
          };
        }
        if (field === 'unitName') {
          return { ...row, unitName: value };
        }
        if (field === 'levelLabel') {
          return { ...row, levelLabel: value };
        }
        const parsed = Math.max(1, parseInt(value || '1', 10) || 1);
        if (field === 'weeks') {
          const nextWeeks = Math.min(52, parsed);
          return {
            ...row,
            weeks: nextWeeks,
            targetDays: Math.min(365, nextWeeks * 5),
          };
        }
        return {
          ...row,
          targetDays: Math.min(365, parsed),
        };
      })
    );
  };

  const handleAddDraftRow = () => {
    if (draftUnits.length >= 50) {
      setSetupError('Maximum 50 unit rows per course.');
      return;
    }
    setSetupSavedMessage(null);
    setSetupError(null);
    setSetupDirty(true);
    const nextNum = draftUnits.length + 1;
    setDraftUnits((prev) => [
      ...prev,
      {
        cuCode: `MOD-${String(nextNum).padStart(2, '0')}`,
        unitName: `New Class / Unit ${nextNum}`,
        weeks: 1,
        targetDays: 5,
      },
    ]);
  };

  const handleRemoveDraftRow = (index: number) => {
    if (draftUnits.length <= 1) return;
    setSetupSavedMessage(null);
    setSetupError(null);
    setSetupDirty(true);
    setDraftUnits((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRestoreDefaults = () => {
    setSetupSavedMessage(null);
    setSetupError(null);
    setSetupDirty(true);
    setDraftUnits(getDefaultUnitList(setupCourseId));
  };

  const handleSaveCourseSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setSetupSavedMessage(null);

    const seenCodes = new Set<string>();
    const preparedList: CuUnitConfig[] = [];

    for (let i = 0; i < draftUnits.length; i++) {
      const row = draftUnits[i];
      const cleanedCode = normalizeCuCode(row.cuCode);
      if (!isValidCuCode(cleanedCode)) {
        setSetupError(
          `Row ${i + 1}: Unit code must be 2–32 letters/digits (e.g. L3-CU01, CU01, ORIENTASI).`
        );
        return;
      }
      if (seenCodes.has(cleanedCode)) {
        setSetupError(
          `Duplicate unit code "${cleanedCode}" found. Each row must have a unique code.`
        );
        return;
      }
      seenCodes.add(cleanedCode);

      if (!row.unitName.trim()) {
        setSetupError(`Row ${i + 1} (${cleanedCode}) requires a Class / Unit Name.`);
        return;
      }
      if (row.weeks < 1 || row.weeks > 52) {
        setSetupError(`${cleanedCode} weeks must be between 1 and 52.`);
        return;
      }
      if (row.targetDays < 1 || row.targetDays > 365) {
        setSetupError(`${cleanedCode} target class days must be between 1 and 365.`);
        return;
      }

      const nextItem: CuUnitConfig = {
        cuCode: cleanedCode,
        unitName: row.unitName.trim().slice(0, 140),
        weeks: Math.round(row.weeks),
        targetDays: Math.round(row.targetDays),
      };
      if (row.levelLabel?.trim()) {
        nextItem.levelLabel = row.levelLabel.trim().slice(0, 40);
      }
      if (row.category?.trim()) {
        nextItem.category = row.category.trim().slice(0, 40);
      }
      if (typeof row.totalHours === 'number' && row.totalHours >= 0) {
        nextItem.totalHours = Math.round(row.totalHours);
      }
      preparedList.push(nextItem);
    }

    setSavingSetup(true);
    try {
      await saveCourseCuConfig(user, setupCourseId, preparedList);
      setSetupDirty(false);
      const course = getCourseById(setupCourseId);
      setSetupSavedMessage(
        `Saved ${preparedList.length} classes/units (${setupTotals.totalWeeks} weeks · ${setupTotals.totalDays} target days) for ${course?.name || setupCourseId}.`
      );
    } catch (err) {
      setSetupError(
        err instanceof Error
          ? err.message
          : 'Failed to save CU configuration.'
      );
    } finally {
      setSavingSetup(false);
    }
  };

  const editRoomChoices = useMemo(() => {
    if (
      editClassLab &&
      !CAMPUS_ROOMS.includes(editClassLab as (typeof CAMPUS_ROOMS)[number])
    ) {
      return [editClassLab, ...CAMPUS_ROOMS];
    }
    return [...CAMPUS_ROOMS];
  }, [editClassLab]);

  const activeSessionCourseShort =
    getCourseById(activeSession?.courseId)?.shortName ||
    activeSession?.courseName ||
    null;

  const hasActiveSidebarFilters =
    sidebarCourseFilter !== 'all' ||
    sidebarCuFilter !== 'all' ||
    sidebarBatchFilter !== 'all' ||
    (sessionFilter === 'history' && historyWeekFilter !== 'all');

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
      {/* Console Workspace Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">
            Instructor Console
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Separate classes by Course, Batch, and curriculum unit with live 80% exam eligibility
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Console Workspace Sections"
          className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg self-start sm:self-auto overflow-x-auto max-w-full"
        >
          {(
            [
              ['sessions', 'Sessions & Logs'],
              ['progress', 'CU Progress & 80%'],
              ['setup', 'CU Setup'],
            ] as const
          ).map(([tabKey, label]) => {
            const isActive = consoleTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setConsoleTab(tabKey)}
                className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {consoleTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <aside className="lg:col-span-4 min-w-0 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-xl">
              <div className="p-5 border-b border-[#E2E8F0] space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Class Sessions
                    </h2>
                    <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
                      {activeSessions.length} active · {endedSessions.length} in history
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showCreateForm ? 'Close Form' : 'New Class'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F5F9] rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSessionFilter('active');
                      if (activeSessions[0]) onSelectSession(activeSessions[0].id);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      sessionFilter === 'active'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Active ({activeSessions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionFilter('history');
                      if (endedSessions[0]) {
                        onSelectSession(endedSessions[0].id);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      sessionFilter === 'history'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    History ({endedSessions.length})
                  </button>
                </div>

                {/* Course / CU / Batch / Week Filters */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <select
                    aria-label="Filter by Course"
                    value={sidebarCourseFilter}
                    onChange={(e) => {
                      setSidebarCourseFilter(e.target.value);
                      setSidebarCuFilter('all');
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                  >
                    <option value="all">All Courses</option>
                    {COURSES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName}
                      </option>
                    ))}
                    <option value="__standalone__">
                      Standalone / Short Course
                    </option>
                  </select>

                  <select
                    aria-label="Filter by Competency Unit"
                    value={sidebarCuFilter}
                    disabled={sidebarCourseFilter === '__standalone__'}
                    onChange={(e) => setSidebarCuFilter(e.target.value)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] disabled:opacity-50 cursor-pointer"
                  >
                    <option value="all">
                      {sidebarCourseFilter === '__standalone__'
                        ? 'No CU (Standalone)'
                        : 'All Units / CUs'}
                    </option>
                    {sidebarCuFilterChoices.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Batch"
                    value={sidebarBatchFilter}
                    onChange={(e) => setSidebarBatchFilter(e.target.value)}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer ${
                      sessionFilter === 'history' ? '' : 'col-span-2'
                    }`}
                  >
                    <option value="all">All Batches</option>
                    {availableSessionBatches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  {sessionFilter === 'history' && (
                    <select
                      aria-label="Filter History by Week"
                      value={historyWeekFilter}
                      onChange={(e) => setHistoryWeekFilter(e.target.value)}
                      className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                    >
                      <option value="all">
                        All Weeks ({endedSessions.length})
                      </option>
                      {availableHistoryWeeks.weeks.map((wk) => (
                        <option key={wk} value={wk}>
                          {wk}
                        </option>
                      ))}
                      {availableHistoryWeeks.hasUnspecified && (
                        <option value="__none__">Unspecified Week</option>
                      )}
                    </select>
                  )}
                </div>
              </div>

              {showCreateForm && (
                <form
                  onSubmit={(e) => void handleCreateSession(e)}
                  className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-[#475569]">
                      Class Mode
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#E2E8F0]/70 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionMode('program');
                          setFormError(null);
                          if (!batch.trim()) setBatch('Batch 1');
                          if (!titleManuallyEdited) {
                            const unit = createCourseUnitList.find(
                              (u) => u.cuCode === cuCode
                            );
                            setTitle(unit?.unitName || '');
                          }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          sessionMode === 'program'
                            ? 'bg-white text-[#0F172A] shadow-xs'
                            : 'text-[#475569] hover:text-[#0F172A]'
                        }`}
                      >
                        Program &amp; CU
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionMode('standalone');
                          setFormError(null);
                          if (!titleManuallyEdited) {
                            setTitle('');
                          }
                          if (batch === 'Batch 1') {
                            setBatch('');
                          }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          sessionMode === 'standalone'
                            ? 'bg-white text-[#0F172A] shadow-xs'
                            : 'text-[#475569] hover:text-[#0F172A]'
                        }`}
                      >
                        Standalone Class
                      </button>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-snug">
                      {sessionMode === 'program'
                        ? 'Attached to a Diploma / Certificate Course & CU (counted toward 80% exam attendance).'
                        : 'For Short Course, Part-Time, 1-Day Class, or School Program (no Course/CU attached).'}
                    </p>
                  </div>

                  {sessionMode === 'program' ? (
                    <>
                      <div>
                        <label
                          htmlFor="session-course"
                          className="block text-xs font-medium text-[#475569] mb-1"
                        >
                          Course Program
                        </label>
                        <select
                          id="session-course"
                          value={courseId}
                          onChange={(e) => {
                            setTitleManuallyEdited(false);
                            setCourseId(e.target.value as CourseId);
                          }}
                          className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                        >
                          {COURSES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="session-cu"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Unit / CU Class
                          </label>
                          <select
                            id="session-cu"
                            value={cuCode}
                            onChange={(e) => {
                              setTitleManuallyEdited(false);
                              setCuCode(e.target.value);
                            }}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                          >
                            {createCourseUnitList.map((u) => (
                              <option key={u.cuCode} value={u.cuCode}>
                                {isTaklimatUnit(u)
                                  ? `${u.cuCode} · ${u.unitName}`
                                  : `${u.cuCode} · ${u.unitName} (${u.weeks}w)`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="session-batch"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Batch
                          </label>
                          <input
                            id="session-batch"
                            type="text"
                            required
                            maxLength={64}
                            value={batch}
                            onChange={(e) => setBatch(e.target.value)}
                            placeholder="Batch 1"
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="standalone-type"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Class Type (Optional)
                          </label>
                          <select
                            id="standalone-type"
                            value={standaloneType}
                            onChange={(e) => setStandaloneType(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                          >
                            {STANDALONE_CLASS_TYPES.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                            <option value="__custom__">Custom Label...</option>
                            <option value="__none__">
                              None (General Class)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="session-batch"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Group / Cohort (Optional)
                          </label>
                          <input
                            id="session-batch"
                            type="text"
                            maxLength={64}
                            value={batch}
                            onChange={(e) => setBatch(e.target.value)}
                            placeholder="e.g. SMK / Group A"
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>
                      </div>

                      {standaloneType === '__custom__' && (
                        <div>
                          <label
                            htmlFor="standalone-custom-label"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Custom Class Type Label
                          </label>
                          <input
                            id="standalone-custom-label"
                            type="text"
                            maxLength={120}
                            value={customStandaloneLabel}
                            onChange={(e) =>
                              setCustomStandaloneLabel(e.target.value)
                            }
                            placeholder="e.g. Corporate Bootcamp"
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="session-title"
                      className="block text-xs font-medium text-[#475569] mb-1"
                    >
                      {sessionMode === 'program'
                        ? `Session Class Title (${cuCode} prefix applied)`
                        : 'Session Class Title'}
                    </label>
                    <input
                      id="session-title"
                      type="text"
                      required
                      maxLength={120}
                      value={title}
                      onChange={(e) => {
                        setTitleManuallyEdited(true);
                        setTitle(e.target.value);
                      }}
                      placeholder={
                        sessionMode === 'program'
                          ? 'Graphic Interface Production'
                          : 'e.g. Canva Design 1-Day Workshop'
                      }
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trainer-name"
                      className="block text-xs font-medium text-[#475569] mb-1"
                    >
                      Trainer Name
                    </label>
                    <input
                      id="trainer-name"
                      type="text"
                      required
                      maxLength={100}
                      value={trainerName}
                      onChange={(e) => setTrainerName(e.target.value)}
                      placeholder="Syaqir Ahmad"
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="class-lab"
                        className="block text-xs font-medium text-[#475569] mb-1"
                      >
                        Class / Lab
                      </label>
                      <select
                        id="class-lab"
                        required
                        value={classLab}
                        onChange={(e) => setClassLab(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                      >
                        {CAMPUS_ROOMS.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="session-week"
                        className="block text-xs font-medium text-[#475569] mb-1"
                      >
                        {sessionMode === 'program'
                          ? 'Week'
                          : 'Day / Session (Optional)'}
                      </label>
                      <input
                        id="session-week"
                        type="text"
                        maxLength={40}
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        placeholder={
                          sessionMode === 'program' ? 'Week 1' : 'Day 1'
                        }
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="session-date"
                      className="block text-xs font-medium text-[#475569] mb-1"
                    >
                      Date
                    </label>
                    <input
                      id="session-date"
                      type="date"
                      required
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                    />
                  </div>

                  {formError && (
                    <p
                      role="alert"
                      className="text-xs text-[#DC2626] font-medium"
                    >
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {creating
                      ? 'Creating Session...'
                      : 'Create Session & Generate QR'}
                  </button>
                </form>
              )}

              {visibleSessions.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-[#0F172A]">
                    {hasActiveSidebarFilters
                      ? 'No classes match these filters'
                      : sessionFilter === 'active'
                        ? 'No active classes right now'
                        : 'No ended classes in history yet'}
                  </p>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {hasActiveSidebarFilters
                      ? 'Try clearing Course, Unit/CU, Batch, or Week filters.'
                      : sessionFilter === 'active'
                        ? 'Create a new class above to generate a live QR code, or switch to History.'
                        : 'Ended class sessions and attendee logs stay archived here.'}
                  </p>
                  {hasActiveSidebarFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarCourseFilter('all');
                        setSidebarCuFilter('all');
                        setSidebarBatchFilter('all');
                        setHistoryWeekFilter('all');
                      }}
                      className="text-xs font-semibold text-[#3F6212] hover:underline cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-[#E2E8F0]">
                  {visibleSessions.map((s) => {
                    const isSelected = activeSession?.id === s.id;
                    const count = allInstructorAttendance.filter(
                      (r) => r.sessionId === s.id
                    ).length;
                    const formattedClassDate = formatSessionDateLabel(
                      s.sessionDate
                    );
                    const courseShort =
                      getCourseById(s.courseId)?.shortName || s.courseName;

                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(s.id);
                            setIsEditing(false);
                            setConfirmEndId(null);
                            setConfirmDeleteId(null);
                          }}
                          className={`w-full text-left p-4 sm:px-5 transition-colors cursor-pointer ${
                            isSelected ? 'bg-[#F7FEE7]' : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-[#0F172A] truncate">
                              {s.title}
                            </span>
                            <span
                              className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                                s.isEnded
                                  ? 'text-[#475569]'
                                  : s.isOpen
                                    ? 'text-[#3F6212]'
                                    : 'text-[#B45309]'
                              }`}
                            >
                              {s.isEnded ? 'Ended' : s.isOpen ? 'Open' : 'Paused'}
                            </span>
                          </div>
                          {courseShort || s.batch || s.cuCode ? (
                            <p className="text-xs font-medium text-[#3F6212] mt-1 truncate">
                              {[courseShort, s.batch, s.cuCode]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-[#475569] mt-1 truncate">
                              Standalone Class
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748B] mt-1 font-mono tabular-nums">
                            <span>{s.classLab}</span>
                            {s.week && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-sans text-[#3F6212] font-medium">
                                  {s.week}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">{s.trainerName}</span>
                            {formattedClassDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-sans">
                                  {formattedClassDate}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{count} attended</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="lg:col-span-8 min-w-0 space-y-6">
            {!activeSession ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
                <h2 className="text-lg font-semibold text-[#0F172A]">
                  {sessionFilter === 'active'
                    ? 'Select or create an active class'
                    : 'Select a class from history'}
                </h2>
                <p className="text-sm text-[#64748B] mt-1.5 max-w-md mx-auto">
                  {sessionFilter === 'active'
                    ? 'Once a session is active, QR settings and live student attendance appear here.'
                    : 'Ended class sessions and their attendance records stay saved here for weekly review and export.'}
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5">
                  <div className="space-y-4">
                    <div className="min-w-0">
                      {activeSessionCourseShort ||
                      activeSession.batch ||
                      activeSession.cuCode ? (
                        <p className="text-xs font-semibold text-[#3F6212] mb-1">
                          {[
                            activeSession.courseName || activeSessionCourseShort,
                            activeSession.batch,
                            activeSession.cuCode,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-[#475569] mb-1">
                          Standalone Class (No Course / CU Attached)
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B]">
                        <span className="font-medium text-[#0F172A]">
                          {activeSession.classLab}
                        </span>
                        {activeSession.week && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#3F6212]">
                              {activeSession.week}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>Trainer {activeSession.trainerName}</span>
                        {formatSessionDateLabel(activeSession.sessionDate) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatSessionDateLabel(
                                activeSession.sessionDate
                              )}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        {activeSession.isEnded ? (
                          <span className="inline-flex items-center gap-1 text-[#334155] font-semibold">
                            <Archive className="w-3.5 h-3.5" />
                            Ended
                            {activeSession.endedAt
                              ? ` on ${activeSession.endedAt
                                  .toDate()
                                  .toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                              : ''}
                          </span>
                        ) : (
                          <span
                            className={
                              activeSession.isOpen
                                ? 'text-[#3F6212] font-semibold'
                                : 'text-[#B45309] font-semibold'
                            }
                          >
                            {activeSession.isOpen
                              ? 'Accepting clock-ins'
                              : 'Paused'}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] mt-1.5 break-words">
                        {activeSession.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {!activeSession.isEnded && (
                          <>
                            <button
                              type="button"
                              onClick={() => onLaunchKiosk(activeSession.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-sm font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Monitor className="w-4 h-4" />
                              Open Classroom Attendee
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                isEditing ? setIsEditing(false) : openEditForm()
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {isEditing ? 'Cancel Edit' : 'Edit Class'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleSessionOpen(
                                  activeSession.id,
                                  !activeSession.isOpen
                                )
                              }
                              className="inline-flex items-center px-3.5 py-2 min-h-[42px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {activeSession.isOpen
                                ? 'Pause Session'
                                : 'Resume Session'}
                            </button>

                            {confirmEndId === activeSession.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={endingSession}
                                  onClick={() =>
                                    void handleEndSession(activeSession.id)
                                  }
                                  className="px-3 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                                >
                                  {endingSession
                                    ? 'Ending...'
                                    : 'Confirm End Class'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmEndId(null)}
                                  className="px-2.5 py-2 min-h-[42px] text-xs font-medium text-[#475569] cursor-pointer whitespace-nowrap"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmEndId(activeSession.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Square className="w-3 h-3 fill-current text-[#475569]" />
                                End Class
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex items-center shrink-0">
                        {confirmDeleteId === activeSession.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteSession(activeSession.id)
                              }
                              className="px-3 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] cursor-pointer whitespace-nowrap"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-2 min-h-[42px] text-xs font-medium text-[#475569] cursor-pointer whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(activeSession.id);
                              setConfirmEndId(null);
                            }}
                            aria-label="Delete session"
                            title="Delete session"
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] text-xs font-medium text-[#64748B] hover:text-[#DC2626] border border-[#E2E8F0] rounded-lg hover:bg-[#FEF2F2] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isEditing && !activeSession.isEnded && (
                    <form
                      onSubmit={(e) => void handleSaveEdit(e)}
                      className="p-4 sm:p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                        <span className="text-xs font-medium text-[#475569]">
                          Class Mode
                        </span>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-[#E2E8F0]/70 rounded-lg sm:w-72">
                          <button
                            type="button"
                            onClick={() => {
                              setEditSessionMode('program');
                              setEditError(null);
                            }}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                              editSessionMode === 'program'
                                ? 'bg-white text-[#0F172A] shadow-xs'
                                : 'text-[#475569] hover:text-[#0F172A]'
                            }`}
                          >
                            Program &amp; CU
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSessionMode('standalone');
                              setEditError(null);
                            }}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                              editSessionMode === 'standalone'
                                ? 'bg-white text-[#0F172A] shadow-xs'
                                : 'text-[#475569] hover:text-[#0F172A]'
                            }`}
                          >
                            Standalone Class
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {editSessionMode === 'program' ? (
                          <>
                            <div className="sm:col-span-2 lg:col-span-2">
                              <label
                                htmlFor="edit-session-course"
                                className="block text-xs font-medium text-[#475569] mb-1"
                              >
                                Course Program
                              </label>
                              <select
                                id="edit-session-course"
                                value={editCourseId}
                                onChange={(e) => {
                                  const nextCourse = e.target.value as CourseId;
                                  setEditCourseId(nextCourse);
                                  const firstCode =
                                    buildMergedCourseConfig(
                                      nextCourse,
                                      courseConfigs[nextCourse]
                                    ).unitList[0]?.cuCode || 'CU01';
                                  setEditCuCode(firstCode);
                                }}
                                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                              >
                                {COURSES.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor="edit-session-cu"
                                className="block text-xs font-medium text-[#475569] mb-1"
                              >
                                Unit / CU Class
                              </label>
                              <select
                                id="edit-session-cu"
                                value={editCuCode}
                                onChange={(e) => setEditCuCode(e.target.value)}
                                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                              >
                                {editCourseUnitList.map((u) => (
                                  <option key={u.cuCode} value={u.cuCode}>
                                    {u.cuCode} · {u.unitName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={
                                editStandaloneType === '__custom__'
                                  ? 'sm:col-span-1'
                                  : 'sm:col-span-2 lg:col-span-3'
                              }
                            >
                              <label
                                htmlFor="edit-standalone-type"
                                className="block text-xs font-medium text-[#475569] mb-1"
                              >
                                Class Type (Optional)
                              </label>
                              <select
                                id="edit-standalone-type"
                                value={editStandaloneType}
                                onChange={(e) =>
                                  setEditStandaloneType(e.target.value)
                                }
                                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                              >
                                {STANDALONE_CLASS_TYPES.map((label) => (
                                  <option key={label} value={label}>
                                    {label}
                                  </option>
                                ))}
                                <option value="__custom__">
                                  Custom Label...
                                </option>
                                <option value="__none__">
                                  None (General Class)
                                </option>
                              </select>
                            </div>

                            {editStandaloneType === '__custom__' && (
                              <div className="sm:col-span-1 lg:col-span-2">
                                <label
                                  htmlFor="edit-standalone-custom-label"
                                  className="block text-xs font-medium text-[#475569] mb-1"
                                >
                                  Custom Class Type Label
                                </label>
                                <input
                                  id="edit-standalone-custom-label"
                                  type="text"
                                  maxLength={120}
                                  value={editCustomStandaloneLabel}
                                  onChange={(e) =>
                                    setEditCustomStandaloneLabel(e.target.value)
                                  }
                                  placeholder="e.g. Corporate Bootcamp"
                                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                                />
                              </div>
                            )}
                          </>
                        )}

                        <div>
                          <label
                            htmlFor="edit-session-batch"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            {editSessionMode === 'program'
                              ? 'Batch'
                              : 'Group / Cohort (Optional)'}
                          </label>
                          <input
                            id="edit-session-batch"
                            type="text"
                            required={editSessionMode === 'program'}
                            maxLength={64}
                            value={editBatch}
                            onChange={(e) => setEditBatch(e.target.value)}
                            placeholder={
                              editSessionMode === 'program'
                                ? 'Batch 1'
                                : 'e.g. SMK / Group A'
                            }
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="edit-trainer-name"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Trainer Name
                          </label>
                          <input
                            id="edit-trainer-name"
                            type="text"
                            required
                            maxLength={100}
                            value={editTrainerName}
                            onChange={(e) => setEditTrainerName(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="edit-class-lab"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Class / Lab
                          </label>
                          <select
                            id="edit-class-lab"
                            required
                            value={editClassLab}
                            onChange={(e) => setEditClassLab(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                          >
                            {editRoomChoices.map((room) => (
                              <option key={room} value={room}>
                                {room}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label
                            htmlFor="edit-session-title"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            {editSessionMode === 'program'
                              ? `Session Class Title (${editCuCode} prefix applied)`
                              : 'Session Class Title'}
                          </label>
                          <input
                            id="edit-session-title"
                            type="text"
                            required
                            maxLength={120}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="edit-session-week"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            {editSessionMode === 'program'
                              ? 'Week'
                              : 'Day / Session (Optional)'}
                          </label>
                          <input
                            id="edit-session-week"
                            type="text"
                            maxLength={40}
                            value={editWeek}
                            onChange={(e) => setEditWeek(e.target.value)}
                            placeholder={
                              editSessionMode === 'program' ? 'Week 1' : 'Day 1'
                            }
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="edit-session-date"
                            className="block text-xs font-medium text-[#475569] mb-1"
                          >
                            Date
                          </label>
                          <input
                            id="edit-session-date"
                            type="date"
                            required
                            value={editSessionDate}
                            onChange={(e) => setEditSessionDate(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </div>
                      </div>

                      {editError && (
                        <p
                          role="alert"
                          className="text-xs text-[#DC2626] font-medium"
                        >
                          {editError}
                        </p>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                        >
                          {savingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-2 min-h-[40px] text-xs font-medium text-[#475569] hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {!activeSession.isEnded && (
                    <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[#0F172A]">
                          Classroom QR Settings
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="console-rotate-interval"
                              className="text-xs text-[#64748B] whitespace-nowrap"
                            >
                              Auto-Refresh
                            </label>
                            <select
                              id="console-rotate-interval"
                              disabled={savingRotateInterval}
                              value={activeSession.autoRotateSeconds ?? 30}
                              onChange={(e) =>
                                void handleChangeRotateInterval(
                                  Number(e.target.value)
                                )
                              }
                              className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                            >
                              {QR_ROTATE_INTERVALS.map((sec) => (
                                <option key={sec} value={sec}>
                                  {sec === 0 ? 'Manual Only' : `Every ${sec}s`}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleManualRotateQr()}
                            disabled={rotatingQr}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 text-[#3F6212] ${rotatingQr ? 'animate-spin' : ''}`}
                            />
                            Rotate QR Now
                          </button>
                        </div>
                      </div>

                      {isDevPreviewOrigin() && (
                        <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <p className="text-xs text-[#475569] leading-relaxed">
                            QR codes target your shared URL (
                            <span className="font-mono">ais-pre-...</span>) so
                            student phones avoid editor 403 errors.
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <label
                              htmlFor="console-qr-base-url"
                              className="text-xs text-[#64748B] whitespace-nowrap"
                            >
                              QR Base URL
                            </label>
                            <input
                              id="console-qr-base-url"
                              type="url"
                              value={qrBaseOrigin}
                              onChange={(e) =>
                                onChangeQrBaseOrigin(e.target.value)
                              }
                              className="min-h-[36px] px-2.5 py-1 text-xs font-mono text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-5 border-t border-[#E2E8F0]">
                    <div>
                      <p className="text-xs text-[#64748B]">
                        {activeSession.isEnded
                          ? 'Total Attendees Saved'
                          : 'Students Clocked In'}
                      </p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#0F172A] mt-1">
                        {sessionAttendance.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">
                        {activeSession.isEnded
                          ? 'Final QR Sequence'
                          : 'Active QR Sequence'}
                      </p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#3F6212] mt-1">
                        #{activeSession.tokenSequence}
                      </p>
                    </div>
                  </div>

                  {consoleError && (
                    <p
                      role="alert"
                      className="text-xs text-[#DC2626] font-medium"
                    >
                      {consoleError}
                    </p>
                  )}
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-sm font-semibold text-[#0F172A]">
                        {activeSession.isEnded
                          ? 'Saved Attendance History'
                          : 'Attendance Log'}
                      </h3>
                      <span className="text-xs font-mono tabular-nums text-[#64748B]">
                        {sessionAttendance.length} total
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 sm:w-56 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search student or email..."
                          className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleCopyHMarkers()}
                        disabled={sessionAttendance.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {copiedMarkers ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied H Markers
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy H Markers
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadCsv}
                        disabled={sessionAttendance.length === 0}
                        title={
                          activeSession
                            ? `Download session CSV (${buildSessionCsvFilename(activeSession)})`
                            : 'Download session CSV'
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {csvDownloaded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#3F6212]" />
                            Downloaded CSV
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            Download CSV
                          </>
                        )}
                      </button>

                      {activeSessionFullCuCsv && (
                        <button
                          type="button"
                          onClick={handleDownloadSessionFullCuCsv}
                          disabled={activeSessionFullCuCsv.studentCount === 0}
                          title={
                            activeSessionFullCuCsv.studentCount === 0
                              ? 'No student check-ins recorded for this CU yet'
                              : `Compile all ${activeSessionFullCuCsv.dateCount} day(s) of ${activeSession.cuCode} into 1 CSV sheet`
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-[#3F6212] bg-[#F7FEE7] border border-[#BEF264] rounded-lg hover:bg-[#ECFCCB] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {sessionFullCuDownloaded ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#3F6212]" />
                              Compiled CU Downloaded
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              Download Full CU Sheet
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredAttendance.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-sm font-medium text-[#0F172A]">
                        {sessionAttendance.length === 0
                          ? 'No students clocked in for this class'
                          : 'No matching check-in records'}
                      </p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {sessionAttendance.length === 0
                          ? activeSession.isEnded
                            ? 'This ended session had zero recorded check-ins.'
                            : 'Open Classroom Attendee so students can scan with their Google account.'
                          : 'Try clearing your search filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {(() => {
                        const activeSessionHasCu = Boolean(
                          getCourseById(activeSession.courseId) &&
                            isValidCuCode(activeSession.cuCode)
                        );
                        return (
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Student Name</th>
                                <th className="py-3 px-4">Email</th>
                                <th className="py-3 px-4 text-center">Sheet Mark</th>
                                {activeSessionHasCu && (
                                  <th className="py-3 px-4">CU Status (&ge;80%)</th>
                                )}
                                <th className="py-3 px-4 text-right">
                                  Clock-In Time
                                </th>
                                {!activeSession.isEnded && (
                                  <th className="py-3 px-4 text-right">Action</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0] text-xs">
                              {filteredAttendance.map((rec) => {
                                const recordDate =
                                  activeSession.sessionDate ||
                                  (rec.checkedInAt
                                    ? rec.checkedInAt
                                        .toDate()
                                        .toISOString()
                                        .slice(0, 10)
                                    : '—');
                                const timeStr = rec.checkedInAt
                                  ? rec.checkedInAt.toDate().toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })
                                  : '—';

                                const recCourseId = rec.courseId || activeSession.courseId;
                                const recCuCode = rec.cuCode || activeSession.cuCode;
                                const recBatch =
                                  (rec.batch || activeSession.batch || '').trim() ||
                                  'General';
                                const cuProgress =
                                  recCourseId && recCuCode
                                    ? cuProgressByKey.get(
                                        `${rec.studentUid}::${recCourseId}::${recBatch.toLowerCase()}::${recCuCode}`
                                      )
                                    : undefined;

                                return (
                                  <tr
                                    key={rec.id}
                                    className="hover:bg-[#F8FAFC] transition-colors"
                                  >
                                    <td className="py-3 px-4 font-mono tabular-nums text-[#475569] whitespace-nowrap">
                                      {recordDate}
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-[#0F172A]">
                                      {rec.studentName}
                                    </td>
                                    <td className="py-3 px-4 text-[#475569]">
                                      {rec.studentEmail}
                                    </td>
                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                      <span
                                        title="Hadir (Present)"
                                        className="inline-flex items-center justify-center w-7 h-6 rounded bg-[#16A34A] text-white text-[11px] font-bold"
                                      >
                                        H
                                      </span>
                                    </td>
                                    {activeSessionHasCu && (
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        {cuProgress ? (
                                          <div className="flex items-center gap-2.5">
                                            <span
                                              className={`font-mono tabular-nums font-bold ${
                                                cuProgress.isExamEligible
                                                  ? 'text-[#15803D]'
                                                  : 'text-[#DC2626]'
                                              }`}
                                            >
                                              {cuProgress.percentageLabel}
                                            </span>
                                            <span className="font-mono tabular-nums text-[11px] text-[#64748B]">
                                              ({cuProgress.attendedDays}/{cuProgress.targetDays})
                                            </span>
                                            <CuEligibilityFlag
                                              isEligible={cuProgress.isExamEligible}
                                              daysNeededFor80={cuProgress.daysNeededFor80}
                                              compact
                                            />
                                          </div>
                                        ) : (
                                          <span className="text-[#94A3B8]">—</span>
                                        )}
                                      </td>
                                    )}
                                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] whitespace-nowrap">
                                      {timeStr}
                                    </td>
                                {!activeSession.isEnded && (
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    {confirmRemoveRecordId === rec.id ? (
                                      <span className="inline-flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void removeAttendanceAndUnlockDevice(
                                              rec
                                            )
                                              .then(() =>
                                                setConfirmRemoveRecordId(null)
                                              )
                                              .catch((err) =>
                                                setConsoleError(
                                                  err instanceof Error
                                                    ? err.message
                                                    : 'Failed to remove record.'
                                                )
                                              );
                                          }}
                                          className="text-[#DC2626] font-semibold hover:underline cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmRemoveRecordId(null)
                                          }
                                          className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmRemoveRecordId(rec.id)
                                        }
                                        className="text-[#64748B] hover:text-[#DC2626] font-medium cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </td>
                                )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {consoleTab === 'progress' && (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <p className="text-xs text-[#64748B]">Student-Unit Records</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#0F172A] mt-1">
                {progressStats.total}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <p className="text-xs text-[#64748B]">80% Exam Gate</p>
              <p className="text-lg font-bold font-mono tabular-nums text-[#0F172A] mt-1">
                {progressStats.selectedUnitPreview
                  ? `${getMinRequiredDaysFor80(progressStats.selectedUnitPreview.targetDays)} / ${progressStats.selectedUnitPreview.targetDays} days`
                  : '80% of Target Days'}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
                {progressStats.selectedUnitPreview
                  ? isTaklimatUnit(progressStats.selectedUnitPreview)
                    ? `${progressStats.selectedUnitPreview.cuCode} · ${progressStats.selectedUnitPreview.targetDays} ${progressStats.selectedUnitPreview.targetDays === 1 ? 'day' : 'days'}`
                    : `${progressStats.selectedUnitPreview.cuCode} · ${progressStats.selectedUnitPreview.weeks} weeks`
                  : 'Select Course & Unit to inspect exact days'}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <p className="text-xs text-[#64748B]">Exam Eligible (&ge;80%)</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#15803D] mt-1">
                {progressStats.eligible}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <p className="text-xs text-[#64748B]">Below 80% Threshold</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#DC2626] mt-1">
                {progressStats.below}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    CU Attendance & 80% Exam Eligibility Roster
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Calculated per student across Course, Batch, and curriculum unit against CU Setup target days (holidays excluded)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleDownloadProgressFullCuCsv}
                    disabled={
                      !progressFullCuCsv || progressFullCuCsv.studentCount === 0
                    }
                    title={
                      progressCourseFilter === 'all' ||
                      progressCuFilter === 'all'
                        ? 'Select a specific Course and Unit / CU below to compile every day into 1 sheet'
                        : !progressFullCuCsv ||
                            progressFullCuCsv.studentCount === 0
                          ? 'No student check-in records found for this Course & Unit'
                          : `Compile ${progressFullCuCsv.dateCount} day(s) for ${progressFullCuCsv.studentCount} student(s) into 1 CSV sheet`
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#3F6212] bg-[#F7FEE7] border border-[#BEF264] rounded-lg hover:bg-[#ECFCCB] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {progressFullCuDownloaded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#3F6212]" />
                        Compiled CU Downloaded
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Download Full CU Sheet
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadProgressCsv}
                    disabled={filteredCuProgress.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {progressCsvDownloaded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#3F6212]" />
                        Downloaded Eligibility CSV
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Download CU Eligibility CSV
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <select
                  aria-label="Filter Roster by Course"
                  value={progressCourseFilter}
                  onChange={(e) => {
                    setProgressCourseFilter(e.target.value);
                    setProgressCuFilter('all');
                  }}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                >
                  <option value="all">All 4 Courses</option>
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter Roster by Batch"
                  value={progressBatchFilter}
                  onChange={(e) => setProgressBatchFilter(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                >
                  <option value="all">All Batches</option>
                  {availableProgressBatches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter Roster by Competency Unit"
                  value={progressCuFilter}
                  onChange={(e) => setProgressCuFilter(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                >
                  <option value="all">All Units / CUs</option>
                  {progressCuChoices.map((u) => (
                    <option key={u.cuCode} value={u.cuCode}>
                      {u.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by 80% Exam Status"
                  value={progressStatusFilter}
                  onChange={(e) =>
                    setProgressStatusFilter(e.target.value as EligibilityFilter)
                  }
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="eligible">Exam Eligible (&ge;80%)</option>
                  <option value="below">Below 80%</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={progressSearch}
                    onChange={(e) => setProgressSearch(e.target.value)}
                    placeholder="Search student or CU..."
                    className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                  />
                </div>
              </div>
            </div>

            {filteredCuProgress.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm font-medium text-[#0F172A]">
                  {allCuProgress.length === 0
                    ? 'No Course & CU attendance records yet'
                    : 'No student CU records match your filters'}
                </p>
                <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                  {allCuProgress.length === 0
                    ? 'Create classes with a Course, Batch, and Competency Unit / Module. As students scan QR codes, their live percentages and 80% exam readiness calculate here automatically.'
                    : 'Clear or broaden your Course, Batch, Unit, or search filters.'}
                </p>
                {allCuProgress.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setProgressCourseFilter('all');
                      setProgressBatchFilter('all');
                      setProgressCuFilter('all');
                      setProgressStatusFilter('all');
                      setProgressSearch('');
                    }}
                    className="text-xs font-semibold text-[#3F6212] hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Course & Batch</th>
                      <th className="py-3 px-4">Unit / Module</th>
                      <th className="py-3 px-4 text-right">Attended / Target</th>
                      <th className="py-3 px-4 w-48">Completion %</th>
                      <th className="py-3 px-4 text-right">Exam Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    {filteredCuProgress.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#0F172A]">
                            {row.studentName}
                          </p>
                          <p className="text-[#64748B]">{row.studentEmail}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#0F172A]">
                            {row.courseShortName}
                          </p>
                          <p className="text-[#64748B]">
                            {row.levelLabel
                              ? `${row.levelLabel} · ${row.batch}`
                              : row.batch}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#0F172A]">
                            <span className="font-mono text-[#3F6212]">
                              {row.cuCode}
                            </span>{' '}
                            · {row.unitName}
                          </p>
                          <p className="text-[#64748B] tabular-nums">
                            {isTaklimatUnit(row)
                              ? `${row.targetDays} ${row.targetDays === 1 ? 'day' : 'days'} · Min ${row.minRequiredDays} ${row.minRequiredDays === 1 ? 'day' : 'days'}`
                              : `${row.weeks} weeks · Min ${row.minRequiredDays} days`}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#0F172A] whitespace-nowrap">
                          {row.attendedDays} / {row.targetDays}
                        </td>
                        <td className="py-3.5 px-4">
                          <CuProgressMeter
                            percentage={row.percentage}
                            percentageLabel={row.percentageLabel}
                            isEligible={row.isExamEligible}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <CuEligibilityFlag
                            isEligible={row.isExamEligible}
                            daysNeededFor80={row.daysNeededFor80}
                          />
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

      {consoleTab === 'setup' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#E2E8F0] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Course Curriculum & Target Days Setup
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Configure required class modules, duration weeks (excluding Cuti Semester holidays), and Target Class Days (default 5 days/week) per course. Changing Weeks auto-updates Target Days to Weeks &times; 5, or override Target Days directly.
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2 shrink-0">
                <span>{setupTotals.totalModules} classes</span>
                <span aria-hidden="true"> · </span>
                <span className="text-[#3F6212] font-bold">
                  {setupTotals.totalWeeks} weeks
                </span>
                <span aria-hidden="true"> · </span>
                <span>{setupTotals.totalDays} target days</span>
              </div>
            </div>

            {setupTotals.excludedHolidays.length > 0 && (
              <p className="text-xs text-[#475569] bg-[#F7FEE7] border border-[#D9F99D] rounded-lg px-3.5 py-2">
                Holiday breaks excluded from required attendance:{' '}
                <span className="font-medium text-[#1A2E05]">
                  {setupTotals.excludedHolidays.join(', ')}
                </span>
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {COURSES.map((c) => {
                const isSelected = setupCourseId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSetupCourseId(c.id);
                      setSetupDirty(false);
                      setSetupSavedMessage(null);
                      setSetupError(null);
                    }}
                    className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F7FEE7] border-[#4D7C0F] text-[#1A2E05]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{c.shortName}</p>
                    <p className="text-[11px] opacity-80 truncate mt-0.5">
                      {c.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={(e) => void handleSaveCourseSetup(e)}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4 w-44">Code</th>
                    <th className="py-3 px-4 w-28">Part / Level</th>
                    <th className="py-3 px-4">Class / Competency Unit Name</th>
                    <th className="py-3 px-4 w-28 text-right">Weeks</th>
                    <th className="py-3 px-4 w-32 text-right">
                      Target Days
                    </th>
                    <th className="py-3 px-4 w-28 text-right">80% Min</th>
                    <th className="py-3 px-4 w-16 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {draftUnits.map((row, index) => {
                    const minDays = getMinRequiredDaysFor80(
                      row.targetDays || 1
                    );
                    return (
                      <tr
                        key={`${index}-${row.cuCode}`}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[#64748B]">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            required
                            maxLength={32}
                            aria-label={`Row ${index + 1} Unit Code`}
                            value={row.cuCode}
                            onChange={(e) =>
                              handleDraftUnitField(index, 'cuCode', e.target.value)
                            }
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-bold text-[#3F6212] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            maxLength={40}
                            aria-label={`Row ${index + 1} Part or Level`}
                            value={row.levelLabel || ''}
                            placeholder="Optional"
                            onChange={(e) =>
                              handleDraftUnitField(
                                index,
                                'levelLabel',
                                e.target.value
                              )
                            }
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs text-[#475569] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            required
                            maxLength={140}
                            aria-label={`Row ${index + 1} Class or Unit Name`}
                            value={row.unitName}
                            onChange={(e) =>
                              handleDraftUnitField(
                                index,
                                'unitName',
                                e.target.value
                              )
                            }
                            className="w-full min-w-[220px] min-h-[38px] px-3 py-1.5 text-sm text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            type="number"
                            required
                            min={1}
                            max={52}
                            aria-label={`Row ${index + 1} Duration Weeks`}
                            value={row.weeks}
                            onChange={(e) =>
                              handleDraftUnitField(index, 'weeks', e.target.value)
                            }
                            className="w-20 min-h-[38px] px-2.5 py-1.5 text-sm text-right font-mono tabular-nums text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            type="number"
                            required
                            min={1}
                            max={365}
                            aria-label={`Row ${index + 1} Target Class Days`}
                            value={row.targetDays}
                            onChange={(e) =>
                              handleDraftUnitField(
                                index,
                                'targetDays',
                                e.target.value
                              )
                            }
                            className="w-24 min-h-[38px] px-2.5 py-1.5 text-sm text-right font-mono tabular-nums text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7C0F]"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#3F6212] whitespace-nowrap">
                          {minDays} days
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={draftUnits.length <= 1}
                            onClick={() => handleRemoveDraftRow(index)}
                            aria-label={`Remove ${row.cuCode}`}
                            title={`Remove ${row.cuCode}`}
                            className="p-2 text-[#64748B] hover:text-[#DC2626] disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                {setupError ? (
                  <p role="alert" className="text-xs font-medium text-[#DC2626]">
                    {setupError}
                  </p>
                ) : setupSavedMessage ? (
                  <p className="text-xs font-medium text-[#3F6212]">
                    {setupSavedMessage}
                  </p>
                ) : (
                  <p className="text-xs text-[#64748B]">
                    Changes apply across{' '}
                    <span className="font-semibold text-[#0F172A]">
                      {getCourseById(setupCourseId)?.name}
                    </span>{' '}
                    and recalculate student 80% eligibility immediately.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleAddDraftRow}
                  disabled={draftUnits.length >= 50}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Class / CU
                </button>

                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-[#475569] bg-white border border-[#E2E8F0] rounded-lg hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore Planner Defaults
                </button>

                {setupDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setSetupDirty(false);
                      const merged = buildMergedCourseConfig(
                        setupCourseId,
                        courseConfigs[setupCourseId]
                      );
                      setDraftUnits(cloneUnitList(merged.unitList));
                      setSetupError(null);
                    }}
                    className="px-3 py-2 min-h-[40px] text-xs font-medium text-[#475569] hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
                  >
                    Discard
                  </button>
                )}

                <button
                  type="submit"
                  disabled={savingSetup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingSetup ? 'Saving Setup...' : 'Save Course CU Setup'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
