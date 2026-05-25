import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, BookOpen, CalendarDays, DoorOpen,
  ClipboardList, Settings, Bell, ShieldCheck, UserCheck, MessageSquare, Megaphone, GraduationCap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  HiOutlineUsers,
  HiOutlineHome,
  HiOutlineShieldCheck,
  HiOutlineBookOpen,
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentList,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineChatBubbleLeftRight,
  HiOutlineBell,
  HiOutlineMegaphone,
  HiOutlineAcademicCap,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import ProtectedWidget from './ProtectedWidget';
import AnnouncementWidget from './widgets/AnnouncementWidget';
import TodayScheduleWidget from './widgets/TodayScheduleWidget';
import StudentScheduleWidget from './widgets/StudentScheduleWidget';
import PendingTaskWidget from './widgets/PendingTaskWidget';
import StaffCheckInWidget from './widgets/StaffCheckInWidget';
import StudentStatWidget from './widgets/StudentStatWidget';
import StudentProfileWidget from './widgets/StudentProfileWidget';
import MorningRollCallWidget from './widgets/MorningRollCallWidget';
import MorningRollCallSummaryWidget from './widgets/MorningRollCallSummaryWidget';
import UpcomingEventsWidget from './widgets/UpcomingEventsWidget';
import LeaveWidget from './widgets/LeaveWidget';
import LeaveQuotaWidget from './widgets/LeaveQuotaWidget';
import DailyAttendanceSummaryWidget from './widgets/DailyAttendanceSummaryWidget';
import StudentQuickLeaveWidget from './widgets/StudentQuickLeaveWidget';
import FeedbackStatusWidget from './widgets/FeedbackStatusWidget';
import StudentExamScoreWidget from './widgets/StudentExamScoreWidget';
import ExecutiveTeachingStatusWidget from './widgets/ExecutiveTeachingStatusWidget';
import FuturePlanWidget from './widgets/FuturePlanWidget';
import { IndeterminateProgress } from '@/components/ui/progress';

const ALL_MENUS: { title: string; subtitle: string; icon: LucideIcon; path: string; accent: string; featureKey: string; count?: number }[] = [
  { title: 'จัดการผู้ใช้', subtitle: 'User Directory & Roles', icon: Users, path: '/portal/users', accent: '#a855f7', featureKey: 'users', count: 0 },
  { title: 'จัดการครู', subtitle: 'Teacher Management', icon: Users, path: '/portal/teachers', accent: '#e11d48', featureKey: 'teachers', count: 0 },
  { title: 'จัดการนักเรียน', subtitle: 'Student Records', icon: Users, path: '/portal/students', accent: '#fb7185', featureKey: 'students', count: 0 },
  { title: 'ระบบจัดการห้องเรียน', subtitle: 'Classroom Management', icon: DoorOpen, path: '/portal/classes', accent: '#06b6d4', featureKey: 'classes', count: 0 },
  { title: 'กำหนดสิทธิ์', subtitle: 'Role Permission Manager', icon: ShieldCheck, path: '/portal/roles', accent: '#2563eb', featureKey: 'roles' },
  { title: 'หลักสูตร', subtitle: 'Curriculum & Programs', icon: BookOpen, path: '/portal/curriculum', accent: '#10b981', featureKey: 'curriculum' },
  { title: 'ตารางสอน', subtitle: 'Class Schedule', icon: CalendarDays, path: '/portal/schedule', accent: '#f43f5e', featureKey: 'schedule' },
  { title: 'ปฏิทินการศึกษา', subtitle: 'Academic Calendar', icon: CalendarDays, path: '/portal/calendar', accent: '#6366f1', featureKey: 'calendar' },
  { title: 'จัดการการสอน', subtitle: 'เช็คชื่อ ภาระงาน สอบ', icon: ClipboardList, path: '/portal/teaching', accent: '#8b5cf6', featureKey: 'teaching' },
  { title: 'การเข้าเรียน', subtitle: 'Attendance Records', icon: ClipboardList, path: '/portal/attendance', accent: '#059669', featureKey: 'attendance' },
  { title: 'เช็คชื่อเข้าแถว', subtitle: 'Morning Roll-Call', icon: UserCheck, path: '/portal/morning-rollcall', accent: '#0ea5e9', featureKey: 'morningRollCall' },
  { title: 'ลงเวลาทำงาน', subtitle: 'Staff Attendance', icon: UserCheck, path: '/portal/staff-attendance', accent: '#0891b2', featureKey: 'staffAttendance' },
  { title: 'การลา', subtitle: 'Leave Requests', icon: ClipboardList, path: '/portal/leave', accent: '#f97316', featureKey: 'leave' },
  { title: 'ครูเวร', subtitle: 'Duty Teacher Schedule', icon: ShieldCheck, path: '/portal/duty-schedule', accent: '#0d9488', featureKey: 'dutySchedule' },
  { title: 'Report Control Center', subtitle: 'ส่งรายงานผ่าน LINE OA', icon: MessageSquare, path: '/portal/report-control', accent: '#7c3aed', featureKey: 'reports' },
  { title: 'ประกาศ', subtitle: 'ข่าวสารและประกาศ', icon: Bell, path: '/portal/announcements', accent: '#6ee7b7', featureKey: 'announcements' },
  { title: 'PMV Voice', subtitle: 'เสียงของนักเรียน', icon: Megaphone, path: '/portal/feedback', accent: '#0ea5e9', featureKey: 'feedback' },
  { title: 'ห้องสอบออนไลน์', subtitle: 'Online Exam & Assessment', icon: ClipboardList, path: '/portal/exams', accent: '#6366f1', featureKey: 'exams' },
  { title: 'คลังข้อสอบ', subtitle: 'Question Bank & Repository', icon: BookOpen, path: '/portal/question-bank', accent: '#8b5cf6', featureKey: 'questionBank' },
  { title: 'สมุดคะแนน', subtitle: 'Grade Book & Grade Cutting', icon: GraduationCap, path: '/portal/grades', accent: '#7c3aed', featureKey: 'grades' },
  { title: 'แผนการศึกษาต่อ', subtitle: 'Future Plan & University', icon: GraduationCap, path: '/portal/future-plan', accent: '#7c3aed', featureKey: 'futurePlan' },
  { title: 'การตั้งค่า', subtitle: 'ระบบและปีการศึกษา', icon: Settings, path: '/portal/settings', accent: '#8b5cf6', featureKey: 'settings' },
];

const ACCENT_PAIRS: Record<string, [string, string]> = {
  '#a855f7': ['#a855f7', '#ec4899'],
  '#e11d48': ['#e11d48', '#f97316'],
  '#fb7185': ['#f43f5e', '#fb923c'],
  '#06b6d4': ['#06b6d4', '#6366f1'],
  '#2563eb': ['#2563eb', '#7c3aed'],
  '#10b981': ['#10b981', '#06b6d4'],
  '#f43f5e': ['#f43f5e', '#fb7185'],
  '#6366f1': ['#6366f1', '#8b5cf6'],
  '#8b5cf6': ['#8b5cf6', '#ec4899'],
  '#ec4899': ['#ec4899', '#f43f5e'],
  '#fb923c': ['#fb923c', '#f59e0b'],
  '#059669': ['#059669', '#10b981'],
  '#0891b2': ['#0891b2', '#06b6d4'],
  '#6ee7b7': ['#10b981', '#34d399'],
};

// Apple Music Album Art Card — full square with label inside bottom-left
function AppleMusicCard({
  item,
  index,
  onClick,
}: {
  item: { id: string; label: string; subtitle?: string; icon: LucideIcon; accent: string };
  index: number;
  onClick: () => void;
}) {
  const [c1, c2] = ACCENT_PAIRS[item.accent] ?? [item.accent, item.accent];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.22, delay: index * 0.02 }}
      className="flex flex-col gap-2 group cursor-pointer select-none"
      onClick={onClick}
    >
      {/* Square Card */}
      <motion.div
        whileHover={{ opacity: 0.95 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '1',
          borderRadius: 16,
          background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`,
        }}
      >
        {/* Shimmer top-right highlight */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 75% 12%, rgba(255,255,255,0.32) 0%, transparent 58%)',
          pointerEvents: 'none',
        }} />
        {/* Bottom gradient scrim for text legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />
        {/* Title inside card — bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
          <p className="text-white font-black leading-tight line-clamp-2"
            style={{ fontSize: 'clamp(10px, 1.5vw, 14px)', textShadow: '0 0.5px 2px rgba(0,0,0,0.2)' }}>
            {item.label}
          </p>
        </div>
      </motion.div>

      {/* Subtitle below card */}
      {item.subtitle && (
        <p className="text-[11px] text-slate-400 leading-tight line-clamp-1 px-0.5">
          {item.subtitle}
        </p>
      )}
    </motion.div>
  );
}

const HI2_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  users: HiOutlineUsers,
  teachers: HiOutlineUsers,
  students: HiOutlineUsers,
  classes: HiOutlineHome,
  roles: HiOutlineShieldCheck,
  curriculum: HiOutlineBookOpen,
  schedule: HiOutlineCalendarDays,
  calendar: HiOutlineCalendarDays,
  teaching: HiOutlineClipboardDocumentList,
  attendance: HiOutlineClipboardDocumentList,
  morningRollCall: HiOutlineClipboardDocumentCheck,
  staffAttendance: HiOutlineClock,
  leave: HiOutlineDocumentText,
  dutySchedule: HiOutlineShieldCheck,
  reports: HiOutlineChatBubbleLeftRight,
  announcements: HiOutlineBell,
  feedback: HiOutlineMegaphone,
  exams: HiOutlineClipboardDocumentList,
  questionBank: HiOutlineBookOpen,
  grades: HiOutlineAcademicCap,
  settings: HiOutlineCog6Tooth,
};

// iOS Style App Icon for Mobile
function MobileAppIcon({
  item,
  index,
  onClick,
}: {
  item: { id: string; label: string; icon: LucideIcon; accent: string };
  index: number;
  onClick: () => void;
}) {
  const [c1, c2] = ACCENT_PAIRS[item.accent] ?? [item.accent, item.accent];
  const Icon = item.icon;
  const featureKey = item.id.split(':')[0];
  const Hi2Icon = HI2_ICON_MAP[featureKey];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.75, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.75 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: index * 0.015 }}
      className="flex flex-col items-center gap-[7px] cursor-pointer select-none"
      onClick={onClick}
    >
      {/* iOS Squircle Icon */}
      <motion.div
        whileTap={{ scale: 0.86 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-[62px] h-[62px] flex items-center justify-center relative overflow-hidden"
        style={{
          borderRadius: '27%',
          background: `linear-gradient(145deg, ${c1} 0%, ${c2} 100%)`,
          boxShadow: `0 4px 16px ${c1}55, 0 1px 3px rgba(0,0,0,0.12)`,
        }}
      >
        {/* Top-left gloss */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 100%)',
          borderRadius: '27% 27% 0 0',
          pointerEvents: 'none',
        }} />
        {Hi2Icon ? (
          <Hi2Icon className="w-[28px] h-[28px] text-white relative z-10 drop-shadow-sm" />
        ) : (
          <Icon className="w-[28px] h-[28px] text-white relative z-10 drop-shadow-sm" strokeWidth={2} />
        )}
      </motion.div>

      {/* Label */}
      <span className="text-[10.5px] font-medium text-slate-600 text-center line-clamp-1 w-full px-0.5 leading-tight tracking-tight">
        {item.label}
      </span>
    </motion.div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.42, 0, 0.58, 1] as const } },
};

function DashboardWidgets({
  permMap,
  role,
}: {
  permMap: Record<string, string> | undefined;
  role?: string;
}) {
  const hasAnyExplicitPerms = !!permMap && Object.keys(permMap).length > 0;
  const studentFallbackWidgetKeys = new Set([
    'widget_feedbackStatus',
    'widget_studentProfile',
    'widget_studentLeave',
    'widget_leaveQuota',
    'widget_studentExamScore',
  ]);

  const isEnabled = (key: string) => {
    if (permMap && permMap[key] !== undefined) return true;
    if (!hasAnyExplicitPerms) {
      if (role === 'student' && studentFallbackWidgetKeys.has(key)) return true;
      if ((role === 'admin' || role === 'sysadmin') && key.startsWith('widget_')) return true;
      if ((role === 'admin' || role === 'sysadmin') && key === 'leave') return true;
    }
    return false;
  };

  const shouldShowStudentHardFallback = role === 'student'
    && !isEnabled('widget_announcements')
    && !isEnabled('widget_feedbackStatus')
    && !isEnabled('widget_calendar')
    && !isEnabled('widget_studentProfile')
    && !isEnabled('widget_leave')
    && !isEnabled('widget_studentLeave')
    && !isEnabled('widget_leaveQuota');

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min items-stretch"
      >
        {isEnabled('widget_announcements') && (
          <motion.div variants={item} className="min-w-0"><AnnouncementWidget /></motion.div>
        )}

        {isEnabled('widget_feedbackStatus') && (
          <motion.div variants={item} className="min-w-0"><FeedbackStatusWidget /></motion.div>
        )}

        {isEnabled('widget_calendar') && (
          <motion.div variants={item} className="min-w-0"><UpcomingEventsWidget /></motion.div>
        )}

        {isEnabled('widget_studentProfile') && (
          <motion.div variants={item} className="min-w-0"><StudentProfileWidget /></motion.div>
        )}

        {isEnabled('widget_studentSummary') && (
          <ProtectedWidget allowedRoles={['admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><StudentStatWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_staffAttendance') && (
          <ProtectedWidget allowedRoles={['staff', 'admin', 'teacher']}>
            <motion.div variants={item} className="min-w-0"><StaffCheckInWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_morningRollCall') && (
          <ProtectedWidget allowedRoles={['teacher']}>
            <motion.div variants={item} className="min-w-0"><MorningRollCallWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_morningRollCallSummary') && (
          <ProtectedWidget allowedRoles={['admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><MorningRollCallSummaryWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('schedule') && (
          <ProtectedWidget allowedRoles={['student']}>
            <motion.div variants={item} className="min-w-0"><StudentScheduleWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('schedule') && (
          <ProtectedWidget allowedRoles={['teacher']}>
            <motion.div variants={item} className="min-w-0"><TodayScheduleWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('pending_tasks') && (
          <ProtectedWidget allowedRoles={['teacher']}>
            <motion.div variants={item} className="min-w-0"><PendingTaskWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_leave') && (
          <ProtectedWidget allowedRoles={['student', 'staff', 'teacher', 'admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><LeaveWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_studentLeave') && (
          <ProtectedWidget allowedRoles={['student']}>
            <motion.div variants={item} className="min-w-0"><StudentQuickLeaveWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_leaveQuota') && (
          <ProtectedWidget allowedRoles={['student', 'staff', 'teacher', 'admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><LeaveQuotaWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_dailyAttendanceSummary') && (
          <ProtectedWidget allowedRoles={['admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><DailyAttendanceSummaryWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_teacherLiveStatus') && (
          <ProtectedWidget allowedRoles={['admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><ExecutiveTeachingStatusWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_studentExamScore') && (
          <ProtectedWidget allowedRoles={['student']}>
            <motion.div variants={item} className="min-w-0"><StudentExamScoreWidget /></motion.div>
          </ProtectedWidget>
        )}

        {isEnabled('widget_futurePlan') && (
          <ProtectedWidget allowedRoles={['student', 'teacher', 'admin', 'sysadmin']}>
            <motion.div variants={item} className="min-w-0"><FuturePlanWidget /></motion.div>
          </ProtectedWidget>
        )}

        {shouldShowStudentHardFallback && (
          <>
            <motion.div variants={item} className="min-w-0"><FeedbackStatusWidget /></motion.div>
            <motion.div variants={item} className="min-w-0"><StudentProfileWidget /></motion.div>
            <motion.div variants={item} className="min-w-0"><StudentQuickLeaveWidget /></motion.div>
            <motion.div variants={item} className="min-w-0"><LeaveQuotaWidget /></motion.div>
            <motion.div variants={item} className="min-w-0"><StudentExamScoreWidget /></motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { role, isLoading: authLoading } = useAuth();
  const { view: contextView } = useOutletContext<{ view: 'dashboard' | 'menu' }>();
  const view = contextView;
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ));
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = isMobile ? 16 : 24;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { data: rolePermissions, isLoading: permsLoading } = useRolePermissions(role ?? undefined);

  const cards = useMemo(() => {
    if (!rolePermissions || !rolePermissions.permMap) return [];
    return ALL_MENUS.filter(card => !!rolePermissions.permMap?.[card.featureKey]);
  }, [rolePermissions]);

  const allItems = useMemo(
    () =>
      cards.map((c) => ({
        id: `${c.featureKey}:${c.path}`,
        label: c.title,
        subtitle: c.subtitle,
        icon: c.icon,
        path: c.path,
        accent: c.accent,
      })),
    [cards],
  );

  const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
  const paginatedItems = allItems.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  if (permsLoading || authLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-12">
        <div className="w-full max-w-[200px] flex flex-col items-center gap-4">
          <IndeterminateProgress />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">กำลังโหลดระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full overflow-y-auto scrollbar-hide px-1"
            >
              <div className="pb-24">
                <DashboardWidgets permMap={rolePermissions?.permMap} role={role ?? undefined} />
              </div>
            </motion.div>
          )}

          {view === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="absolute inset-0 md:relative md:inset-auto flex flex-col overflow-y-auto scrollbar-hide"
            >
              {/* Desktop View: Grid of Cards (scrollable) */}
              <div className="hidden md:block overflow-y-auto flex-1">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {paginatedItems.map((menuItem, i) => (
                      <AppleMusicCard
                        key={menuItem.id}
                        item={menuItem}
                        index={i}
                        onClick={() => navigate(menuItem.path)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Mobile View: iOS Style Icon Grid — no scroll, fixed 1 screen */}
              <motion.div
                className="md:hidden flex-1 flex flex-col pt-3 pb-4 overflow-y-auto"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 && currentPage < totalPages - 1) {
                    setCurrentPage(prev => prev + 1);
                  } else if (info.offset.x > 50 && currentPage > 0) {
                    setCurrentPage(prev => prev - 1);
                  }
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -32 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className="grid grid-cols-4 gap-y-6 gap-x-2 px-3 min-[390px]:px-5"
                  >
                    {paginatedItems.map((menuItem, i) => (
                      <MobileAppIcon
                        key={menuItem.id}
                        item={menuItem}
                        index={i}
                        onClick={() => navigate(menuItem.path)}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Mobile Pagination Dots — iOS style */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-[6px] mt-auto pt-6">
                    {[...Array(totalPages)].map((_, i) => (
                      <motion.button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        animate={{
                          width: currentPage === i ? 20 : 6,
                          opacity: currentPage === i ? 1 : 0.35,
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="h-[6px] rounded-full bg-slate-500"
                        style={{ minWidth: 6 }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Desktop Pagination */}
              {totalPages > 1 && (
                <div className="hidden md:flex justify-center items-center gap-2 mt-12 pb-12">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${currentPage === i
                        ? 'w-8 bg-slate-800 shadow-sm'
                        : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
