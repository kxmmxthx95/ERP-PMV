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
  { featureKey: 'lessonPlan',    label: 'แผนการจัดการเรียนรู้',  category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'full' },
  { featureKey: 'microSyllabus', label: 'แผนการสอน',             category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'edit' },
  { featureKey: 'teaching',      label: 'จัดการการสอน',          category: 'หลักสูตรและการสอน',       enabled: true, accessLevel: 'full' },

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
  { featureKey: 'fingerprintDevices', label: 'จัดการเครื่องสแกน', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'full' },

  // ── สอบและประเมินผล ──
  { featureKey: 'exams',        label: 'ห้องสอบออนไลน์',       category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },
  { featureKey: 'questionBank', label: 'คลังข้อสอบ',           category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },
  { featureKey: 'aiAgents',     label: 'AI Agent Command',      category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'view-only' },
  { featureKey: 'grades',       label: 'สมุดคะแนน/ตัดเกรด',   category: 'สอบและประเมินผล',         enabled: true, accessLevel: 'full' },

  // ── การลา ──
  { featureKey: 'leave', label: 'การลา', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'edit' },
  { featureKey: 'feedback', label: 'PMV Voice (เสียงของนักเรียน)', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'feedback_manage', label: 'จัดการสถานะ PMV Voice', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'edit' },
  { featureKey: 'feedback_view_identity', label: 'ดูชื่อผู้ส่ง PMV Voice', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'behaviorScore', label: 'คะแนนพฤติกรรม', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'edit' },

  // ── ครูเวร ──
  { featureKey: 'dutySchedule', label: 'ตารางครูเวร', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'edit' },
  { featureKey: 'reports', label: 'รายงานผู้บริหาร', category: 'เกรดและการเข้าเรียน', enabled: false, accessLevel: 'view-only' },

  // ── การศึกษาต่อ ──
  { featureKey: 'futurePlan', label: 'วิเคราะห์การศึกษาต่อ', category: 'ข้อมูลนักเรียน', enabled: true, accessLevel: 'edit' },

  // ── เกม ──
  { featureKey: 'wordGame', label: 'เกมทายคำ Multiplayer', category: 'เมนู', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'widget_wordGame', label: 'วิดเจ็ตเกมทายคำ', category: 'วิดเจ็ต', enabled: true, accessLevel: 'view-only' },

  // ── มอบหมายงาน ──
  { featureKey: 'tasks',         label: 'มอบหมายงาน',           category: 'เมนู',                   enabled: true, accessLevel: 'edit' },
  { featureKey: 'widget_tasks',  label: 'วิดเจ็ตงานที่ได้รับ',  category: 'วิดเจ็ต',                 enabled: false, accessLevel: 'view-only' },

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
  { featureKey: 'widget_schedule',               label: 'วิดเจ็ตตารางสอน',             category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_morningRollCall',        label: 'วิดเจ็ตเช็คชื่อเข้าแถว',  category: 'วิดเจ็ต', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'widget_teacherDailyTasks',      label: 'วิดเจ็ตงานประจำวันครู',    category: 'วิดเจ็ต', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'widget_morningRollCallSummary', label: 'วิดเจ็ตสรุปเช็คชื่อเข้าแถว (ผู้บริหาร)', category: 'วิดเจ็ต', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_dailyAttendanceSummary', label: 'วิดเจ็ตสรุปการเข้างานรายวัน', category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_teacherLiveStatus',      label: 'วิดเจ็ตสถานะครูกำลังสอน/พัก',  category: 'เมนู', enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_studentSummary',         label: 'วิดเจ็ตสรุปจำนวนนักเรียน',    category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_studentLeave',           label: 'วิดเจ็ตยื่นคำลา (นักเรียน)',    category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_studentExamScore',       label: 'วิดเจ็ตผลการสอบของนักเรียน',   category: 'เมนู', enabled: false, accessLevel: 'view-only' },
  { featureKey: 'widget_futurePlan',             label: 'วิดเจ็ตแผนการศึกษาต่อ',         category: 'เมนู', enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_horoscope',              label: 'วิดเจ็ตดวงรายวัน',              category: 'วิดเจ็ต', enabled: true,  accessLevel: 'view-only' },
  { featureKey: 'widget_behaviorScore',          label: 'วิดเจ็ตบันทึกคะแนนพฤติกรรม',     category: 'วิดเจ็ต', enabled: true,  accessLevel: 'edit' },
];

export const SYSADMIN_EMAIL = 'sysadmin@pmv.com';

/** สิทธิ์เต็มสำหรับ sysadmin — ไม่ต้องโหลด role_permissions จาก Firestore */
export function buildSysadminPermissionView(): {
  permissions: FeaturePermission[];
  permMap: Record<string, AccessLevel>;
} {
  const permissions = FEATURE_LIST.map((f) => ({
    ...f,
    enabled: true,
    accessLevel: 'full' as const,
  }));
  const permMap = Object.fromEntries(
    FEATURE_LIST.map((f) => [f.featureKey, 'full' as const]),
  ) as Record<string, AccessLevel>;
  return { permissions, permMap };
}

/** sysadmin ยังเข้าเมนูได้ครบ แต่ widget ที่ปิดใน role_permissions ต้องไม่แสดงบน Dashboard */
export function applySysadminWidgetOverrides(
  base: ReturnType<typeof buildSysadminPermissionView>,
  firestoreConfig: RolePermissionConfig | null | undefined,
): ReturnType<typeof buildSysadminPermissionView> {
  if (!firestoreConfig?.permissions?.length) return base;

  const nextPermMap = { ...base.permMap };
  const nextPermissions = base.permissions.map((permission) => ({ ...permission }));

  for (const stored of firestoreConfig.permissions) {
    if (!stored.featureKey.startsWith('widget_')) continue;

    const idx = nextPermissions.findIndex((p) => p.featureKey === stored.featureKey);
    if (idx >= 0) {
      nextPermissions[idx] = {
        ...nextPermissions[idx],
        enabled: stored.enabled,
        accessLevel: stored.accessLevel,
      };
    }

    if (stored.enabled) {
      nextPermMap[stored.featureKey] = stored.accessLevel;
    } else {
      delete nextPermMap[stored.featureKey];
    }
  }

  return { permissions: nextPermissions, permMap: nextPermMap };
}

/** รวม role จากหลายแหล่ง — ไม่ downgrade sysadmin หลัง profile fetch */
export function resolveEffectiveRole(
  user: { email: string | null },
  ...candidates: (string | null | undefined)[]
): string {
  if (user.email === SYSADMIN_EMAIL) return 'sysadmin';
  for (const c of candidates) {
    if (c === 'sysadmin') return 'sysadmin';
  }
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return 'student';
}
