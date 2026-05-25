export type AccessLevel = 'view-only' | 'edit' | 'full';

export interface FeaturePermission {
  featureKey: string;
  label: string;
  category: string;
  enabled: boolean;
  accessLevel: AccessLevel;
}

export interface RolePermissionConfig {
  roleId: string;
  permissions: FeaturePermission[];
  permMap?: Record<string, string>; // { featureKey: accessLevel } — used by Firestore rules
  updatedAt: unknown;
}

export const FEATURE_LIST: FeaturePermission[] = [
  // ── การจัดการผู้ใช้ ──
  { featureKey: 'users',        label: 'จัดการผู้ใช้',         category: 'การจัดการผู้ใช้',         enabled: true, accessLevel: 'full' },
  { featureKey: 'roles',        label: 'กำหนดสิทธิ์',           category: 'การจัดการผู้ใช้',         enabled: true, accessLevel: 'full' },

  // ── ตั้งค่าระบบ ──
  { featureKey: 'logs',         label: 'บันทึกระบบ',            category: 'ตั้งค่าระบบ',             enabled: true, accessLevel: 'full' },
  { featureKey: 'settings',     label: 'ตั้งค่าทั่วไป',         category: 'ตั้งค่าระบบ',             enabled: true, accessLevel: 'full' },

  // ── หลักสูตรและการสอน ──
  { featureKey: 'curriculum',   label: 'จัดการหลักสูตร',        category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'full' },
  { featureKey: 'lessonPlan',   label: 'แผนการจัดการเรียนรู้',  category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'full' },
  { featureKey: 'teaching',     label: 'จัดการการสอน',          category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'full' },

  // ── การจัดการข้อมูลพื้นฐาน ──
  { featureKey: 'teachers',     label: 'จัดการครู',             category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },
  { featureKey: 'classes',      label: 'จัดการชั้นเรียน',       category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },
  { featureKey: 'students',     label: 'จัดการนักเรียน',        category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },

  // ── ตารางสอน ──
  { featureKey: 'schedule',     label: 'ตารางสอน',              category: 'ตารางสอน',               enabled: true, accessLevel: 'full' },
  { featureKey: 'calendar',     label: 'ปฏิทินการศึกษา',       category: 'ตารางสอน',               enabled: true, accessLevel: 'full' },

  // ── เกรดและการเข้าเรียน ──
  { featureKey: 'attendance',      label: 'เช็กชื่อนักเรียน',      category: 'เกรดและการเข้าเรียน',    enabled: true, accessLevel: 'full' },
  { featureKey: 'morningRollCall', label: 'เช็คชื่อเข้าแถว',       category: 'เกรดและการเข้าเรียน',    enabled: true, accessLevel: 'full' },
  { featureKey: 'staffAttendance', label: 'ลงเวลาทำงานบุคลากร',   category: 'เกรดและการเข้าเรียน',    enabled: true, accessLevel: 'full' },

  // ── สอบและประเมินผล ──
  { featureKey: 'exams',        label: 'ห้องสอบออนไลน์',       category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },
  { featureKey: 'questionBank', label: 'คลังข้อสอบ',           category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },
  { featureKey: 'grades',       label: 'สมุดคะแนน/ตัดเกรด',   category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },

  // ── การลา ──
  { featureKey: 'leave', label: 'การลา', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'edit' },
  { featureKey: 'feedback', label: 'PMV Voice (เสียงของนักเรียน)', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'feedback_manage', label: 'จัดการสถานะ PMV Voice', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'edit' },
  { featureKey: 'feedback_view_identity', label: 'ดูชื่อผู้ส่ง PMV Voice', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'view-only' },

  // ── ครูเวร ──
  { featureKey: 'dutySchedule', label: 'ตารางครูเวร', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'edit' },
  { featureKey: 'reports', label: 'รายงานผู้บริหาร', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'view-only' },

  // ── เมนู ──
  { featureKey: 'announcements',label: 'ประกาศ',                category: 'เมนู',                   enabled: true, accessLevel: 'edit' },
  { featureKey: 'widget_announcements',   label: 'วิดเจ็ตประกาศข่าวสาร',      category: 'เมนู',           enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_feedbackStatus',  label: 'วิดเจ็ตสถานะ PMV Voice',     category: 'เมนู',           enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_leave',           label: 'วิดเจ็ตคำขอลา',        category: 'เมนู',           enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_leaveQuota',      label: 'วิดเจ็ตโควต้าการลา',    category: 'เมนู',           enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_staffAttendance', label: 'วิดเจ็ตลงเวลาทำงาน', category: 'เมนู',           enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_calendar',        label: 'วิดเจ็ตกิจกรรมล่าสุด',  category: 'เมนู',           enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_studentProfile',  label: 'วิดเจ็ตข้อมูลส่วนตัว',  category: 'เมนู',           enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_attendance',             label: 'วิดเจ็ตการเช็กชื่อ',          category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_morningRollCall',        label: 'วิดเจ็ตเช็คชื่อเข้าแถว (ครู)',  category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_morningRollCallSummary', label: 'วิดเจ็ตสรุปเช็คชื่อเข้าแถว (ผู้บริหาร)', category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_dailyAttendanceSummary', label: 'วิดเจ็ตสรุปการเข้างานรายวัน', category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_teacherLiveStatus',      label: 'วิดเจ็ตสถานะครูกำลังสอน/พัก',  category: 'เมนู', enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_studentSummary',         label: 'วิดเจ็ตสรุปจำนวนนักเรียน',    category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_studentLeave',           label: 'วิดเจ็ตยื่นคำลา (นักเรียน)',    category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_studentExamScore',       label: 'วิดเจ็ตผลการสอบของนักเรียน',   category: 'เมนู', enabled: false, accessLevel: 'view-only' },
];
