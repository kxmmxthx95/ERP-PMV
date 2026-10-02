import { loadXlsx } from '@/lib/lazyXlsx';
import type { StudentCard } from '@/types/student';

const GRADE_PREFIX_ORDER = ['อ', 'ป', 'ม'];

export function compareGradeLevel(a: string, b: string): number {
  const pa = GRADE_PREFIX_ORDER.indexOf(a.charAt(0));
  const pb = GRADE_PREFIX_ORDER.indexOf(b.charAt(0));
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b, undefined, { numeric: true });
}

function toThaiDate(birthDate?: string): string {
  if (!birthDate) return '';
  const [y, m, d] = birthDate.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${Number(y) + 543}`;
}

/** 1 ชีตต่อ 1 ระดับชั้น เรียงตามห้องแล้วรหัสนักเรียน (ระบบยังไม่เก็บเลขที่) */
export async function exportStudentsByGrade(cards: StudentCard[], grades: string[], year: string) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  [...grades].sort(compareGradeLevel).forEach((grade) => {
    const rows = cards
      .filter((c) => c.currentGrade === grade)
      .sort(
        (a, b) =>
          (a.currentClass ?? '').localeCompare(b.currentClass ?? '', undefined, { numeric: true }) ||
          (a.student.studentCode ?? '').localeCompare(b.student.studentCode ?? '', undefined, { numeric: true }),
      )
      .map(({ student: s, currentClass }) => ({
        'ห้อง': currentClass ?? '',
        'รหัสนักเรียน': s.studentCode ?? '',
        'คำนำหน้า': s.prefix ?? '',
        'ชื่อ': s.firstName ?? '',
        'นามสกุล': s.lastName ?? '',
        'เพศ': s.gender === 'male' ? 'ชาย' : s.gender === 'female' ? 'หญิง' : '',
        'วันเดือนปีเกิด': toThaiDate(s.birthDate),
        'เลขประจำตัวประชาชน': s.nationalId ?? '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), grade.replace(/[\\/?*[\]:]/g, '-'));
  });

  XLSX.writeFile(wb, `รายชื่อนักเรียน_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
