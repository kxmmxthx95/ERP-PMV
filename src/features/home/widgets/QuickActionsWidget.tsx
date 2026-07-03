import { useNavigate } from 'react-router-dom';
import { QrCode, FileText, CalendarCheck, BarChart2 } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';
import { useAuth } from '@/hooks/useAuth';

const ACTIONS_BY_ROLE: Record<string, { label: string; icon: any; path: string; color: string }[]> = {
  teacher: [
    { label: 'เช็กชื่อ', icon: QrCode, path: '/portal/attendance', color: '#10b981' },
    { label: 'กรอกคะแนน', icon: BarChart2, path: '/portal/grades', color: '#6366f1' },
    { label: 'แผนการสอน', icon: FileText, path: '/portal/syllabus', color: '#f59e0b' },
    { label: 'ตาราง', icon: CalendarCheck, path: '/portal/schedule', color: '#ec4899' },
  ],
  admin: [
    { label: 'รายงาน', icon: BarChart2, path: '/portal/grades', color: '#6366f1' },
    { label: 'ปฏิทิน', icon: CalendarCheck, path: '/portal/calendar', color: '#10b981' },
    { label: 'ผู้ใช้', icon: FileText, path: '/portal/users', color: '#f59e0b' },
    { label: 'ตาราง', icon: CalendarCheck, path: '/portal/schedule', color: '#ec4899' },
  ],
  student: [
    { label: 'ผลการเรียน', icon: BarChart2, path: '/portal/grades', color: '#6366f1' },
    { label: 'ตารางเรียน', icon: CalendarCheck, path: '/portal/schedule', color: '#10b981' },
    { label: 'แจ้งลา', icon: FileText, path: '/portal/leave', color: '#f59e0b' },
  ],
};

const DEFAULT_ACTIONS = [
  { label: 'ปฏิทิน', icon: CalendarCheck, path: '/portal/calendar', color: '#10b981' },
  { label: 'ประกาศ', icon: FileText, path: '/portal/announcements', color: '#f59e0b' },
];

export default function QuickActionsWidget() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const actions = (role ? ACTIONS_BY_ROLE[role] : null) ?? DEFAULT_ACTIONS;

  return (
    <div style={WIDGET_GLASS} className="rounded-2xl p-3 flex flex-col gap-2 w-full">
      <span className="font-bold text-sm text-slate-700">Quick Actions</span>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 active:scale-95"
                style={{ backgroundColor: `${a.color}22` }}
              >
                <Icon size={18} style={{ color: a.color }} />
              </div>
              <span className="text-[10px] text-slate-500 font-medium leading-tight text-center">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
