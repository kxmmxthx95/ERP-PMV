import * as XLSX from 'xlsx';
import { gradeLetterToGpa, formatGpa } from '@/types/grades';
import type { StudentScoreSummary } from '@/types/grades';

interface ExportGradeExcelParams {
  semester: number;
  academicYear: string;
  className: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  summaries: StudentScoreSummary[];
}

export function exportGradeExcel({
  semester, academicYear, className, subjectCode, subjectName, credits, summaries,
}: ExportGradeExcelParams) {
  const header = ['ลำดับ', 'เลขประจำตัวนักเรียน', 'ชื่อ-สกุล', 'คะแนนรวม(100)', 'ผลการเรียน'];

  const rows = summaries.map((s, i) => [
    i + 1,
    s.studentCode || '',
    s.studentName,
    s.totalScore !== null ? Math.round(s.totalScore) : '',
    s.grade !== null ? formatGpa(gradeLetterToGpa(s.grade)) : '',
  ]);

  const aoa = [
    [`ภาคเรียนที่ ${semester}  ปีการศึกษา ${academicYear}`],
    [`ชั้นเรียน ${className}`],
    [`รหัสวิชา : ${subjectCode} : ${subjectName} (${credits} หน่วยกิต)`],
    [],
    header,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
  ];
  ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 32 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'คะแนนรวม');
  XLSX.writeFile(wb, `คะแนนรวม_${className}_${subjectCode || subjectName}.xlsx`);
}
