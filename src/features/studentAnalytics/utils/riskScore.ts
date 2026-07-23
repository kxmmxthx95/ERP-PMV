import type { RiskLevel } from '../types';

// ponytail: fixed thresholds, no per-school config yet — move to Firestore config if schools need tuning
const THRESHOLDS = {
  gpa: { high: 1.5, medium: 2.5 },
  failingSubjects: { high: 2, medium: 1 },
  attendanceRate: { high: 70, medium: 85 },
  rollCallRate: { high: 70, medium: 85 },
};

export interface RiskInput {
  gpa: number | null;
  failingSubjects: number;
  attendanceRate: number | null;
  rollCallRate: number | null;
}

export interface RiskResult {
  riskLevel: RiskLevel;
  riskReasons: string[];
}

export function calcRiskLevel({ gpa, failingSubjects, attendanceRate, rollCallRate }: RiskInput): RiskResult {
  const highReasons: string[] = [];
  const mediumReasons: string[] = [];

  if (gpa !== null && gpa < THRESHOLDS.gpa.high) highReasons.push(`เกรดเฉลี่ยต่ำ (${gpa.toFixed(2)})`);
  else if (gpa !== null && gpa < THRESHOLDS.gpa.medium) mediumReasons.push(`เกรดเฉลี่ยค่อนข้างต่ำ (${gpa.toFixed(2)})`);

  if (failingSubjects >= THRESHOLDS.failingSubjects.high) highReasons.push(`ติด F ${failingSubjects} วิชา`);
  else if (failingSubjects >= THRESHOLDS.failingSubjects.medium) mediumReasons.push(`ติด F ${failingSubjects} วิชา`);

  if (attendanceRate !== null && attendanceRate < THRESHOLDS.attendanceRate.high) highReasons.push(`เข้าเรียน ${attendanceRate}%`);
  else if (attendanceRate !== null && attendanceRate < THRESHOLDS.attendanceRate.medium) mediumReasons.push(`เข้าเรียน ${attendanceRate}%`);

  if (rollCallRate !== null && rollCallRate < THRESHOLDS.rollCallRate.high) highReasons.push(`เข้าแถว ${rollCallRate}%`);
  else if (rollCallRate !== null && rollCallRate < THRESHOLDS.rollCallRate.medium) mediumReasons.push(`เข้าแถว ${rollCallRate}%`);

  if (highReasons.length > 0) return { riskLevel: 'high', riskReasons: highReasons };
  if (mediumReasons.length > 0) return { riskLevel: 'medium', riskReasons: mediumReasons };
  if (gpa === null && attendanceRate === null && rollCallRate === null) return { riskLevel: 'none', riskReasons: [] };
  return { riskLevel: 'low', riskReasons: [] };
}
