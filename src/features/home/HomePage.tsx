import { useMemo, memo, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  IoPeopleOutline,
  IoPersonOutline,
  IoSchoolOutline,
  IoShieldCheckmarkOutline,
  IoBookOutline,
  IoCalendarOutline,
  IoClipboardOutline,
  IoNotificationsOutline,
  IoMegaphoneOutline,
  IoSettingsOutline,
  IoFingerPrintOutline,
  IoTimeOutline,
  IoCheckmarkDoneOutline,
  IoSparklesOutline,
  IoGameControllerOutline,
  IoChatbubbleOutline,
  IoRibbonOutline,
  IoGridOutline
} from 'react-icons/io5';
import type { IconType } from 'react-icons';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import type { FeaturePermission } from '@/types/rolePermission';
import { buildSysadminPermissionView, applySysadminWidgetOverrides } from '@/types/rolePermission';
import { cn } from '@/lib/utils';
import AnnouncementWidget from './widgets/AnnouncementWidget';
import TodayScheduleWidget from './widgets/TodayScheduleWidget';
import StudentScheduleWidget from './widgets/StudentScheduleWidget';
import PendingTaskWidget from './widgets/PendingTaskWidget';
import TeacherDailyTaskWidget from './widgets/TeacherDailyTaskWidget';
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
import BehaviorScoreWidget from './widgets/BehaviorScoreWidget';
import HoroscopeWidget from './widgets/HoroscopeWidget';
import WordGameWidget from './widgets/WordGameWidget';
import { DashboardWidgetsSkeleton, MenuPageSkeleton } from './components/WidgetSkeleton';

const MENU_GRID_COLUMNS = 4;

/** แถวบน = โทนเย็น, ไล่ลงมาแถวล่าง = โทนร้อน (4 ไอคอนต่อแถว) */
const MENU_ROW_PALETTE = [
  ['#6366F1', '#4F46E5', '#3B82F6', '#2563EB'],
  ['#0EA5E9', '#0284C7', '#06B6D4', '#0891B2'],
  ['#14B8A6', '#0D9488', '#10B981', '#059669'],
  ['#22C55E', '#84CC16', '#A3E635', '#65A30D'],
  ['#EAB308', '#F59E0B', '#FBBF24', '#D97706'],
  ['#F97316', '#FB923C', '#EA580C', '#F59E0B'],
  ['#EF4444', '#F43F5E', '#EC4899', '#E11D48'],
] as const;

function getMenuAccentColor(index: number, columns: number = MENU_GRID_COLUMNS): string {
  const row = Math.floor(index / columns);
  const col = index % columns;
  const palette = MENU_ROW_PALETTE[Math.min(row, MENU_ROW_PALETTE.length - 1)];
  return palette[col % palette.length];
}

const ALL_MENUS: { title: string; subtitle: string; icon: IconType; path: string; featureKey: string; count?: number }[] = [
  { title: 'จัดการผู้ใช้', subtitle: 'User Directory & Roles', icon: IoPersonOutline, path: '/portal/users', featureKey: 'users', count: 0 },
  { title: 'จัดการครู', subtitle: 'Teacher Management', icon: IoPeopleOutline, path: '/portal/teachers', featureKey: 'teachers', count: 0 },
  { title: 'จัดการนักเรียน', subtitle: 'Student Records', icon: IoPeopleOutline, path: '/portal/students', featureKey: 'students', count: 0 },
  { title: 'ระบบจัดการห้องเรียน', subtitle: 'Classroom Management', icon: IoSchoolOutline, path: '/portal/classes', featureKey: 'classes', count: 0 },
  { title: 'กำหนดสิทธิ์', subtitle: 'Role Permission Manager', icon: IoShieldCheckmarkOutline, path: '/portal/roles', featureKey: 'roles' },
  { title: 'หลักสูตร', subtitle: 'Curriculum & Programs', icon: IoBookOutline, path: '/portal/curriculum', featureKey: 'curriculum' },
  { title: 'ตารางสอน', subtitle: 'Class Schedule', icon: IoCalendarOutline, path: '/portal/schedule', featureKey: 'schedule' },
  { title: 'ปฏิทินการศึกษา', subtitle: 'Academic Calendar', icon: IoCalendarOutline, path: '/portal/calendar', featureKey: 'calendar' },
  { title: 'การเข้าเรียน', subtitle: 'Attendance Records', icon: IoClipboardOutline, path: '/portal/attendance', featureKey: 'attendance' },
  { title: 'เช็คชื่อเข้าแถว', subtitle: 'Morning Roll-Call', icon: IoCheckmarkDoneOutline, path: '/portal/morning-rollcall', featureKey: 'morningRollCall' },
  { title: 'ลงเวลาทำงาน', subtitle: 'Staff Attendance', icon: IoTimeOutline, path: '/portal/staff-attendance', featureKey: 'staffAttendance' },
  { title: 'เครื่องสแกน', subtitle: 'Fingerprint Terminals', icon: IoFingerPrintOutline, path: '/portal/fingerprint-devices', featureKey: 'fingerprintDevices' },
  { title: 'การลา', subtitle: 'Leave Requests', icon: IoClipboardOutline, path: '/portal/leave', featureKey: 'leave' },
  { title: 'ครูเวร', subtitle: 'Duty Teacher Schedule', icon: IoShieldCheckmarkOutline, path: '/portal/duty-schedule', featureKey: 'dutySchedule' },
  { title: 'Report Control Center', subtitle: 'ส่งรายงานผ่าน LINE OA', icon: IoChatbubbleOutline, path: '/portal/report-control', featureKey: 'reports' },
  { title: 'ประกาศ', subtitle: 'ข่าวสารและประกาศ', icon: IoNotificationsOutline, path: '/portal/announcements', featureKey: 'announcements' },
  { title: 'PMV Voice', subtitle: 'เสียงของนักเรียน', icon: IoMegaphoneOutline, path: '/portal/feedback', featureKey: 'feedback' },
  { title: 'คะแนนพฤติกรรม', subtitle: 'Behavior & Conduct Score', icon: IoRibbonOutline, path: '/portal/behavior', featureKey: 'behaviorScore' },
  { title: 'ห้องสอบออนไลน์', subtitle: 'Online Exam & Assessment', icon: IoClipboardOutline, path: '/portal/exams', featureKey: 'exams' },
  { title: 'คลังข้อสอบ', subtitle: 'Question Bank & Repository', icon: IoBookOutline, path: '/portal/question-bank', featureKey: 'questionBank' },
  { title: 'AI Agent', subtitle: 'Agent Command Center', icon: IoSparklesOutline, path: '/portal/ai-agents', featureKey: 'aiAgents' },
  { title: 'สมุดคะแนน', subtitle: 'Grade Book & Grade Cutting', icon: IoSchoolOutline, path: '/portal/grades', featureKey: 'grades' },
  { title: 'แผนการศึกษาต่อ', subtitle: 'Future Plan & University', icon: IoSchoolOutline, path: '/portal/future-plan', featureKey: 'futurePlan' },
  { title: 'เกมทายคำ', subtitle: 'Multiplayer Word Game', icon: IoGameControllerOutline, path: '/portal/word-game', featureKey: 'wordGame' },
  { title: 'มอบหมายงาน', subtitle: 'Task Delegation', icon: IoCheckmarkDoneOutline, path: '/portal/tasks', featureKey: 'tasks' },
  { title: 'การตั้งค่า', subtitle: 'ระบบและปีการศึกษา', icon: IoSettingsOutline, path: '/portal/settings', featureKey: 'settings' },
  { title: 'แผนการสอน', subtitle: 'Weekly Teaching Plan', icon: IoGridOutline, path: '/portal/micro-syllabus', featureKey: 'microSyllabus' },
];

const ALL_MENUS_INDEX_MAP = new Map(ALL_MENUS.map((m, idx) => [m.featureKey, idx]));

const MENU_CATEGORIES = [
  {
    id: 'system_admin',
    name: 'ระบบบริหารจัดการ (System & Admin)',
    featureKeys: ['users', 'teachers', 'students', 'roles', 'staffAttendance', 'fingerprintDevices', 'leave', 'settings', 'logs'],
  },
  {
    id: 'academic_teaching',
    name: 'งานวิชาการและการสอน (Academic & Teaching)',
    featureKeys: ['curriculum', 'schedule', 'calendar', 'classes', 'microSyllabus'],
  },
  {
    id: 'assessment_testing',
    name: 'การวัดผลและข้อสอบ (Assessment & Testing)',
    featureKeys: ['questionBank', 'exams', 'grades'],
  },
  {
    id: 'student_affairs',
    name: 'งานกิจการนักเรียนและส่วนกลาง (Student Affairs & Operation)',
    featureKeys: ['attendance', 'morningRollCall', 'dutySchedule', 'announcements', 'tasks', 'feedback', 'behaviorScore', 'reports', 'aiAgents', 'futurePlan', 'wordGame'],
  },
];

// Removed category cards metadata

type MenuIconItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: IconType;
  path: string;
  accent: string;
};

const AppleMusicCard = memo(function AppleMusicCard({
  item,
  onClick,
}: {
  item: MenuIconItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 group cursor-pointer select-none text-left w-full active:scale-[0.98] transition-transform duration-100"
    >
      <div
        className="relative w-full overflow-hidden hover:opacity-95 transition-opacity duration-150"
        style={{
          aspectRatio: '1',
          borderRadius: 16,
          backgroundColor: item.accent,
          backgroundImage: 'linear-gradient(45deg, rgba(255, 255, 255, 0.28) 0%, rgba(0, 0, 0, 0.25) 100%)',
        }}
      >
        {/* Top-Right Icon */}
        <div className="absolute top-3 right-3 text-white pointer-events-none z-10">
          <item.icon className="w-5 h-5" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
          <p
            className="text-white font-black leading-tight line-clamp-2"
            style={{ fontSize: 'clamp(10px, 1.5vw, 14px)', textShadow: '0 0.5px 2px rgba(0,0,0,0.2)' }}
          >
            {item.label}
          </p>
        </div>
      </div>
      {item.subtitle && (
        <p className="text-[11px] text-slate-400 leading-tight line-clamp-1 px-0.5">
          {item.subtitle}
        </p>
      )}
    </button>
  );
});

// Removed unused MobileAppIcon and Hi2 icon helpers

// Removed CategorySelectorCard

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
  permissions,
  role,
}: {
  permMap: Record<string, string> | undefined;
  permissions?: FeaturePermission[];
  role?: string;
}) {
  const isEnabled = (key: string) => !!(permMap && permMap[key] !== undefined);

  const permissionOrder = useMemo(() => {
    const orderMap = new Map<string, number>();
    permissions?.forEach((permission, idx) => {
      orderMap.set(permission.featureKey, idx);
    });
    return orderMap;
  }, [permissions]);

  const getOrder = (featureKey: string, fallback: number) => (
    permissionOrder.get(featureKey) ?? fallback
  );

  const hasRole = (...allowed: string[]) => {
    if (!role) return false;
    if (role === 'sysadmin') return true;
    return allowed.includes(role);
  };

  const widgetItems = useMemo(() => {
    const items: { key: string; order: number; node: React.ReactNode }[] = [];
    let fallbackOrder = 1000;

    const pushItem = (key: string, orderKey: string, node: React.ReactNode) => {
      items.push({
        key,
        order: getOrder(orderKey, fallbackOrder++),
        node,
      });
    };

    if (isEnabled('widget_announcements')) {
      pushItem('widget_announcements', 'widget_announcements', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><AnnouncementWidget /></motion.div>);
    }
    if (isEnabled('widget_feedbackStatus')) {
      pushItem('widget_feedbackStatus', 'widget_feedbackStatus', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><FeedbackStatusWidget /></motion.div>);
    }
    if (isEnabled('widget_calendar')) {
      pushItem('widget_calendar', 'widget_calendar', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><UpcomingEventsWidget /></motion.div>);
    }
    if (isEnabled('widget_studentProfile')) {
      pushItem('widget_studentProfile', 'widget_studentProfile', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentProfileWidget /></motion.div>);
    }
    if (isEnabled('widget_studentSummary') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_studentSummary', 'widget_studentSummary', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentStatWidget /></motion.div>);
    }
    if (isEnabled('widget_staffAttendance') && hasRole('staff', 'admin', 'teacher')) {
      pushItem('widget_staffAttendance', 'widget_staffAttendance', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StaffCheckInWidget /></motion.div>);
    }
    if (isEnabled('widget_morningRollCall') && hasRole('teacher')) {
      pushItem('widget_morningRollCall', 'widget_morningRollCall', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><MorningRollCallWidget /></motion.div>);
    }
    if (isEnabled('widget_teacherDailyTasks') && hasRole('teacher')) {
      pushItem('widget_teacherDailyTasks', 'widget_teacherDailyTasks', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><TeacherDailyTaskWidget /></motion.div>);
    }
    if (isEnabled('widget_morningRollCallSummary') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_morningRollCallSummary', 'widget_morningRollCallSummary', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><MorningRollCallSummaryWidget /></motion.div>);
    }
    if (isEnabled('widget_schedule') && hasRole('student')) {
      pushItem('widget_studentSchedule', 'widget_schedule', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentScheduleWidget /></motion.div>);
    }
    if (isEnabled('widget_schedule') && hasRole('teacher')) {
      pushItem('widget_todaySchedule', 'widget_schedule', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><TodayScheduleWidget /></motion.div>);
    }
    if (isEnabled('pending_tasks') && hasRole('teacher')) {
      pushItem('widget_pendingTasks', 'pending_tasks', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><PendingTaskWidget /></motion.div>);
    }
    if (isEnabled('widget_leave') && hasRole('student', 'staff', 'teacher', 'admin', 'sysadmin')) {
      pushItem('widget_leave', 'widget_leave', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><LeaveWidget /></motion.div>);
    }
    if (isEnabled('widget_studentLeave') && hasRole('student')) {
      pushItem('widget_studentLeave', 'widget_studentLeave', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentQuickLeaveWidget /></motion.div>);
    }
    if (isEnabled('widget_leaveQuota') && hasRole('student', 'staff', 'teacher', 'admin', 'sysadmin')) {
      pushItem('widget_leaveQuota', 'widget_leaveQuota', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><LeaveQuotaWidget /></motion.div>);
    }
    if (isEnabled('widget_dailyAttendanceSummary') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_dailyAttendanceSummary', 'widget_dailyAttendanceSummary', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><DailyAttendanceSummaryWidget /></motion.div>);
    }
    if (isEnabled('widget_teacherLiveStatus') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_teacherLiveStatus', 'widget_teacherLiveStatus', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><ExecutiveTeachingStatusWidget /></motion.div>);
    }
    if (isEnabled('widget_studentExamScore') && hasRole('student')) {
      pushItem('widget_studentExamScore', 'widget_studentExamScore', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentExamScoreWidget /></motion.div>);
    }
    if (isEnabled('widget_futurePlan') && hasRole('student', 'teacher', 'admin', 'sysadmin')) {
      pushItem('widget_futurePlan', 'widget_futurePlan', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><FuturePlanWidget /></motion.div>);
    }
    if (isEnabled('widget_horoscope')) {
      pushItem('widget_horoscope', 'widget_horoscope', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><HoroscopeWidget /></motion.div>);
    }
    if (isEnabled('widget_wordGame')) {
      pushItem('widget_wordGame', 'widget_wordGame', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><WordGameWidget /></motion.div>);
    }
    if (isEnabled('widget_behaviorScore') && hasRole('teacher', 'staff', 'admin', 'sysadmin')) {
      pushItem('widget_behaviorScore', 'widget_behaviorScore', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><BehaviorScoreWidget /></motion.div>);
    }

    return items.sort((a, b) => a.order - b.order);
  }, [getOrder, hasRole, isEnabled]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-stretch"
      >
        {widgetItems.map((widget) => (
          <div key={widget.key} className="contents">{widget.node}</div>
        ))}
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { role, isLoading: authLoading } = useAuth();
  const { view: contextView } = useOutletContext<{ view: 'dashboard' | 'menu' }>();
  const view = contextView ?? 'dashboard';
  // Removed category selector state

  // Removed mobile height measurement hooks



  const isSysAdmin = role === 'sysadmin';
  const { data: rolePermissions, isLoading: permsLoading } = useRolePermissions(role ?? undefined);

  const effectivePermissions = useMemo(() => {
    if (isSysAdmin) {
      return applySysadminWidgetOverrides(buildSysadminPermissionView(), rolePermissions ?? undefined);
    }
    return rolePermissions;
  }, [isSysAdmin, rolePermissions]);

  const cards = useMemo(() => {
    if (!effectivePermissions?.permMap) return [];
    return ALL_MENUS.filter((card) => !!effectivePermissions.permMap?.[card.featureKey]);
  }, [effectivePermissions]);

  const allItems = useMemo(
    () =>
      cards.map((c) => ({
        id: `${c.featureKey}:${c.path}`,
        label: c.title,
        subtitle: c.subtitle,
        icon: c.icon,
        path: c.path,
      })),
    [cards],
  );

  const groupedCategories = useMemo(() => {
    return MENU_CATEGORIES.map((cat) => {
      const itemsInCat = allItems
        .filter((item) => {
          const featureKey = item.id.split(':')[0];
          return cat.featureKeys.includes(featureKey);
        })
        .map((item) => {
          const featureKey = item.id.split(':')[0];
          const originalIdx = ALL_MENUS_INDEX_MAP.get(featureKey) ?? 0;
          return {
            ...item,
            accent: getMenuAccentColor(originalIdx, 4),
          };
        });

      return {
        ...cat,
        items: itemsInCat,
      };
    }).filter((cat) => cat.items.length > 0);
  }, [allItems]);

  const handleMenuNavigate = useCallback(
    (path: string) => navigate(path),
    [navigate],
  );

  if (permsLoading || authLoading) {
    return (
      <div className="relative flex w-full flex-1 min-h-0 flex-col">
        {view === 'dashboard' ? (
          <div className="w-full px-1 pb-24">
            <DashboardWidgetsSkeleton />
          </div>
        ) : (
          <MenuPageSkeleton />
        )}
      </div>
    );
  }

  if (!isSysAdmin && role && !effectivePermissions?.permMap) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center gap-3">
        <p className="text-sm font-bold text-slate-700 font-sukhumvit">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>
        <p className="text-xs text-slate-500 font-sarabun max-w-sm">
          ระบบโหลดสิทธิ์การใช้งานไม่สำเร็จ กรุณารีเฟรชหน้าหรือตรวจสอบการตั้งค่า Firestore (ฐานข้อมูล pmv1)
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full flex-1 min-h-0">
      <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full">
        {/* Dashboard — unmount when on menu tab to release Firestore listeners */}
        {view === 'dashboard' && (
          <div className="w-full px-1 pb-24">
            <DashboardWidgets
              permMap={effectivePermissions?.permMap}
              permissions={effectivePermissions?.permissions}
              role={role ?? undefined}
            />
          </div>
        )}

        {/* Menu — keep mounted so tab switch shows icons immediately */}
        <div
          className={cn(
            'flex flex-col w-full min-h-0 flex-1 touch-pan-y',
            view !== 'menu' && 'hidden',
          )}
        >
          {/* Main Category Groups Rendered Directly */}
          <div className="flex-grow flex flex-col gap-8 w-full max-w-7xl mx-auto py-6 px-4 overflow-y-auto max-h-full">
            {groupedCategories.map((cat) => (
              <div key={cat.id} className="flex flex-col min-h-0">
                {/* Category Header */}
                <div className="flex items-center mb-3.5 select-none">
                  <span className="text-[13.5px] font-black text-slate-800 tracking-wide font-sukhumvit uppercase">
                    {cat.name}
                  </span>
                </div>

                {/* Grid of Apple Music Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-4">
                  {cat.items.map((menuItem) => (
                    <AppleMusicCard
                      key={menuItem.id}
                      item={menuItem}
                      onClick={() => handleMenuNavigate(menuItem.path)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
