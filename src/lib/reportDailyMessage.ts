export interface StaffSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  pending?: number;
  lateNames?: string[];
  pendingNames?: string[];
}

export interface StudentRollCallEntry {
  name: string;
  className: string;
}

export interface StudentSummary {
  sessions: number;
  classes: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  absentStudents?: StudentRollCallEntry[];
  leaveStudents?: StudentRollCallEntry[];
}

const LINE_TEXT_MAX = 4800;

function formatThaiDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatNameLines(
  title: string,
  names: string[],
  emptyLabel: string,
  maxItems = 20,
): string[] {
  if (names.length === 0) {
    return [`  ${title}: ${emptyLabel}`];
  }
  const shown = names.slice(0, maxItems);
  const lines = shown.map((name) => `    • ${name}`);
  if (names.length > maxItems) {
    lines.push(`    … และอีก ${names.length - maxItems} คน`);
  }
  return [`  ${title}:`, ...lines];
}

function formatStudentLines(
  title: string,
  students: StudentRollCallEntry[],
  emptyLabel: string,
  maxItems = 25,
): string[] {
  if (students.length === 0) {
    return [`  ${title}: ${emptyLabel}`];
  }
  const shown = students.slice(0, maxItems);
  const lines = shown.map((s) => `    • ${s.name} (${s.className})`);
  if (students.length > maxItems) {
    lines.push(`    … และอีก ${students.length - maxItems} คน`);
  }
  return [`  ${title}:`, ...lines];
}

function clampMessage(lines: string[]): string {
  const text = lines.join('\n');
  if (text.length <= LINE_TEXT_MAX) return text;
  return `${text.slice(0, LINE_TEXT_MAX - 20).trimEnd()}\n\n… (ข้อความยาวเกินไป)`;
}

export function buildDailyReportMessage(
  date: string,
  staff: StaffSummary,
  student: StudentSummary,
): string {
  const thaiDate = formatThaiDate(date);
  const absentPercent =
    staff.total > 0 ? Math.round((staff.absent / staff.total) * 100) : 0;
  const lateNames = staff.lateNames ?? [];
  const pendingNames = staff.pendingNames ?? [];
  const absentStudents = student.absentStudents ?? [];
  const leaveStudents = student.leaveStudents ?? [];

  const lines = [
    '📊 รายงานประจำวัน',
    `${thaiDate}`,
    '',
    `👨‍🏫 บุคลากร (${staff.total} คน)`,
    `  ✅ มาปกติ: ${staff.present} คน`,
    `  ⏰ มาสาย: ${staff.late} คน`,
    ...formatNameLines('รายชื่อมาสาย', lateNames, '—'),
    `  ❌ ขาด: ${staff.absent} คน (${absentPercent}%)`,
    `  📝 ลา: ${staff.leave} คน`,
    ...(staff.pending ?? 0) > 0
      ? [`  ⏳ รอเช็ก: ${staff.pending} คน`, ...formatNameLines('รายชื่อรอเช็ก', pendingNames, '—')]
      : [],
    '',
    '🎓 นักเรียน',
    `  🏫 เช็คชื่อเข้าแถวแล้ว: ${student.classes} ห้อง`,
    `  ✅ เข้าเรียน: ${student.present} คน`,
    `  ⏰ มาสาย: ${student.late} คน`,
    `  ❌ ขาด: ${student.absent} คน`,
    ...formatStudentLines('รายชื่อขาดเรียน', absentStudents, '—'),
    `  📝 ลา: ${student.leave} คน`,
    ...formatStudentLines('รายชื่อลา', leaveStudents, '—'),
    '',
    '🔗 ระบบบริหารโรงเรียน PMV-ONE',
  ];

  return clampMessage(lines);
}
