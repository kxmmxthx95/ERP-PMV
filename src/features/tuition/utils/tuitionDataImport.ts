import Papa from 'papaparse';
import { loadXlsx } from '@/lib/lazyXlsx';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { Scholarship, ScholarshipType, StudentFee } from '@/types/tuition';
import { recomputeStudentFeeTotals } from '../hooks/useStudentFees';

export interface TuitionDataImportRow {
  rowIndex: number;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  department: string;
  gradeLevel: string;
  paymentAmount: number;
  paymentDate: string;
  scholarshipType: string;
  discountRaw: string;
  scholarship: Scholarship | null;
  studentFee: StudentFee | null;
  studentName: string;
  status: 'ready' | 'warning' | 'error';
  message?: string;
}

const CODE_HEADERS = ['รหัสนักเรียน', 'studentcode', 'student_code', 'code', 'เลขประจำตัว'];
const PREFIX_HEADERS = ['คำนำหน้า', 'prefix'];
const FIRST_NAME_HEADERS = ['ชื่อ', 'firstname', 'first_name'];
const LAST_NAME_HEADERS = ['นามสกุล', 'lastname', 'last_name'];
const DEPARTMENT_HEADERS = ['แผนก', 'department', 'departmentid'];
const GRADE_HEADERS = ['ระดับชั้น', 'gradelevel', 'grade_level', 'ชั้น'];
const AMOUNT_HEADERS = ['ยอดเงิน', 'ยอดชำระ', 'amount', 'paymentamount', 'payment_amount', 'จำนวนเงิน'];
const DATE_HEADERS = ['วันที่จ่าย', 'วันที่ชำระ', 'paymentdate', 'payment_date', 'date', 'วันที่'];
const SCHOLARSHIP_HEADERS = ['ประเภททุน', 'scholarshiptype', 'scholarship_type', 'ทุน'];
const DISCOUNT_HEADERS = ['ส่วนลด', 'discount', 'ส่วนลด(เปอร์เซ็น,ยอดเงิน)'];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function pickValue(row: Record<string, unknown>, aliases: string[]): string {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key);
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
      return String(value ?? '').trim();
    }
  }
  return '';
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s฿]/g, '');
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function excelSerialToDateString(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function parsePaymentDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return excelSerialToDateString(raw);

  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return null;
}

export function parseDiscount(raw: string): { type: ScholarshipType; value: number } | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.includes('%')) {
    const value = Number(text.replace('%', '').replace(/,/g, '').trim());
    if (Number.isFinite(value) && value > 0 && value <= 100) {
      return { type: 'percentage', value };
    }
    return null;
  }

  const value = Number(text.replace(/[,\s฿]/g, ''));
  if (Number.isFinite(value) && value > 0) {
    return { type: 'fixed', value };
  }
  return null;
}

export function buildScholarship(scholarshipType: string, discountRaw: string): Scholarship | null {
  const discount = parseDiscount(discountRaw);
  if (!discount) return null;
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: scholarshipType.trim() || 'ทุนการศึกษา',
    type: discount.type,
    value: discount.value,
  };
}

export function mergeScholarships(existing: Scholarship[], incoming: Scholarship | null): Scholarship[] {
  if (!incoming) return existing;
  const idx = existing.findIndex((s) => s.label.trim() === incoming.label.trim());
  if (idx >= 0) {
    return existing.map((s, i) => (i === idx ? { ...incoming, id: s.id } : s));
  }
  return [...existing, incoming];
}

function resolveDepartment(raw: string): Department | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (text === 'early' || text.includes('ปฐม')) return 'early';
  if (text === 'primary' || text.includes('ประถม')) return 'primary';
  if (text === 'secondary' || text.includes('มัธยม')) return 'secondary';
  return null;
}

function departmentLabel(dept: Department): string {
  return DEPARTMENT_CONFIG[dept].label;
}

function buildFullName(prefix: string, firstName: string, lastName: string): string {
  return [prefix, firstName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

async function readRawRowsFromText(csvText: string): Promise<Record<string, unknown>[]> {
  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || 'อ่านไฟล์ CSV ไม่สำเร็จ');
  }
  return result.data;
}

async function readRawRowsFromFile(file: File): Promise<Record<string, unknown>[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv')) {
    return readRawRowsFromText(await file.text());
  }

  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('ไม่พบชีตในไฟล์ Excel');
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
}

export function toGoogleSheetCsvUrl(input: string): string | null {
  const patterns = [
    /spreadsheets\/d\/([a-zA-Z0-9-_]+).*gid=(\d+)/,
    /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const gid = match[2] ?? '0';
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    }
  }
  return null;
}

export async function fetchGoogleSheetRows(sheetUrl: string): Promise<Record<string, unknown>[]> {
  const csvUrl = toGoogleSheetCsvUrl(sheetUrl);
  if (!csvUrl) throw new Error('ลิงก์ Google Sheet ไม่ถูกต้อง');
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error('ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ — ตรวจสอบว่าแชร์เป็น "ทุกคนที่มีลิงก์"');
  return readRawRowsFromText(await response.text());
}

export function parseTuitionDataRows(
  rawRows: Record<string, unknown>[],
  studentFees: StudentFee[],
): TuitionDataImportRow[] {
  if (rawRows.length === 0) throw new Error('ไฟล์ไม่มีข้อมูล');

  const feeByCode = new Map<string, StudentFee>();
  for (const fee of studentFees) {
    const code = fee.studentCode?.trim();
    if (code) feeByCode.set(code, fee);
  }

  const defaultDate = todayDateString();
  const maxDate = defaultDate;
  const runningPaid = new Map<string, number>();
  const runningScholarships = new Map<string, Scholarship[]>();

  return rawRows
    .map((row, index) => {
      const rowIndex = index + 2;
      const studentCode = pickValue(row, CODE_HEADERS);
      const prefix = pickValue(row, PREFIX_HEADERS);
      const firstName = pickValue(row, FIRST_NAME_HEADERS);
      const lastName = pickValue(row, LAST_NAME_HEADERS);
      const department = pickValue(row, DEPARTMENT_HEADERS);
      const gradeLevel = pickValue(row, GRADE_HEADERS);
      const paymentAmount = parseAmount(pickValue(row, AMOUNT_HEADERS));
      const paymentDate = parsePaymentDate(pickValue(row, DATE_HEADERS)) ?? defaultDate;
      const scholarshipType = pickValue(row, SCHOLARSHIP_HEADERS);
      const discountRaw = pickValue(row, DISCOUNT_HEADERS);
      const scholarship = buildScholarship(scholarshipType, discountRaw);
      const importName = buildFullName(prefix, firstName, lastName);

      if (!studentCode && !firstName && !lastName && paymentAmount <= 0 && !scholarship) {
        return {
          rowIndex,
          studentCode: '',
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount: 0,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship: null,
          studentFee: null,
          studentName: '',
          status: 'error' as const,
          message: 'แถวว่าง',
        };
      }

      if (!studentCode) {
        return {
          rowIndex,
          studentCode: '',
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship,
          studentFee: null,
          studentName: importName,
          status: 'error' as const,
          message: 'ไม่พบรหัสนักเรียน',
        };
      }

      const studentFee = feeByCode.get(studentCode) ?? null;
      if (!studentFee) {
        return {
          rowIndex,
          studentCode,
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship,
          studentFee: null,
          studentName: importName,
          status: 'error' as const,
          message: 'ไม่พบนักเรียนในรอบค่าเทอมนี้',
        };
      }

      if (paymentDate > maxDate) {
        return {
          rowIndex,
          studentCode,
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship,
          studentFee,
          studentName: studentFee.studentName,
          status: 'error' as const,
          message: 'วันที่จ่ายต้องไม่เกินวันนี้',
        };
      }

      const warnings: string[] = [];
      if (importName && studentFee.studentName && !studentFee.studentName.includes(firstName.trim()) && firstName.trim()) {
        warnings.push('ชื่อไม่ตรงกับในระบบ');
      }
      const parsedDept = resolveDepartment(department);
      if (department && parsedDept && parsedDept !== studentFee.departmentId) {
        warnings.push(`แผนกไม่ตรง (ในระบบ: ${departmentLabel(studentFee.departmentId)})`);
      }
      if (gradeLevel && studentFee.gradeLevel && gradeLevel !== studentFee.gradeLevel) {
        warnings.push(`ระดับชั้นไม่ตรง (ในระบบ: ${studentFee.gradeLevel})`);
      }
      if (scholarshipType && !scholarship) {
        warnings.push('รูปแบบส่วนลดไม่ถูกต้อง');
      }

      const baseScholarships = runningScholarships.get(studentFee.id) ?? studentFee.scholarships ?? [];
      const mergedScholarships = mergeScholarships(baseScholarships, scholarship);
      if (scholarship) {
        runningScholarships.set(studentFee.id, mergedScholarships);
      }

      const totals = recomputeStudentFeeTotals({
        feeItems: studentFee.feeItems,
        scholarships: mergedScholarships,
        installments: studentFee.installments,
      });
      const priorPaid = runningPaid.get(studentFee.id) ?? studentFee.totalPaid;

      if (paymentAmount > 0 && paymentAmount + priorPaid > totals.netPayable) {
        return {
          rowIndex,
          studentCode,
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship,
          studentFee,
          studentName: studentFee.studentName,
          status: 'error' as const,
          message: `ยอดชำระเกินค้างชำระ (ค้าง ${Math.max(totals.netPayable - priorPaid, 0).toLocaleString('th-TH')} บาท)`,
        };
      }

      if (paymentAmount > 0) {
        runningPaid.set(studentFee.id, priorPaid + paymentAmount);
      }

      if (!scholarship && paymentAmount <= 0) {
        return {
          rowIndex,
          studentCode,
          prefix,
          firstName,
          lastName,
          department,
          gradeLevel,
          paymentAmount,
          paymentDate,
          scholarshipType,
          discountRaw,
          scholarship: null,
          studentFee,
          studentName: studentFee.studentName,
          status: 'error' as const,
          message: 'ต้องระบุยอดเงินหรือทุน/ส่วนลด',
        };
      }

      const outstanding = Math.max(totals.netPayable - priorPaid, 0);
      const status =
        warnings.length > 0
          ? ('warning' as const)
          : paymentAmount > 0 && paymentAmount < outstanding
            ? ('warning' as const)
            : ('ready' as const);

      return {
        rowIndex,
        studentCode,
        prefix,
        firstName,
        lastName,
        department,
        gradeLevel,
        paymentAmount,
        paymentDate,
        scholarshipType,
        discountRaw,
        scholarship,
        studentFee,
        studentName: studentFee.studentName,
        status,
        message: warnings.length > 0 ? warnings.join(', ') : paymentAmount > 0 && paymentAmount < outstanding ? 'ชำระบางส่วน' : undefined,
      };
    })
    .filter((row) => row.message !== 'แถวว่าง');
}

export async function parseTuitionDataFile(
  file: File,
  studentFees: StudentFee[],
): Promise<TuitionDataImportRow[]> {
  const rawRows = await readRawRowsFromFile(file);
  return parseTuitionDataRows(rawRows, studentFees);
}

export async function parseTuitionDataGoogleSheet(
  sheetUrl: string,
  studentFees: StudentFee[],
): Promise<TuitionDataImportRow[]> {
  const rawRows = await fetchGoogleSheetRows(sheetUrl);
  return parseTuitionDataRows(rawRows, studentFees);
}

export async function downloadTuitionDataTemplate(): Promise<void> {
  const XLSX = await loadXlsx();
  const headers = [
    'รหัสนักเรียน',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'แผนก',
    'ระดับชั้น',
    'ยอดเงิน',
    'วันที่จ่าย',
    'ประเภททุน',
    'ส่วนลด',
  ];
  const sample = ['64001', 'เด็กชาย', 'วรชาติ', 'สบายดี', 'มัธยมศึกษา', 'ม.1', '5450', '2026-07-07', 'ทุนเรียนดี', '50%'];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'นำเข้าค่าเทอม');
  XLSX.writeFile(wb, 'tuition_import_template.xlsx');
}
