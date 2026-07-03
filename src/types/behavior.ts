export type BehaviorType = 'positive' | 'negative';

/** ระดับความรุนแรงของกฎระเบียบ (ผิดระเบียบ) */
export type BehaviorSeverity = 'light' | 'medium' | 'severe';

// ── Catalog (Level 1 — master data, no academicYearId) ─────────────────────────

export interface BehaviorTemplate {
  id: string;
  label: string;
  points: number; // signed: -5 หรือ +5
  type: BehaviorType;
  /** ใช้กับรายการผิดระเบียบเท่านั้น */
  severity?: BehaviorSeverity;
  isActive: boolean;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NewBehaviorTemplate = Omit<BehaviorTemplate, 'id' | 'createdAt' | 'updatedAt'>;

// ── Record (Level 3 — transactional) ────────────────────────────────────────────

export interface BehaviorRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId: string;
  className: string;
  departmentId: string;
  academicYearId: string;
  semester: number;
  templateId: string;
  templateLabel: string;
  points: number;
  type: BehaviorType;
  severity?: BehaviorSeverity;
  note?: string;
  recordedBy: string;
  recordedByName: string;
  date: string; // YYYY-MM-DD
  createdAt?: unknown;
}

export type NewBehaviorRecord = Omit<BehaviorRecord, 'id' | 'createdAt'>;

// ── Totals (aggregate doc, id = `${academicYearId}_${studentId}`) ──────────────

export interface BehaviorTotal {
  studentId: string;
  studentName: string;
  studentCode: string;
  classId: string;
  className: string;
  departmentId: string;
  academicYearId: string;
  baselinePoints: number;
  totalPoints: number;
  positiveCount: number;
  negativeCount: number;
  updatedAt?: unknown;
}
