/** Path → Thai title for portal header breadcrumb (mirrors HomePage menu titles). */
const PORTAL_PAGE_TITLES: ReadonlyArray<{ path: string; title: string }> = [
  { path: '/portal/users', title: 'จัดการผู้ใช้' },
  { path: '/portal/teachers', title: 'จัดการครู' },
  { path: '/portal/students', title: 'จัดการนักเรียน' },
  { path: '/portal/classes', title: 'ระบบจัดการห้องเรียน' },
  { path: '/portal/roles', title: 'กำหนดสิทธิ์' },
  { path: '/portal/curriculum', title: 'หลักสูตร' },
  { path: '/portal/schedule', title: 'ตารางสอน' },
  { path: '/portal/calendar', title: 'ปฏิทินการศึกษา' },
  { path: '/portal/attendance', title: 'การเข้าเรียน' },
  { path: '/portal/morning-rollcall', title: 'เช็คชื่อเข้าแถว' },
  { path: '/portal/staff-attendance', title: 'ลงเวลาทำงาน' },
  { path: '/portal/fingerprint-devices', title: 'เครื่องสแกน' },
  { path: '/portal/teacher-kpi', title: 'ประเมิน KPI ครู' },
  { path: '/portal/leave', title: 'การลา' },
  { path: '/portal/duty-schedule', title: 'ครูเวร' },
  { path: '/portal/report-control', title: 'Report Control Center' },
  { path: '/portal/announcements', title: 'ประกาศ' },
  { path: '/portal/feedback', title: 'PMV Voice' },
  { path: '/portal/behavior', title: 'คะแนนพฤติกรรม' },
  { path: '/portal/exams', title: 'ห้องสอบออนไลน์' },
  { path: '/portal/question-bank', title: 'คลังข้อสอบ' },
  { path: '/portal/ai-agents', title: 'AI Agent' },
  { path: '/portal/grades', title: 'สมุดคะแนน' },
  { path: '/portal/student-analytics', title: 'วิเคราะห์ผู้เรียน' },
  { path: '/portal/future-plan', title: 'แผนการศึกษาต่อ' },
  { path: '/portal/tasks', title: 'มอบหมายงาน' },
  { path: '/portal/settings', title: 'การตั้งค่า' },
  { path: '/portal/micro-syllabus', title: 'แผนการสอน' },
  { path: '/portal/tuition', title: 'จัดการค่าเทอม' },
  { path: '/portal/courses', title: 'คอร์สออนไลน์' },
  { path: '/portal/profile', title: 'ข้อมูลส่วนตัว' },
  { path: '/portal/logs', title: 'บันทึกระบบ' },
  { path: '/portal/migrate', title: 'ย้ายข้อมูล' },
];

export function resolvePortalPageTitle(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/portal';
  if (path === '/portal') return null;
  const hit = PORTAL_PAGE_TITLES
    .filter((p) => path === p.path || path.startsWith(`${p.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit?.title ?? null;
}
