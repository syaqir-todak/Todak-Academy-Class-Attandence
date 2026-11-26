import type { Timestamp } from 'firebase/firestore';

export type AppView = 'checkin' | 'console' | 'kiosk';

export const CAMPUS_ROOMS = [
  'Jaka',
  'Ratna',
  'Rakai',
  'Wana',
  'Menjaya',
  'Remaung',
  'Shima',
  'Pungga',
  'Gana',
  'Siong',
  'Auditorium',
] as const;

export const COURSES = [
  {
    id: 'dkm-3d-animation',
    name: 'DKM 3D Animation Production Operation',
    shortName: 'DKM 3D Animation',
  },
  {
    id: 'dkm-creative-multimedia',
    name: 'DKM Creative Multimedia Development',
    shortName: 'DKM Creative Multimedia',
  },
  {
    id: 'skm-3d-production-support',
    name: 'SKM 3D Production Operation Support',
    shortName: 'SKM 3D Support',
  },
  {
    id: 'skm-3d-game-assets',
    name: 'SKM 3D Game Assets Production',
    shortName: 'SKM 3D Game Assets',
  },
] as const;

export type CourseId = (typeof COURSES)[number]['id'];

export const CU_CODES = [
  'CU01',
  'CU02',
  'CU03',
  'CU04',
  'CU05',
  'CU06',
  'CU07',
  'CU08',
  'CU09',
  'CU10',
] as const;

export type CuCode = string;

export const QR_ROTATE_INTERVALS = [15, 30, 60, 0] as const;

export const STANDALONE_CLASS_TYPES = [
  'Short Course',
  'Part-Time Course',
  '1-Day Class',
  'School Program',
  'Workshop / General Class',
] as const;

export interface CuUnitConfig {
  cuCode: string;
  unitName: string;
  levelLabel?: string;
  category?: string;
  totalHours?: number;
  weeks: number;
  targetDays: number;
}

export interface CourseCuConfigDoc {
  courseId: CourseId;
  courseName: string;
  unitList: CuUnitConfig[];
  units?: Record<string, CuUnitConfig>;
  excludedHolidays?: string[];
  updatedByUid?: string;
  updatedAt?: Timestamp | null;
}

export interface SessionDoc {
  id: string;
  trainerName: string;
  classLab: string;
  title: string;
  courseId?: string;
  courseName?: string;
  cuCode?: string;
  batch?: string;
  week?: string;
  sessionDate?: string;
  autoRotateSeconds?: number;
  instructorUid: string;
  isOpen: boolean;
  isEnded?: boolean;
  tokenSequence: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  endedAt?: Timestamp | null;
}

export interface SessionQrStateDoc {
  sessionId: string;
  instructorUid: string;
  activeToken: string;
  previousToken?: string;
  lastConsumedToken?: string;
  lastConsumedByUid?: string;
  lastConsumedByName?: string;
  tokenSequence: number;
  updatedAt?: Timestamp | null;
}

export interface AttendanceRecordDoc {
  id: string;
  sessionId: string;
  trainerName: string;
  classLab: string;
  sessionTitle: string;
  courseId?: string;
  courseName?: string;
  cuCode?: string;
  batch?: string;
  sessionDate?: string;
  instructorUid: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  deviceId: string;
  tokenUsed: string;
  tokenSequence: number;
  checkedInAt?: Timestamp | null;
}

export interface DeviceLockDoc {
  sessionId: string;
  deviceId: string;
  studentUid: string;
  studentName: string;
  lockedAt?: Timestamp | null;
}

export const ADMIN_EMAIL = 'syaqir@todak.com';
