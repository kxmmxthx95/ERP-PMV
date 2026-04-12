// ── Role ─────────────────────────────────────────────────────────────────────

export type AppRole = 'student' | 'parent' | 'teacher' | 'staff' | 'admin' | 'sysadmin';

export const ALL_ROLES: AppRole[] = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'];

export const ROLE_META: Record<AppRole, {
  label: string;
  labelEn: string;
  description: string;
  color: string;
  bg: string;
  gradient: string;
  portalPath: string;
}> = {
  student: {
    label: 'นักเรียน',
    labelEn: 'Student',
    description: 'ดูเกรด ตารางเรียน และรับแจ้งเตือน',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.10)',
    gradient: 'from-sky-400 to-cyan-500',
    portalPath: '/student',
  },
  parent: {
    label: 'ผู้ปกครอง',
    labelEn: 'Parent',
    description: 'ติดตามข้อมูลบุตรหลาน เกรด และการเข้าเรียน',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.10)',
    gradient: 'from-purple-400 to-violet-500',
    portalPath: '/parent',
  },
  teacher: {
    label: 'ครูผู้สอน',
    labelEn: 'Teacher',
    description: 'สร้างแผนการสอน บันทึกเกรด และการเข้าเรียน',
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.10)',
    gradient: 'from-rose-400 to-pink-500',
    portalPath: '/teacher',
  },
  staff: {
    label: 'เจ้าหน้าที่',
    labelEn: 'Staff',
    description: 'จัดการเอกสาร ดูตารางงาน และรายชื่อนักเรียน',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    gradient: 'from-emerald-400 to-teal-500',
    portalPath: '/staff',
  },
  admin: {
    label: 'ผู้ดูแลระบบ',
    labelEn: 'Admin',
    description: 'บริหารโรงเรียน ดูรายงาน อนุมัติแผนการสอน',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    gradient: 'from-sky-400 to-blue-500',
    portalPath: '/admin',
  },
  sysadmin: {
    label: 'System Admin',
    labelEn: 'SysAdmin',
    description: 'ควบคุมระบบทั้งหมด ตั้งค่าปีการศึกษา จัดการผู้ใช้',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.10)',
    gradient: 'from-violet-400 to-indigo-500',
    portalPath: '/sysadmin',
  },
};

// ── Permission ────────────────────────────────────────────────────────────────

/** ระดับสิทธิ์: full | partial | none */
export type AccessLevel = 'full' | 'partial' | 'none';

export interface FeaturePermission {
  featureId: string;
  access: AccessLevel;
}

export interface Feature {
  id: string;
  label: string;
  category: 'academic' | 'management' | 'system' | 'communication';
  description?: string;
}

export const FEATURE_CATEGORIES: Record<Feature['category'], { label: string; color: string }> = {
  academic:      { label: 'วิชาการ',      color: '#3b82f6' },
  management:    { label: 'การจัดการ',   color: '#f59e0b' },
  system:        { label: 'ระบบ',         color: '#8b5cf6' },
  communication: { label: 'การสื่อสาร',  color: '#10b981' },
};

export const FEATURES: Feature[] = [
  // Academic
  { id: 'view_own_grades',    label: 'ดูเกรดตัวเอง',         category: 'academic' },
  { id: 'input_grades',       label: 'กรอกเกรดนักเรียน',     category: 'academic' },
  { id: 'record_attendance',  label: 'บันทึกการเข้าเรียน',   category: 'academic' },
  { id: 'view_schedule',      label: 'ดูตารางสอน/ตารางเรียน', category: 'academic' },
  { id: 'create_syllabus',    label: 'สร้างแผนการสอน',       category: 'academic' },
  { id: 'approve_syllabus',   label: 'อนุมัติแผนการสอน',     category: 'academic' },
  { id: 'manage_curriculum',  label: 'จัดการหลักสูตร',       category: 'academic' },
  // Management
  { id: 'manage_teachers',    label: 'จัดการครู',             category: 'management' },
  { id: 'manage_students',    label: 'จัดการนักเรียน',        category: 'management' },
  { id: 'manage_classes',     label: 'จัดการห้องเรียน',       category: 'management' },
  { id: 'manage_schedule',    label: 'จัดการตารางสอน',        category: 'management' },
  { id: 'view_reports',       label: 'ดูรายงานสรุป',          category: 'management' },
  // System
  { id: 'manage_users',       label: 'จัดการผู้ใช้งาน',       category: 'system' },
  { id: 'manage_roles',       label: 'กำหนดสิทธิ์',           category: 'system' },
  { id: 'system_settings',    label: 'ตั้งค่าระบบ',           category: 'system' },
  { id: 'view_logs',          label: 'ดูบันทึกระบบ',          category: 'system' },
  // Communication
  { id: 'view_notifications', label: 'รับการแจ้งเตือน',       category: 'communication' },
  { id: 'send_announcements', label: 'ส่งประกาศ',             category: 'communication' },
  { id: 'view_calendar',      label: 'ดูปฏิทินการศึกษา',      category: 'communication' },
  { id: 'manage_calendar',    label: 'จัดการปฏิทินการศึกษา',  category: 'communication' },
];

// ── Default Permission Matrix ─────────────────────────────────────────────────
// สอดคล้องกับ Feature Access Matrix ใน CLAUDE.md

export type PermissionMatrix = Record<AppRole, Record<string, AccessLevel>>;

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  student: {
    view_own_grades:    'full',
    input_grades:       'none',
    record_attendance:  'none',
    view_schedule:      'full',
    create_syllabus:    'none',
    approve_syllabus:   'none',
    manage_curriculum:  'none',
    manage_teachers:    'none',
    manage_students:    'none',
    manage_classes:     'none',
    manage_schedule:    'none',
    view_reports:       'none',
    manage_users:       'none',
    manage_roles:       'none',
    system_settings:    'none',
    view_logs:          'none',
    view_notifications: 'full',
    send_announcements: 'none',
    view_calendar:      'full',
    manage_calendar:    'none',
  },
  parent: {
    view_own_grades:    'full',
    input_grades:       'none',
    record_attendance:  'none',
    view_schedule:      'full',
    create_syllabus:    'none',
    approve_syllabus:   'none',
    manage_curriculum:  'none',
    manage_teachers:    'none',
    manage_students:    'none',
    manage_classes:     'none',
    manage_schedule:    'none',
    view_reports:       'none',
    manage_users:       'none',
    manage_roles:       'none',
    system_settings:    'none',
    view_logs:          'none',
    view_notifications: 'full',
    send_announcements: 'none',
    view_calendar:      'full',
    manage_calendar:    'none',
  },
  teacher: {
    view_own_grades:    'none',
    input_grades:       'full',
    record_attendance:  'full',
    view_schedule:      'full',
    create_syllabus:    'full',
    approve_syllabus:   'none',
    manage_curriculum:  'none',
    manage_teachers:    'none',
    manage_students:    'partial',
    manage_classes:     'none',
    manage_schedule:    'none',
    view_reports:       'partial',
    manage_users:       'none',
    manage_roles:       'none',
    system_settings:    'none',
    view_logs:          'none',
    view_notifications: 'full',
    send_announcements: 'none',
    view_calendar:      'full',
    manage_calendar:    'none',
  },
  staff: {
    view_own_grades:    'none',
    input_grades:       'partial',
    record_attendance:  'none',
    view_schedule:      'full',
    create_syllabus:    'none',
    approve_syllabus:   'none',
    manage_curriculum:  'none',
    manage_teachers:    'none',
    manage_students:    'partial',
    manage_classes:     'none',
    manage_schedule:    'none',
    view_reports:       'partial',
    manage_users:       'none',
    manage_roles:       'none',
    system_settings:    'none',
    view_logs:          'none',
    view_notifications: 'full',
    send_announcements: 'none',
    view_calendar:      'full',
    manage_calendar:    'none',
  },
  admin: {
    view_own_grades:    'none',
    input_grades:       'none',
    record_attendance:  'none',
    view_schedule:      'full',
    create_syllabus:    'none',
    approve_syllabus:   'full',
    manage_curriculum:  'partial',
    manage_teachers:    'full',
    manage_students:    'full',
    manage_classes:     'full',
    manage_schedule:    'partial',
    view_reports:       'full',
    manage_users:       'none',
    manage_roles:       'none',
    system_settings:    'none',
    view_logs:          'partial',
    view_notifications: 'full',
    send_announcements: 'full',
    view_calendar:      'full',
    manage_calendar:    'partial',
  },
  sysadmin: {
    view_own_grades:    'full',
    input_grades:       'full',
    record_attendance:  'full',
    view_schedule:      'full',
    create_syllabus:    'full',
    approve_syllabus:   'full',
    manage_curriculum:  'full',
    manage_teachers:    'full',
    manage_students:    'full',
    manage_classes:     'full',
    manage_schedule:    'full',
    view_reports:       'full',
    manage_users:       'full',
    manage_roles:       'full',
    system_settings:    'full',
    view_logs:          'full',
    view_notifications: 'full',
    send_announcements: 'full',
    view_calendar:      'full',
    manage_calendar:    'full',
  },
};
