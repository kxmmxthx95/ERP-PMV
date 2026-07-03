import {
  DEPARTMENT_CONFIG,
  SUBJECT_GROUP_CONFIG,
  type Department,
  type SubjectGroupId,
} from '@/types/curriculum';
import type { NewQuestionSet, QuestionType } from '@/types/questionBank';

export interface ParsedQuestionSetRow {
  id: string;
  data: Omit<NewQuestionSet, 'createdBy' | 'createdByName'>;
  status: 'ready' | 'error';
  error?: string;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '');
}

function resolveSubjectGroup(raw: string): SubjectGroupId | null {
  const key = raw.toLowerCase().trim();
  if (!key) return 'other';

  if (key in SUBJECT_GROUP_CONFIG) return key as SubjectGroupId;

  for (const [id, cfg] of Object.entries(SUBJECT_GROUP_CONFIG)) {
    const name = cfg.name.toLowerCase();
    const nameEn = cfg.nameEn.toLowerCase();
    if (name === key || nameEn === key || name.includes(key) || key.includes(name)) {
      return id as SubjectGroupId;
    }
  }

  const aliases: Record<string, SubjectGroupId> = {
    'o-net': 'onet',
    onet: 'onet',
    'a-level': 'alevel',
    alevel: 'alevel',
    'สอบเข้าม4': 'examM4',
    'exam-m4': 'examM4',
  };
  return aliases[key] ?? null;
}

function resolveDepartment(raw: string): string | undefined {
  const key = raw.toLowerCase().trim();
  if (!key) return undefined;

  if (key in DEPARTMENT_CONFIG) return key;

  const thaiMap: Record<string, Department> = {
    อนุบาล: 'early',
    ประถม: 'primary',
    มัธยม: 'secondary',
  };
  for (const [label, id] of Object.entries(thaiMap)) {
    if (key.includes(label)) return id;
  }
  return undefined;
}

function resolveQuestionType(raw: string): QuestionType | undefined | false {
  const key = raw.toLowerCase().trim();
  if (!key || key === 'all' || key === 'ทั้งหมด') return undefined;
  if (key === 'multiple_choice' || key === 'mcq' || key.includes('ปรนัย')) return 'multiple_choice';
  if (key === 'essay' || key.includes('อัตนัย')) return 'essay';
  return false;
}

function rowFromRecord(
  record: Record<string, unknown>,
  rowIndex: number,
  curriculumYear: string,
): ParsedQuestionSetRow {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const direct = record[k];
      if (direct !== undefined && direct !== null && String(direct).trim()) {
        return String(direct).trim();
      }
      const normalizedKey = Object.keys(record).find(
        (header) => normalizeHeader(header) === normalizeHeader(k),
      );
      if (normalizedKey && record[normalizedKey] != null && String(record[normalizedKey]).trim()) {
        return String(record[normalizedKey]).trim();
      }
    }
    return '';
  };

  const title = get(['ชื่อชุด', 'title', 'name', 'ชื่อ']);
  const description = get(['คำอธิบาย', 'description', 'desc']);
  const rawSubjectGroup = get(['กลุ่มสาระ', 'subjectgroup', 'subject', 'กลุ่ม']);
  const subSubjectGroup = get(['สาระย่อย', 'subsubjectgroup', 'subsubject', 'วิชา']);
  const rawDepartment = get(['แผนก', 'department', 'dept']);
  const gradeLevel = get(['ระดับชั้น', 'gradelevel', 'grade', 'ชั้น']);
  const rawQuestionType = get(['ประเภทข้อสอบ', 'questiontype', 'type', 'ประเภท']);

  let status: 'ready' | 'error' = 'ready';
  let error = '';

  if (!title) {
    status = 'error';
    error = 'ไม่มีชื่อชุด';
  }

  const subjectGroup = resolveSubjectGroup(rawSubjectGroup);
  if (subjectGroup === null) {
    status = 'error';
    error = error ? `${error}; กลุ่มสาระไม่ถูกต้อง` : 'กลุ่มสาระไม่ถูกต้อง';
  }

  const department = resolveDepartment(rawDepartment);
  if (rawDepartment && !department) {
    status = 'error';
    error = error ? `${error}; แผนกไม่ถูกต้อง` : 'แผนกไม่ถูกต้อง';
  }

  if (department && gradeLevel) {
    const grades = DEPARTMENT_CONFIG[department as Department]?.grades ?? [];
    if (grades.length > 0 && !grades.includes(gradeLevel)) {
      status = 'error';
      error = error ? `${error}; ระดับชั้นไม่ตรงแผนก` : 'ระดับชั้นไม่ตรงแผนก';
    }
  }

  const questionType = resolveQuestionType(rawQuestionType);
  if (rawQuestionType && questionType === false) {
    status = 'error';
    error = error ? `${error}; ประเภทข้อสอบไม่ถูกต้อง` : 'ประเภทข้อสอบไม่ถูกต้อง';
  }

  return {
    id: `set-row-${rowIndex}`,
    status,
    error,
    data: {
      title,
      description: description || undefined,
      subjectGroup: subjectGroup ?? 'other',
      subSubjectGroup: subSubjectGroup || undefined,
      department,
      gradeLevel: gradeLevel || undefined,
      questionType: questionType === false ? undefined : questionType,
      curriculumYear,
    },
  };
}

export function parseQuestionSetCsvText(csvText: string, curriculumYear: string): ParsedQuestionSetRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows: ParsedQuestionSetRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCSVLine(lines[i]);
    const record: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      record[header] = cols[idx]?.trim() ?? '';
    });
    rows.push(rowFromRecord(record, i, curriculumYear));
  }

  return rows;
}

export function parseQuestionSetRecords(
  records: Record<string, unknown>[],
  curriculumYear: string,
): ParsedQuestionSetRow[] {
  return records.map((record, index) => rowFromRecord(record, index + 1, curriculumYear));
}

export const QUESTION_SET_CSV_TEMPLATE = [
  ['ชื่อชุด', 'คำอธิบาย', 'กลุ่มสาระ', 'สาระย่อย', 'แผนก', 'ระดับชั้น', 'ประเภทข้อสอบ'],
  ['ONET-67-P6-SCI', 'ตัวอย่างชุดวิทยาศาสตร์', 'onet', 'วิทยาศาสตร์ทั่วไป', 'primary', 'ป.6', 'multiple_choice'],
  ['ONET-67-P6-MATH', '', 'math', 'คณิตศาสตร์พื้นฐาน', 'primary', 'ป.6', ''],
].map((row) => row.join(',')).join('\n');
