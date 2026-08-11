import * as XLSX from 'xlsx';
import type { StudentCard } from '@/types/student';

function toThaiDate(birthDate?: string): string {
  if (!birthDate) return '';
  const [y, m, d] = birthDate.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${Number(y) + 543}`;
}

export function exportStudentsToExcel(cards: StudentCard[]) {
  const rows = cards.map(({ student: s }) => ({
    'รหัสนักเรียน': s.studentCode ?? '',
    'คำนำหน้า': s.prefix ?? '',
    'ชื่อ': s.firstName ?? '',
    'นามสกุล': s.lastName ?? '',
    'วันเดือนปีเกิด': toThaiDate(s.birthDate),
    'เลขประจำตัวประชาชน': s.nationalId ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน');
  XLSX.writeFile(wb, `รายชื่อนักเรียน_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
