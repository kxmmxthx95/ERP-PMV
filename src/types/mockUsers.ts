import type { UserData } from '@/types/user';

export const MOCK_USERS: UserData[] = [
  { id: 'U001', name: 'สมชาย ใจเรียน', email: 'somchai@school.ac.th', role: 'student', status: 'active', lastLogin: '10 นาทีที่แล้ว', department: 'secondary' },
  { id: 'U002', name: 'สมหญิง รักดี', email: 'somying@school.ac.th', role: 'student', status: 'active', lastLogin: '1 ชั่วโมงที่แล้ว', department: 'primary' },
  { id: 'U003', name: 'ครูมาลี สอนดี', email: 'malee@school.ac.th', role: 'teacher', status: 'active', lastLogin: 'เมื่อวาน 08:30', department: 'early-childhood' },
  { id: 'U004', name: 'นายสมเกียรติ ยืนยง', email: 'somkiat@gmail.com', role: 'parent', status: 'active', lastLogin: '2 วันที่แล้ว', department: 'secondary' },
  { id: 'U005', name: 'เจ้าหน้าที่ สมบูรณ์', email: 'staff1@school.ac.th', role: 'staff', status: 'inactive', lastLogin: '3 เดือนที่แล้ว', department: 'secondary' },
  { id: 'U006', name: 'แอดมิน ระบบ', email: 'admin@school.ac.th', role: 'sysadmin', status: 'active', lastLogin: 'กำลังออนไลน์', department: 'secondary' },
];

export const ROLE_LABELS: Record<string, { label: string, color: string, bg: string }> = {
  student: { label: 'นักเรียน', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  parent: { label: 'ผู้ปกครอง', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  teacher: { label: 'ครูผู้สอน', color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  staff: { label: 'เจ้าหน้าที่', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  admin: { label: 'ผู้บริหาร', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  sysadmin: { label: 'SysAdmin', color: '#475569', bg: 'rgba(71,85,105,0.1)' },
};