import type { Department, SubjectGroupId } from '@/types/curriculum';
import { SUBJECT_SUBGROUP_CONFIG } from '@/types/curriculum';
import type { QuestionSet } from '@/types/questionBank';

/** รหัสย่อแผนก */
const DEPT_CODES: Record<Department, string> = {
  early: 'E',
  primary: 'P',
  secondary: 'S',
};

/** รหัสย่อกลุ่มสาระ */
const SUBJECT_GROUP_CODES: Record<SubjectGroupId, string> = {
  thai: 'TH',
  math: 'MA',
  science: 'SC',
  social: 'SO',
  pe: 'PE',
  arts: 'AR',
  careers: 'CA',
  foreign: 'FL',
  examM4: 'M4',
  onet: 'ON',
  alevel: 'AL',
  other: 'OT',
};

/** รหัสย่อสาระย่อยที่ใช้บ่อย */
const SUB_SUBJECT_CODES: Record<string, string> = {
  'วิทยาศาสตร์ทั่วไป': 'GN',
  'ฟิสิกส์': 'PH',
  'เคมี': 'CH',
  'ชีววิทยา': 'BI',
  'โลก ดาราศาสตร์ และอวกาศ': 'ES',
  'คณิตศาสตร์พื้นฐาน': 'MB',
  'คณิตศาสตร์เพิ่มเติม': 'MX',
  'ภาษาอังกฤษ': 'EN',
  'ภาษาจีน': 'CN',
  'ภาษาญี่ปุ่น': 'JP',
  'ภาษาฝรั่งเศส': 'FR',
  'ศาสนา ศีลธรรม จริยธรรม': 'RE',
  'หน้าที่พลเมือง': 'CI',
  'เศรษฐศาสตร์': 'EC',
  'ประวัติศาสตร์': 'HI',
  'ภูมิศาสตร์': 'GE',
};

export interface QuestionSetCodeInput {
  curriculumYear?: string;
  department?: string;
  gradeLevel?: string;
  subjectGroup: SubjectGroupId;
  subSubjectGroup?: string;
}

/**
 * รูปแบบ: {YY}{D}{G}{SG}{SS}
 * ตัวอย่าง: 69P04MAMB  →  ประถม ป.4 คณิตศาสตร์ คณิตพื้นฐาน ปี 2569
 */
export function buildQuestionSetCodePrefix(input: QuestionSetCodeInput): string {
  const yearSuffix = academicYearSuffix(input.curriculumYear);
  const dept = input.department && input.department in DEPT_CODES
    ? DEPT_CODES[input.department as Department]
    : 'X';
  const grade = gradeLevelCode(input.gradeLevel);
  const subject = SUBJECT_GROUP_CODES[input.subjectGroup] ?? 'OT';
  const subSubject = subSubjectCode(input.subjectGroup, input.subSubjectGroup);

  return `${yearSuffix}${dept}${grade}${subject}${subSubject}`;
}

/** สร้างรหัสเต็มพร้อมลำดับ: 69P04MAMB001 */
export function generateQuestionSetCode(
  input: QuestionSetCodeInput,
  existingSets: QuestionSet[],
): string {
  const prefix = buildQuestionSetCodePrefix(input);
  const nextSeq = nextSequenceForPrefix(prefix, existingSets, input);
  return `${prefix}${nextSeq}`;
}

export function previewQuestionSetCode(
  input: QuestionSetCodeInput,
  existingSets: QuestionSet[],
): string {
  const prefix = buildQuestionSetCodePrefix(input);
  const nextSeq = nextSequenceForPrefix(prefix, existingSets, input);
  return `${prefix}${nextSeq}`;
}

function academicYearSuffix(curriculumYear?: string): string {
  const digits = (curriculumYear ?? '').replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  return 'XX';
}

function gradeLevelCode(gradeLevel?: string): string {
  if (!gradeLevel) return 'XX';
  const dot = gradeLevel.indexOf('.');
  const num = dot >= 0 ? gradeLevel.slice(dot + 1) : gradeLevel;
  const parsed = Number.parseInt(num, 10);
  if (Number.isNaN(parsed)) return 'XX';
  return String(parsed).padStart(2, '0');
}

function subSubjectCode(subjectGroup: SubjectGroupId, subSubjectGroup?: string): string {
  if (!subSubjectGroup?.trim()) return 'XX';

  const mapped = SUB_SUBJECT_CODES[subSubjectGroup.trim()];
  if (mapped) return mapped;

  const options = SUBJECT_SUBGROUP_CONFIG[subjectGroup];
  const index = options?.indexOf(subSubjectGroup.trim()) ?? -1;
  if (index >= 0) return `S${String(index + 1).padStart(2, '0')}`;

  return 'XX';
}

function nextSequenceForPrefix(
  prefix: string,
  existingSets: QuestionSet[],
  input?: QuestionSetCodeInput,
): string {
  const patterns = [new RegExp(`^${escapeRegExp(prefix)}(\\d{3})$`)];
  if (input) {
    patterns.push(new RegExp(`^${escapeRegExp(buildLegacyDashedPrefix(input))}(\\d{3})$`));
  }

  let max = 0;

  for (const set of existingSets) {
    if (!set.setCode) continue;
    for (const pattern of patterns) {
      const match = set.setCode.match(pattern);
      if (match) {
        max = Math.max(max, Number.parseInt(match[1], 10));
      }
    }
  }

  return String(max + 1).padStart(3, '0');
}

function buildLegacyDashedPrefix(input: QuestionSetCodeInput): string {
  const yearSuffix = academicYearSuffix(input.curriculumYear);
  const dept = input.department && input.department in DEPT_CODES
    ? DEPT_CODES[input.department as Department]
    : 'X';
  const grade = gradeLevelCode(input.gradeLevel);
  const subject = SUBJECT_GROUP_CODES[input.subjectGroup] ?? 'OT';
  const subSubject = subSubjectCode(input.subjectGroup, input.subSubjectGroup);
  return `PMV-${yearSuffix}-${dept}-${grade}-${subject}-${subSubject}-`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** คำอธิบายสั้นๆ สำหรับแสดงใน UI */
export const QUESTION_SET_CODE_FORMAT = '{ปี}{แผนก}{ชั้น}{กลุ่มสาระ}{สาระย่อย}{ลำดับ}';

export const QUESTION_SET_CODE_EXAMPLE = '69P04MAMB001';
