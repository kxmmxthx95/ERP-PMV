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
  updatedAt: any;
}

export const FEATURE_LIST: FeaturePermission[] = [
  // ── การจัดการผู้ใช้ ──
  { featureKey: 'users', label: 'จัดการผู้ใช้', category: 'การจัดการผู้ใช้', enabled: true, accessLevel: 'full' },
  { featureKey: 'pending_users', label: 'อนุมัติบัญชีใหม่', category: 'การจัดการผู้ใช้', enabled: true, accessLevel: 'full' },
  { featureKey: 'roles', label: 'กำหนดสิทธิ์', category: 'การจัดการผู้ใช้', enabled: true, accessLevel: 'full' },

  // ── ตั้งค่าระบบ ──
  { featureKey: 'structure', label: 'จัดการโครงสร้างระบบ', category: 'ตั้งค่าระบบ', enabled: true, accessLevel: 'full' },
  { featureKey: 'logs', label: 'บันทึกระบบ', category: 'ตั้งค่าระบบ', enabled: true, accessLevel: 'full' },
  { featureKey: 'settings', label: 'ตั้งค่าทั่วไป', category: 'ตั้งค่าระบบ', enabled: true, accessLevel: 'full' },

  // ── หลักสูตรและการสอน ──
  { featureKey: 'curriculum', label: 'จัดการหลักสูตร', category: 'หลักสูตรและการสอน', enabled: true, accessLevel: 'full' },
  { featureKey: 'syllabus', label: 'แผนการสอน', category: 'หลักสูตรและการสอน', enabled: true, accessLevel: 'full' },

  // ── การจัดการข้อมูลพื้นฐาน ──
  { featureKey: 'teachers', label: 'จัดการครู', category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },
  { featureKey: 'classes', label: 'จัดการชั้นเรียน', category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },
  { featureKey: 'students', label: 'จัดการนักเรียน', category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },
  { featureKey: 'staff', label: 'จัดการเจ้าหน้าที่', category: 'การจัดการข้อมูลพื้นฐาน', enabled: true, accessLevel: 'full' },

  // ── ตารางสอน ──
  { featureKey: 'schedule', label: 'ตารางสอน', category: 'ตารางสอน', enabled: true, accessLevel: 'full' },

  // ── เกรดและการเข้าเรียน ──
  { featureKey: 'grades', label: 'จัดการคะแนน', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'full' },
  { featureKey: 'attendance', label: 'บันทึกการเข้าเรียน', category: 'เกรดและการเข้าเรียน', enabled: true, accessLevel: 'full' },

  // ── อื่นๆ ──
  { featureKey: 'calendar', label: 'ปฏิทินการศึกษา', category: 'อื่นๆ', enabled: true, accessLevel: 'full' },
  { featureKey: 'reports', label: 'รายงาน', category: 'อื่นๆ', enabled: true, accessLevel: 'view-only' },
  { featureKey: 'announcements', label: 'ประกาศ', category: 'อื่นๆ', enabled: true, accessLevel: 'edit' },
  { featureKey: 'documents', label: 'เอกสาร', category: 'อื่นๆ', enabled: true, accessLevel: 'edit' },
];
