import {
  COURSES,
  CU_CODES,
  type AttendanceRecordDoc,
  type CourseCuConfigDoc,
  type CourseId,
  type CuUnitConfig,
  type SessionDoc,
} from '../types';

export const CREATIVE_MULTIMEDIA_EXCLUDED_HOLIDAYS = [
  'Cuti Semester 01 (1 wk)',
  'Cuti Semester 02 (1 wk)',
  'Cuti Semester / Orientasi (1 wk)',
  'Cuti Semester 03 (1 wk)',
  'Cuti Semester 04 (1 wk)',
];

const CREATIVE_MULTIMEDIA_PLANNER_UNITS: CuUnitConfig[] = [
  { cuCode: 'ORIENTASI', unitName: 'Orientasi', levelLabel: 'Part 1', category: 'COMP', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-01', unitName: 'Core Abilities Lvl 01', levelLabel: 'Part 1', category: 'MODU', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-02', unitName: 'Core Abilities Lvl 02', levelLabel: 'Part 1', category: 'MODU', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-03', unitName: 'Core Abilities Lvl 03', levelLabel: 'Part 1', category: 'MODU', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'MP-TVET', unitName: 'Maya / Unreal / Canva for Communication', levelLabel: 'Part 1', category: 'MODU', totalHours: 160, weeks: 4, targetDays: 20 },
  { cuCode: 'L3-CU01', unitName: 'Graphic Interface Production', levelLabel: 'Part 1', category: 'COMP', totalHours: 360, weeks: 11, targetDays: 55 },
  { cuCode: 'L3-CU02', unitName: 'Audio Video Production', levelLabel: 'Part 1', category: 'COMP', totalHours: 480, weeks: 14, targetDays: 70 },
  { cuCode: 'L3-CU03', unitName: 'Interactive Application Development', levelLabel: 'Part 1', category: 'COMP', totalHours: 640, weeks: 19, targetDays: 95 },
  { cuCode: 'L3-CU04', unitName: 'Interactive Multimedia Technical Support', levelLabel: 'Part 1', category: 'COMP', totalHours: 280, weeks: 8, targetDays: 40 },
  { cuCode: 'L3-CU05', unitName: 'Interactive Multimedia Design Supervision', levelLabel: 'Part 1', category: 'COMP', totalHours: 80, weeks: 3, targetDays: 15 },
  { cuCode: 'VERIFIKASI', unitName: 'Verifikasi', levelLabel: 'Part 1', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-04', unitName: 'Core Abilities Lvl 04', levelLabel: 'Part 2', category: 'MODU', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'MODUL-PEN-TVET', unitName: 'Maya / Unreal / Canva for Communication', levelLabel: 'Part 2', category: 'ADDE', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'TAKLIMAT-1', unitName: 'Taklimat Projek / Latihan Industri & EXP Day', levelLabel: 'Part 2', category: 'COMP', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'L4-CU01', unitName: 'Develop Project Ideas and Concepts', levelLabel: 'Part 2', category: 'COMP', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'L4-CU02', unitName: 'Perform Multimedia Content Writing', levelLabel: 'Part 2', category: 'COMP', totalHours: 120, weeks: 3, targetDays: 15 },
  { cuCode: 'TAKLIMAT-2', unitName: 'Taklimat Latihan Industri 2 / Permohonan Tempat Latihan', levelLabel: 'Part 2', category: 'COMP', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'CDAP', unitName: 'Career Development & Professionalism', levelLabel: 'Part 2', category: 'ADDE', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'L4-CU03', unitName: 'Establish Podcast Production', levelLabel: 'Part 2', category: 'COMP', totalHours: 120, weeks: 3, targetDays: 15 },
  { cuCode: 'L4-CU04', unitName: 'Establish Single-Camera Production (SCP)', levelLabel: 'Part 2', category: 'COMP', totalHours: 120, weeks: 3, targetDays: 15 },
  { cuCode: 'L4-CU05', unitName: 'Establish Vodcast Production', levelLabel: 'Part 2', category: 'COMP', totalHours: 120, weeks: 3, targetDays: 15 },
  { cuCode: 'L4-CU06', unitName: 'Develop Interactive Application', levelLabel: 'Part 2', category: 'COMP', totalHours: 200, weeks: 5, targetDays: 25 },
  { cuCode: 'LATIHAN-INDUSTRI', unitName: 'Latihan Industri', levelLabel: 'Part 2', category: 'MODU', totalHours: 640, weeks: 16, targetDays: 80 },
  { cuCode: 'PROJEK-TAHUN-AKHIR', unitName: 'Projek Tahun Akhir', levelLabel: 'Part 2', category: 'MODU', totalHours: 160, weeks: 4, targetDays: 20 },
  { cuCode: 'EXP-DAY', unitName: 'EXP Day Preparation', levelLabel: 'Part 2', category: 'ADDE', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'PREP-PPL', unitName: 'Verifikasi (Preparation PPL)', levelLabel: 'Part 2', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'PPL-VERIF', unitName: 'Verifikasi (PPL Verification)', levelLabel: 'Part 2', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
];

export const GAME_ASSETS_EXCLUDED_HOLIDAYS = [
  'Cuti Semester 01 (1 wk)',
  'Cuti Semester 02 (1 wk)',
];

const GAME_ASSETS_PLANNER_UNITS: CuUnitConfig[] = [
  { cuCode: 'ORIENTASI', unitName: 'Orientasi', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-01', unitName: 'Core Abilities Lvl 01', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-02', unitName: 'Core Abilities Lvl 02', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-03', unitName: 'Core Abilities Lvl 03', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'C01', unitName: '3D Asset Modeling', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 480, weeks: 12, targetDays: 60 },
  { cuCode: 'C02', unitName: '3D Asset Material Setup and Texturing', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 440, weeks: 11, targetDays: 55 },
  { cuCode: 'TAKLIMAT-1', unitName: 'Taklimat Industri & Taklimat Latihan Industri', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'CDAP', unitName: 'CDAP (Career Development & Professionalism)', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'C03', unitName: '3D Asset and Character Animation', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 360, weeks: 9, targetDays: 45 },
  { cuCode: 'C04', unitName: 'Game Engine 3D Asset Integration', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 200, weeks: 5, targetDays: 25 },
  { cuCode: 'TAKLIMAT-2', unitName: 'Taklimat Latihan Industri 2 & Permohonan Latihan Industri', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'MODUL-PENYEDIA-TVET', unitName: 'Modul Penyedia TVET Maya', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 160, weeks: 4, targetDays: 20 },
  { cuCode: 'C05', unitName: 'Digital Sculpting', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 360, weeks: 9, targetDays: 45 },
  { cuCode: 'LATIHAN-INDUSTRI', unitName: 'Latihan Industri', levelLabel: 'SKM 3', category: 'COMPETENCY', totalHours: 480, weeks: 12, targetDays: 60 },
  { cuCode: 'PERSEDIAAN-VERIFIKASI', unitName: 'Persediaan Verifikasi', levelLabel: 'SKM 3', category: 'VERIFICATION', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'VERIFIKASI', unitName: 'Verifikasi', levelLabel: 'SKM 3', category: 'VERIFICATION', totalHours: 40, weeks: 1, targetDays: 5 },
];

export const ANIMATION_3D_EXCLUDED_HOLIDAYS = [
  'Cuti Semester 1 (Wk 13, 1 wk)',
  'Cuti Semester 2 (Wk 28, 1 wk)',
];

const ANIMATION_3D_PLANNER_UNITS: CuUnitConfig[] = [
  { cuCode: 'CA-LVL-04', unitName: 'Core Abilities L4 (80H)', levelLabel: 'Wk 1-2', category: 'CORE', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'TAKLIMAT-PTA', unitName: 'Taklimat Projek Tahun Akhir (PTA)', levelLabel: 'Wk 3', category: 'PTA', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'CU1', unitName: '3D Character Animation', levelLabel: 'Wk 4-10', category: 'CU', totalHours: 280, weeks: 7, targetDays: 35 },
  { cuCode: 'MODUL-PENYEDIA-UE', unitName: 'Modul Penyedia: Unreal Engine', levelLabel: 'Wk 11', category: 'MODUL', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'PTA-PROGRES-1', unitName: 'Perjumpaan & Pembentangan Pertama Progres PTA - Storyline & Skrip', levelLabel: 'Wk 12', category: 'PTA', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'TAKLIMAT-LI-MOCK', unitName: 'Taklimat Latihan Industri & Mock Interview', levelLabel: 'Wk 14 (Day 1)', category: 'TAKLIMAT', totalHours: 8, weeks: 1, targetDays: 1 },
  { cuCode: 'TAKLIMAT-XP-DAY', unitName: 'Taklimat dan Lantikan AJK XP Day', levelLabel: 'Wk 14 (Day 2)', category: 'TAKLIMAT', totalHours: 8, weeks: 1, targetDays: 1 },
  { cuCode: 'CU2', unitName: '3D Creature Animation', levelLabel: 'Wk 14-20', category: 'CU', totalHours: 264, weeks: 7, targetDays: 33 },
  { cuCode: 'PTA-PROGRES-2', unitName: 'Perjumpaan & Pembentangan Ke-2 Progres PTA - Concept Art Character, Props & Environment', levelLabel: 'Wk 21', category: 'PTA', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CU3', unitName: '3D Generic Animation', levelLabel: 'Wk 22-25', category: 'CU', totalHours: 160, weeks: 4, targetDays: 20 },
  { cuCode: 'PTA-PROGRES-3', unitName: 'Perjumpaan & Pembentangan Ke-3 Progres PTA - Storyboard, Storyboard Animatic with Audio', levelLabel: 'Wk 26', category: 'PTA', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'PERSIAPAN-LI', unitName: 'Persiapan Latihan Industri', levelLabel: 'Wk 27', category: 'LI', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'LATIHAN-INDUSTRI', unitName: 'Latihan Industri (4 Bulan)', levelLabel: 'Wk 29-44', category: 'LI', totalHours: 640, weeks: 16, targetDays: 80 },
  { cuCode: 'PROJEK-AKHIR', unitName: 'Projek Akhir', levelLabel: 'Wk 45-51', category: 'PTA', totalHours: 280, weeks: 7, targetDays: 35 },
  { cuCode: 'PERSEDIAAN-XP-DAY', unitName: 'Persediaan Untuk XP Day', levelLabel: 'Wk 52', category: 'EVENT', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'EVENT-XP-DAY', unitName: 'Event XP Day', levelLabel: 'Wk 53', category: 'EVENT', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'PERSIAPAN-PPL', unitName: 'Persiapan Verifikasi PPL', levelLabel: 'Wk 54', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'VERIFIKASI-PPL', unitName: 'Verifikasi PPL & Pembentangan Akhir', levelLabel: 'Wk 55', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
];

export const PRODUCTION_SUPPORT_EXCLUDED_HOLIDAYS = [
  'Cuti Sem 01 (Wk 27, 1 wk)',
  'Cuti Sem 02 (Wk 48, 1 wk)',
];

const PRODUCTION_SUPPORT_PLANNER_UNITS: CuUnitConfig[] = [
  { cuCode: 'ORIENTASI', unitName: 'Orientasi', levelLabel: 'Wk 1', category: 'ORIENTASI', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-01', unitName: 'Core Abilities Lvl 01 (40H)', levelLabel: 'Wk 2', category: 'CORE', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-02', unitName: 'Core Abilities Lvl 02 (40H)', levelLabel: 'Wk 3', category: 'CORE', totalHours: 40, weeks: 1, targetDays: 5 },
  { cuCode: 'CA-LVL-03', unitName: 'Core Abilities Lvl 03 (80H)', levelLabel: 'Wk 4-5', category: 'CORE', totalHours: 80, weeks: 2, targetDays: 10 },
  { cuCode: 'E01', unitName: 'E01 (160H)', levelLabel: 'Wk 6-10', category: 'ELECTIVE', totalHours: 160, weeks: 5, targetDays: 25 },
  { cuCode: 'E02', unitName: 'E02 (200H)', levelLabel: 'Wk 11-16', category: 'ELECTIVE', totalHours: 200, weeks: 6, targetDays: 30 },
  { cuCode: 'C01', unitName: 'C01 (360H)', levelLabel: 'Wk 17-26', category: 'CU', totalHours: 360, weeks: 10, targetDays: 50 },
  { cuCode: 'C02', unitName: 'C02 (280H)', levelLabel: 'Wk 28-35', category: 'CU', totalHours: 280, weeks: 8, targetDays: 40 },
  { cuCode: 'C03', unitName: 'C03 (440H)', levelLabel: 'Wk 36-47', category: 'CU', totalHours: 440, weeks: 12, targetDays: 60 },
  { cuCode: 'TAKLIMAT-CDAP', unitName: 'Taklimat Industri & CDAP', levelLabel: 'Wk 49', category: 'TAKLIMAT', totalHours: 40, weeks: 1, targetDays: 1 },
  { cuCode: 'MODUL-PENYEDIA-TVET', unitName: 'Modul Penyedia TVET Maya (160H)', levelLabel: 'Wk 50-53', category: 'MODUL', totalHours: 160, weeks: 4, targetDays: 20 },
  { cuCode: 'C04', unitName: 'C04 (160H)', levelLabel: 'Wk 54-58', category: 'CU', totalHours: 160, weeks: 5, targetDays: 25 },
  { cuCode: 'C05', unitName: 'C05 (240H)', levelLabel: 'Wk 59-65', category: 'CU', totalHours: 240, weeks: 7, targetDays: 35 },
  { cuCode: 'LATIHAN-INDUSTRI', unitName: 'Latihan Industri (480H)', levelLabel: 'Wk 66-79', category: 'LI', totalHours: 480, weeks: 14, targetDays: 70 },
  { cuCode: 'VERIFIKASI-PPL', unitName: 'Persediaan / Verifikasi PPL', levelLabel: 'Wk 80', category: 'VERIF', totalHours: 40, weeks: 1, targetDays: 5 },
];

export function getCourseById(courseId?: string) {
  return COURSES.find((c) => c.id === courseId) || null;
}

export function isValidCourseIdSlug(value?: string): value is string {
  return Boolean(
    value &&
      value.length >= 2 &&
      value.length <= 64 &&
      /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

export function slugifyCourseId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || `program-${Date.now().toString(36)}`;
}

export function normalizeRequiredPercentage(raw?: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(100, Math.max(1, Math.round(raw)));
  }
  return 80;
}

export interface ActiveCourseSummary {
  id: string;
  name: string;
  shortName: string;
  isDefault: boolean;
}

export function getCourseDisplayMeta(
  courseId?: string,
  courseConfigs?: Record<string, CourseCuConfigDoc>,
  fallbackName?: string
): { id: string; name: string; shortName: string } | null {
  if (!courseId || !isValidCourseIdSlug(courseId)) return null;
  const builtIn = getCourseById(courseId);
  const stored = courseConfigs?.[courseId];
  const name =
    stored?.courseName?.trim() ||
    builtIn?.name ||
    fallbackName?.trim() ||
    courseId;
  const shortName =
    stored?.courseShortName?.trim() ||
    builtIn?.shortName ||
    name.slice(0, 28);
  return { id: courseId, name, shortName };
}

export function getActiveCourseList(
  courseConfigs: Record<string, CourseCuConfigDoc>
): ActiveCourseSummary[] {
  const result: ActiveCourseSummary[] = [];
  const seen = new Set<string>();

  for (const def of COURSES) {
    const stored = courseConfigs[def.id];
    seen.add(def.id);
    if (stored?.isDeleted) continue;
    result.push({
      id: def.id,
      name: stored?.courseName?.trim() || def.name,
      shortName: stored?.courseShortName?.trim() || def.shortName,
      isDefault: true,
    });
  }

  const customList: ActiveCourseSummary[] = [];
  for (const [id, cfg] of Object.entries(courseConfigs)) {
    if (seen.has(id) || cfg.isDeleted) continue;
    if (!isValidCourseIdSlug(id)) continue;
    const name = cfg.courseName?.trim() || id;
    customList.push({
      id,
      name,
      shortName: cfg.courseShortName?.trim() || name.slice(0, 28),
      isDefault: false,
    });
  }

  customList.sort((a, b) => a.name.localeCompare(b.name));
  return [...result, ...customList];
}

export function isTaklimatUnit(unit: {
  cuCode?: string;
  unitName?: string;
  category?: string;
}): boolean {
  return (
    Boolean(unit.cuCode?.toUpperCase().includes('TAKLIMAT')) ||
    Boolean(unit.unitName?.toLowerCase().includes('taklimat')) ||
    unit.category?.toUpperCase() === 'TAKLIMAT'
  );
}

export function normalizeCuCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function isValidCuCode(value?: string): value is string {
  return Boolean(
    value &&
      value.length >= 2 &&
      value.length <= 32 &&
      /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(value)
  );
}

export function getDefaultUnitList(courseId: CourseId): CuUnitConfig[] {
  if (courseId === 'dkm-3d-animation') {
    return ANIMATION_3D_PLANNER_UNITS.map((u) => ({ ...u }));
  }
  if (courseId === 'dkm-creative-multimedia') {
    return CREATIVE_MULTIMEDIA_PLANNER_UNITS.map((u) => ({ ...u }));
  }
  if (courseId === 'skm-3d-game-assets') {
    return GAME_ASSETS_PLANNER_UNITS.map((u) => ({ ...u }));
  }
  if (courseId === 'skm-3d-production-support') {
    return PRODUCTION_SUPPORT_PLANNER_UNITS.map((u) => ({ ...u }));
  }

  return CU_CODES.map((code) => {
    const num = code.replace('CU', '');
    return {
      cuCode: code,
      unitName: `Competency Unit ${num}`,
      weeks: 11,
      targetDays: 55,
    };
  });
}

export function sanitizeUnitItem(raw: Partial<CuUnitConfig>, fallbackIndex = 1): CuUnitConfig {
  const normalizedCode = normalizeCuCode(raw.cuCode || '') || `CU${String(fallbackIndex).padStart(2, '0')}`;
  const cuCode = isValidCuCode(normalizedCode) ? normalizedCode : `CU${String(fallbackIndex).padStart(2, '0')}`;
  const weeks =
    typeof raw.weeks === 'number' && Number.isFinite(raw.weeks) && raw.weeks >= 1
      ? Math.min(52, Math.round(raw.weeks))
      : 1;
  const targetDays =
    typeof raw.targetDays === 'number' && Number.isFinite(raw.targetDays) && raw.targetDays >= 1
      ? Math.min(365, Math.round(raw.targetDays))
      : weeks * 5;
  const requiredPercentage = normalizeRequiredPercentage(raw.requiredPercentage);

  const item: CuUnitConfig = {
    cuCode,
    unitName: (raw.unitName || '').trim().slice(0, 140) || cuCode,
    weeks,
    targetDays,
    requiredPercentage,
  };

  if (raw.levelLabel?.trim()) {
    item.levelLabel = raw.levelLabel.trim().slice(0, 40);
  }
  if (raw.category?.trim()) {
    item.category = raw.category.trim().slice(0, 40);
  }
  if (typeof raw.totalHours === 'number' && Number.isFinite(raw.totalHours) && raw.totalHours >= 0) {
    item.totalHours = Math.min(2000, Math.round(raw.totalHours));
  }

  return item;
}

export function buildMergedCourseConfig(
  courseId: CourseId,
  stored?: CourseCuConfigDoc | null
): CourseCuConfigDoc {
  const builtIn = getCourseById(courseId);
  const resolvedId = builtIn?.id || (isValidCourseIdSlug(courseId) ? courseId : COURSES[0].id);
  const resolvedName =
    stored?.courseName?.trim() || builtIn?.name || resolvedId;
  const resolvedShortName =
    stored?.courseShortName?.trim() || builtIn?.shortName || resolvedName.slice(0, 28);
  let unitList: CuUnitConfig[];

  if (stored?.unitList && Array.isArray(stored.unitList) && stored.unitList.length > 0) {
    unitList = stored.unitList.slice(0, 50).map((u, idx) => sanitizeUnitItem(u, idx + 1));
  } else if (stored?.units && typeof stored.units === 'object') {
    const entries = Object.values(stored.units);
    if (entries.length > 0) {
      entries.sort((a, b) => a.cuCode.localeCompare(b.cuCode, undefined, { numeric: true }));
      unitList = entries.slice(0, 50).map((u, idx) => sanitizeUnitItem(u, idx + 1));
    } else {
      unitList = getDefaultUnitList(resolvedId).map((u, idx) => sanitizeUnitItem(u, idx + 1));
    }
  } else {
    unitList = getDefaultUnitList(resolvedId).map((u, idx) => sanitizeUnitItem(u, idx + 1));
  }

  return {
    courseId: resolvedId,
    courseName: resolvedName,
    courseShortName: resolvedShortName,
    isDeleted: Boolean(stored?.isDeleted),
    unitList,
    excludedHolidays:
      resolvedId === 'dkm-3d-animation'
        ? ANIMATION_3D_EXCLUDED_HOLIDAYS
        : resolvedId === 'dkm-creative-multimedia'
          ? CREATIVE_MULTIMEDIA_EXCLUDED_HOLIDAYS
          : resolvedId === 'skm-3d-game-assets'
            ? GAME_ASSETS_EXCLUDED_HOLIDAYS
            : resolvedId === 'skm-3d-production-support'
              ? PRODUCTION_SUPPORT_EXCLUDED_HOLIDAYS
              : undefined,
    updatedByUid: stored?.updatedByUid,
    updatedAt: stored?.updatedAt,
  };
}

export function findUnitInConfig(
  config: CourseCuConfigDoc,
  cuCode: string
): CuUnitConfig | null {
  const exact = config.unitList.find((u) => u.cuCode === cuCode);
  if (exact) return exact;
  const suffixMatch = config.unitList.find((u) => u.cuCode.endsWith(`-${cuCode}`));
  return suffixMatch || null;
}

export function formatCuPrefixedTitle(cuCode: string, rawTitle: string): string {
  const cleanTitle = rawTitle.trim();
  if (!cuCode) return cleanTitle;
  const upperCode = cuCode.toUpperCase();
  const upperTitle = cleanTitle.toUpperCase();

  if (upperTitle.startsWith(upperCode)) {
    return cleanTitle;
  }

  if (/^CU(0[1-9]|10)$/.test(upperCode)) {
    const cuDigits = upperCode.replace(/^CU/i, '');
    const prefixPattern = new RegExp(`^cu\\s*0?${Number(cuDigits)}\\b`, 'i');
    if (prefixPattern.test(cleanTitle)) {
      return cleanTitle;
    }
  }

  if (!cleanTitle) {
    return upperCode;
  }
  return `${upperCode} - ${cleanTitle}`;
}

export function getMinRequiredDaysForThreshold(
  targetDays: number,
  requiredPercentage = 80
): number {
  const safeTarget = Math.max(1, Math.round(targetDays));
  const safePct = normalizeRequiredPercentage(requiredPercentage);
  return Math.floor((safeTarget * safePct + 99) / 100);
}

export function getMinRequiredDaysFor80(targetDays: number): number {
  return getMinRequiredDaysForThreshold(targetDays, 80);
}

export interface StudentCuProgressSummary {
  key: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  courseId: CourseId;
  courseName: string;
  courseShortName: string;
  batch: string;
  cuCode: string;
  unitName: string;
  levelLabel?: string;
  weeks: number;
  targetDays: number;
  requiredPercentage: number;
  minRequiredDays: number;
  attendedDays: number;
  percentage: number;
  percentageLabel: string;
  isExamEligible: boolean;
  daysNeededFor80: number;
  unitOrderIndex: number;
}

export function calculateStudentCuProgress(
  records: AttendanceRecordDoc[],
  courseConfigs: Record<string, CourseCuConfigDoc>
): StudentCuProgressSummary[] {
  interface Accumulator {
    studentUid: string;
    studentName: string;
    studentEmail: string;
    courseId: CourseId;
    courseName: string;
    courseShortName: string;
    batch: string;
    cuCode: string;
    fallbackTitle: string;
    attendedKeys: Set<string>;
  }

  const groups = new Map<string, Accumulator>();

  for (const rec of records) {
    const course = getCourseDisplayMeta(rec.courseId, courseConfigs, rec.courseName);
    if (!course || !isValidCuCode(rec.cuCode)) {
      continue;
    }

    const batch = (rec.batch || '').trim() || 'General';
    const key = `${rec.studentUid}::${course.id}::${batch.toLowerCase()}::${rec.cuCode}`;

    let acc = groups.get(key);
    if (!acc) {
      acc = {
        studentUid: rec.studentUid,
        studentName: rec.studentName,
        studentEmail: rec.studentEmail,
        courseId: course.id,
        courseName: course.name,
        courseShortName: course.shortName,
        batch,
        cuCode: rec.cuCode,
        fallbackTitle: rec.sessionTitle,
        attendedKeys: new Set<string>(),
      };
      groups.set(key, acc);
    }

    const dayKey =
      rec.sessionDate ||
      (rec.checkedInAt
        ? rec.checkedInAt.toDate().toISOString().slice(0, 10)
        : rec.sessionId);
    acc.attendedKeys.add(dayKey);
  }

  const results: StudentCuProgressSummary[] = [];

  for (const [key, acc] of groups.entries()) {
    const config = buildMergedCourseConfig(acc.courseId, courseConfigs[acc.courseId]);
    const unit = findUnitInConfig(config, acc.cuCode);
    const unitOrderIndex = unit ? config.unitList.indexOf(unit) : 999;

    const unitName = unit?.unitName || acc.fallbackTitle || acc.cuCode;
    const weeks = unit?.weeks ?? 11;
    const targetDays = Math.max(1, unit?.targetDays ?? 55);
    const requiredPercentage = normalizeRequiredPercentage(unit?.requiredPercentage);
    const minRequiredDays = getMinRequiredDaysForThreshold(
      targetDays,
      requiredPercentage
    );
    const attendedDays = acc.attendedKeys.size;
    const rawPct = Math.min(100, (attendedDays / targetDays) * 100);
    const percentage = Math.round(rawPct * 10) / 10;
    const percentageLabel = Number.isInteger(percentage)
      ? `${percentage}%`
      : `${percentage.toFixed(1)}%`;
    const isExamEligible = attendedDays >= minRequiredDays;
    const daysNeededFor80 = Math.max(0, minRequiredDays - attendedDays);

    results.push({
      key,
      studentUid: acc.studentUid,
      studentName: acc.studentName,
      studentEmail: acc.studentEmail,
      courseId: acc.courseId,
      courseName: acc.courseName,
      courseShortName: acc.courseShortName,
      batch: acc.batch,
      cuCode: acc.cuCode,
      unitName,
      levelLabel: unit?.levelLabel,
      weeks,
      targetDays,
      requiredPercentage,
      minRequiredDays,
      attendedDays,
      percentage,
      percentageLabel,
      isExamEligible,
      daysNeededFor80,
      unitOrderIndex,
    });
  }

  results.sort((a, b) => {
    const c = a.courseName.localeCompare(b.courseName);
    if (c !== 0) return c;
    const batchCmp = a.batch.localeCompare(b.batch, undefined, { numeric: true });
    if (batchCmp !== 0) return batchCmp;
    if (a.unitOrderIndex !== b.unitOrderIndex) {
      return a.unitOrderIndex - b.unitOrderIndex;
    }
    const cuCmp = a.cuCode.localeCompare(b.cuCode, undefined, { numeric: true });
    if (cuCmp !== 0) return cuCmp;
    return a.studentName.localeCompare(b.studentName);
  });

  return results;
}

export function getStudentCuStatusForSession(params: {
  studentUid: string;
  studentName: string;
  studentEmail: string;
  courseId?: string;
  courseName?: string;
  cuCode?: string;
  batch?: string;
  fallbackTitle?: string;
  records: AttendanceRecordDoc[];
  courseConfigs: Record<string, CourseCuConfigDoc>;
}): StudentCuProgressSummary | null {
  const course = getCourseDisplayMeta(
    params.courseId,
    params.courseConfigs,
    params.courseName
  );
  if (!course || !isValidCuCode(params.cuCode)) return null;

  const batch = (params.batch || '').trim() || 'General';
  const existing = calculateStudentCuProgress(
    params.records.filter((r) => r.studentUid === params.studentUid),
    params.courseConfigs
  ).find(
    (item) =>
      item.courseId === course.id &&
      item.cuCode === params.cuCode &&
      item.batch.toLowerCase() === batch.toLowerCase()
  );

  if (existing) return existing;

  const config = buildMergedCourseConfig(course.id, params.courseConfigs[course.id]);
  const unit = findUnitInConfig(config, params.cuCode);
  const unitOrderIndex = unit ? config.unitList.indexOf(unit) : 999;
  const weeks = unit?.weeks ?? 11;
  const targetDays = Math.max(1, unit?.targetDays ?? 55);
  const requiredPercentage = normalizeRequiredPercentage(unit?.requiredPercentage);
  const minRequiredDays = getMinRequiredDaysForThreshold(
    targetDays,
    requiredPercentage
  );

  return {
    key: `${params.studentUid}::${course.id}::${batch.toLowerCase()}::${params.cuCode}`,
    studentUid: params.studentUid,
    studentName: params.studentName,
    studentEmail: params.studentEmail,
    courseId: course.id,
    courseName: course.name,
    courseShortName: course.shortName,
    batch,
    cuCode: params.cuCode,
    unitName: unit?.unitName || params.fallbackTitle || params.cuCode,
    levelLabel: unit?.levelLabel,
    weeks,
    targetDays,
    requiredPercentage,
    minRequiredDays,
    attendedDays: 0,
    percentage: 0,
    percentageLabel: '0%',
    isExamEligible: false,
    daysNeededFor80: minRequiredDays,
    unitOrderIndex,
  };
}

export function sanitizeCsvFilename(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/^-+|-+$/g, '')
    .trim()
    .slice(0, 120);
}

export function escapeCsvCellValue(value: string | number): string {
  const raw = String(value);
  const safe =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildSessionCsvFilename(session: SessionDoc): string {
  const rawTitle = (session.title || session.classLab || 'Class Session').trim();
  const cuPart =
    session.cuCode &&
    !rawTitle.toUpperCase().startsWith(session.cuCode.toUpperCase())
      ? `${session.cuCode} - ${rawTitle}`
      : rawTitle;

  const rawWeek = (session.week || '').trim();
  let weekPart = '';
  if (rawWeek) {
    weekPart = /^\d+$/.test(rawWeek) ? `Week ${rawWeek}` : rawWeek;
  } else if (session.sessionDate) {
    weekPart = session.sessionDate;
  }

  const baseName = weekPart ? `${cuPart} - ${weekPart}` : cuPart;
  return `${sanitizeCsvFilename(baseName) || 'attendance'}.csv`;
}

export interface CompiledCuCsvResult {
  filename: string;
  csvContent: string;
  dateCount: number;
  studentCount: number;
}

export function compileFullCuAttendanceCsv(params: {
  courseId: CourseId;
  cuCode: string;
  batchFilter: string;
  sessions: SessionDoc[];
  records: AttendanceRecordDoc[];
  courseConfigs: Record<string, CourseCuConfigDoc>;
}): CompiledCuCsvResult | null {
  const { courseId, cuCode, batchFilter, sessions, records, courseConfigs } =
    params;

  const course = getCourseDisplayMeta(courseId, courseConfigs);
  if (!course || !isValidCuCode(cuCode)) return null;

  const config = buildMergedCourseConfig(courseId, courseConfigs[courseId]);
  const unit = findUnitInConfig(config, cuCode);
  const unitName = unit?.unitName || cuCode;
  const weeks = unit?.weeks ?? 11;
  const targetDays = Math.max(1, unit?.targetDays ?? 55);
  const requiredPercentage = normalizeRequiredPercentage(unit?.requiredPercentage);
  const minRequiredDays = getMinRequiredDaysForThreshold(
    targetDays,
    requiredPercentage
  );

  const normalizedBatchFilter =
    batchFilter && batchFilter !== 'all' ? batchFilter.trim() : 'all';

  const matchingSessions = sessions.filter((s) => {
    if (s.courseId !== courseId || s.cuCode !== cuCode) return false;
    if (normalizedBatchFilter !== 'all') {
      const b = (s.batch || '').trim() || 'General';
      if (b !== normalizedBatchFilter) return false;
    }
    return true;
  });

  const matchingRecords = records.filter((r) => {
    if (r.courseId !== courseId || r.cuCode !== cuCode) return false;
    if (normalizedBatchFilter !== 'all') {
      const b = (r.batch || '').trim() || 'General';
      if (b !== normalizedBatchFilter) return false;
    }
    return true;
  });

  if (matchingSessions.length === 0 && matchingRecords.length === 0) {
    return null;
  }

  const dateColumnMap = new Map<
    string,
    { dateKey: string; weekLabel: string }
  >();

  for (const s of matchingSessions) {
    const dateKey =
      s.sessionDate ||
      (s.createdAt ? s.createdAt.toDate().toISOString().slice(0, 10) : s.id);
    const weekRaw = (s.week || '').trim();
    const weekLabel = weekRaw
      ? /^\d+$/.test(weekRaw)
        ? `Week ${weekRaw}`
        : weekRaw
      : '';
    const existing = dateColumnMap.get(dateKey);
    if (!existing) {
      dateColumnMap.set(dateKey, { dateKey, weekLabel });
    } else if (!existing.weekLabel && weekLabel) {
      existing.weekLabel = weekLabel;
    }
  }

  for (const r of matchingRecords) {
    const dayKey =
      r.sessionDate ||
      (r.checkedInAt
        ? r.checkedInAt.toDate().toISOString().slice(0, 10)
        : r.sessionId);
    if (!dateColumnMap.has(dayKey)) {
      dateColumnMap.set(dayKey, { dateKey: dayKey, weekLabel: '' });
    }
  }

  const dateColumns = Array.from(dateColumnMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  interface StudentRowAcc {
    studentUid: string;
    studentName: string;
    studentEmail: string;
    batch: string;
    attendedKeys: Set<string>;
  }

  const studentMap = new Map<string, StudentRowAcc>();
  for (const rec of matchingRecords) {
    const batch = (rec.batch || '').trim() || 'General';
    const key = `${rec.studentUid}::${batch.toLowerCase()}`;
    let acc = studentMap.get(key);
    if (!acc) {
      acc = {
        studentUid: rec.studentUid,
        studentName: rec.studentName,
        studentEmail: rec.studentEmail,
        batch,
        attendedKeys: new Set<string>(),
      };
      studentMap.set(key, acc);
    }
    const dayKey =
      rec.sessionDate ||
      (rec.checkedInAt
        ? rec.checkedInAt.toDate().toISOString().slice(0, 10)
        : rec.sessionId);
    acc.attendedKeys.add(dayKey);
  }

  const studentRows = Array.from(studentMap.values()).sort((a, b) => {
    const batchCmp = a.batch.localeCompare(b.batch, undefined, { numeric: true });
    if (batchCmp !== 0) return batchCmp;
    return a.studentName.localeCompare(b.studentName);
  });

  const isTaklimat = isTaklimatUnit({ cuCode, unitName, category: unit?.category });
  const durationLabel = isTaklimat
    ? `${targetDays} ${targetDays === 1 ? 'Day' : 'Days'}`
    : `${weeks} Weeks`;

  const metadataRow: (string | number)[] = [
    'Course',
    course.name,
    'CU',
    `${cuCode} - ${unitName}`,
    'Duration',
    durationLabel,
    'Target Days',
    `${targetDays} (${requiredPercentage}% Min: ${minRequiredDays})`,
    'Batch',
    normalizedBatchFilter === 'all' ? 'All Batches' : normalizedBatchFilter,
  ];

  const headerRow: (string | number)[] = [
    'No',
    'Student Name',
    'Email',
    'Batch',
    ...dateColumns.map((col) =>
      col.weekLabel ? `${col.dateKey} (${col.weekLabel})` : col.dateKey
    ),
    'Days Attended',
    'Target Days',
    'Completion %',
    `${requiredPercentage}% Exam Status`,
  ];

  const dataRows = studentRows.map((student, idx) => {
    const attendedDays = student.attendedKeys.size;
    const rawPct = Math.min(100, (attendedDays / targetDays) * 100);
    const pct = Math.round(rawPct * 10) / 10;
    const pctLabel = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
    const isEligible = attendedDays >= minRequiredDays;
    const statusLabel = isEligible
      ? 'Exam Eligible'
      : `Need ${Math.max(0, minRequiredDays - attendedDays)} more`;

    return [
      idx + 1,
      student.studentName,
      student.studentEmail,
      student.batch,
      ...dateColumns.map((col) =>
        student.attendedKeys.has(col.dateKey) ? 'H' : ''
      ),
      attendedDays,
      targetDays,
      pctLabel,
      statusLabel,
    ];
  });

  const csvContent = [metadataRow, [], headerRow, ...dataRows]
    .map((row) => row.map(escapeCsvCellValue).join(','))
    .join('\n');

  const batchFilePart =
    normalizedBatchFilter !== 'all' ? ` - ${normalizedBatchFilter}` : '';
  const durationFilePart = isTaklimat ? '' : ` - ${weeks} Weeks`;
  const filename = `${sanitizeCsvFilename(
    `${cuCode} - ${unitName}${durationFilePart}${batchFilePart} - Compiled Attendance`
  )}.csv`;

  return {
    filename,
    csvContent,
    dateCount: dateColumns.length,
    studentCount: studentRows.length,
  };
}
