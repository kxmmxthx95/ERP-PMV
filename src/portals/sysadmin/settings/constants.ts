import type { AcademicYear, SettingsTab } from './types';
import { CalendarDays, Settings2, BookOpen, Bell, Shield, Upload, Database, HardDrive } from 'lucide-react';

// ── Initial Academic Years ────────────────────────────────────────────────────
export const INITIAL_ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: '1',
    year: '2567',
    label: 'ปีการศึกษา 2567',
    startDate: '2024-05-16',
    endDate: '2025-03-31',
    isActive: true,
    termCount: 2,
    activeSemester: 2,
  },
  {
    id: '2',
    year: '2566',
    label: 'ปีการศึกษา 2566',
    startDate: '2023-05-16',
    endDate: '2024-03-31',
    isActive: false,
    termCount: 2,
    activeSemester: 2,
  },
];

// ── Settings Tabs ─────────────────────────────────────────────────────────────
export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'academic-year', label: 'ปีการศึกษา',    icon: CalendarDays },
  { id: 'general',       label: 'ทั่วไป',        icon: Settings2 },
  { id: 'curriculum',    label: 'หลักสูตร',      icon: BookOpen },
  { id: 'notification',  label: 'การแจ้งเตือน',  icon: Bell },
  { id: 'security',      label: 'ความปลอดภัย',       icon: Shield },
  { id: 'firestore-rules', label: 'Firestore Rules', icon: Database },
  { id: 'import',        label: 'นำเข้าข้อมูล',    icon: Upload },
  { id: 'backup',        label: 'สำรองข้อมูล',     icon: HardDrive },
];

// ── Tailwind Styles ───────────────────────────────────────────────────────────
export const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};
