import { useMemo, memo, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { IconType } from 'react-icons';
import { ALL_MENUS } from '@/lib/portalMenu';
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
import ExecutiveTeachingStatusWidget from './widgets/ExecutiveTeachingStatusWidget';
import FuturePlanWidget from './widgets/FuturePlanWidget';
import BehaviorScoreWidget from './widgets/BehaviorScoreWidget';
import StudentBehaviorScoreWidget from './widgets/StudentBehaviorScoreWidget';
import HoroscopeWidget from './widgets/HoroscopeWidget';
import StudentFeeWidget from './widgets/StudentFeeWidget';
import StudentAvatarWidget from './widgets/StudentAvatarWidget';
import TuitionStatusSummaryWidget from './widgets/TuitionStatusSummaryWidget';
import ScoreOverrideApprovalWidget from './widgets/ScoreOverrideApprovalWidget';
import AcademicDashboardWidget from './widgets/AcademicDashboardWidget';
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


const ALL_MENUS_INDEX_MAP = new Map(ALL_MENUS.map((m, idx) => [m.featureKey, idx]));

const MENU_CATEGORIES = [
  {
    id: 'system_admin',
    nameTh: 'ระบบบริหารจัดการ',
    nameEn: 'System & Admin',
    featureKeys: ['users', 'teachers', 'students', 'roles', 'staffAttendance', 'fingerprintDevices', 'teacherKpi', 'leave', 'settings', 'logs', 'tuition'],
  },
  {
    id: 'academic_teaching',
    nameTh: 'งานวิชาการและการสอน',
    nameEn: 'Academic & Teaching',
    featureKeys: ['curriculum', 'schedule', 'calendar', 'classes', 'microSyllabus', 'courseOnDemand'],
  },
  {
    id: 'assessment_testing',
    nameTh: 'การวัดผลและข้อสอบ',
    nameEn: 'Assessment & Testing',
    featureKeys: ['questionBank', 'exams', 'examAbsences', 'grades'],
  },
  {
    id: 'student_affairs',
    nameTh: 'งานกิจการนักเรียนและส่วนกลาง',
    nameEn: 'Student Affairs & Operation',
    featureKeys: ['attendance', 'morningRollCall', 'dutySchedule', 'substituteTeaching', 'announcements', 'tasks', 'feedback', 'behaviorScore', 'studentAnalytics', 'reports', 'aiAgents', 'futurePlan'],
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

const MENU_TILE_GRADIENT =
  'linear-gradient(145deg, rgba(255,255,255,0.32) 0%, rgba(0,0,0,0.14) 100%)';

const PortalMenuIcon = memo(function PortalMenuIcon({
  item,
  onClick,
}: {
  item: MenuIconItem;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const tileStyle = {
    backgroundColor: item.accent,
    backgroundImage: MENU_TILE_GRADIENT,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer select-none flex-col items-center gap-1 text-center active:scale-95 transition-transform duration-100 lg:items-stretch lg:gap-2 lg:text-left lg:active:scale-[0.98]"
    >
      {/* iOS home screen — mobile / tablet */}
      <div
        className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.12)] lg:hidden"
        style={tileStyle}
      >
        <Icon className="h-[26px] w-[26px] text-white" aria-hidden />
      </div>

      {/* Apple Music tile — desktop */}
      <div
        className="relative hidden w-full overflow-hidden transition-opacity duration-150 hover:opacity-95 lg:block"
        style={{
          ...tileStyle,
          aspectRatio: '1',
          borderRadius: 16,
        }}
      >
        <div className="pointer-events-none absolute top-3 right-3 z-10 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2">
          <p
            className="line-clamp-2 font-black leading-tight text-white"
            style={{ fontSize: 'clamp(10px, 1.5vw, 14px)', textShadow: '0 0.5px 2px rgba(0,0,0,0.2)' }}
          >
            {item.label}
          </p>
        </div>
      </div>

      <p className="min-h-[26px] line-clamp-2 px-0.5 text-[11px] font-medium leading-[13px] text-foreground font-sukhumvit lg:hidden">
        {item.label}
      </p>

      {item.subtitle ? (
        <p className="hidden line-clamp-1 px-0.5 text-[11px] leading-tight text-muted-foreground lg:block">
          {item.subtitle}
        </p>
      ) : null}
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

    if (isEnabled('widget_studentAvatar') && hasRole('student')) {
      pushItem('widget_studentAvatar', 'widget_studentAvatar', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-4"><StudentAvatarWidget /></motion.div>);
    }
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
    if (isEnabled('widget_scoreOverrideApproval') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_scoreOverrideApproval', 'widget_scoreOverrideApproval', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><ScoreOverrideApprovalWidget /></motion.div>);
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
    if (isEnabled('widget_futurePlan') && hasRole('student', 'teacher', 'admin', 'sysadmin')) {
      pushItem('widget_futurePlan', 'widget_futurePlan', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><FuturePlanWidget /></motion.div>);
    }
    if (isEnabled('widget_horoscope')) {
      pushItem('widget_horoscope', 'widget_horoscope', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><HoroscopeWidget /></motion.div>);
    }
    if (isEnabled('widget_behaviorScore') && hasRole('teacher', 'staff', 'admin', 'sysadmin')) {
      pushItem('widget_behaviorScore', 'widget_behaviorScore', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><BehaviorScoreWidget /></motion.div>);
    }
    if ((isEnabled('widget_studentBehaviorScore') || isEnabled('widget_behaviorScore')) && hasRole('student')) {
      pushItem('widget_studentBehaviorScore', 'widget_studentBehaviorScore', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentBehaviorScoreWidget /></motion.div>);
    }
    if (isEnabled('widget_tuitionFee') && hasRole('student')) {
      pushItem('widget_tuitionFee', 'widget_tuitionFee', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><StudentFeeWidget /></motion.div>);
    }
    if (isEnabled('widget_tuitionStatus') && hasRole('admin', 'sysadmin')) {
      pushItem('widget_tuitionStatus', 'widget_tuitionStatus', <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0"><TuitionStatusSummaryWidget /></motion.div>);
    }
    if (isEnabled('widget_academicDashboard') && hasRole('admin', 'sysadmin')) {
      pushItem(
        'widget_academicDashboard',
        'widget_academicDashboard',
        <motion.div variants={item} className="min-w-0 w-full flex h-full [&>*]:flex-1 [&>*]:min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-4">
          <AcademicDashboardWidget />
        </motion.div>,
      );
    }

    return items.sort((a, b) => a.order - b.order);
  }, [getOrder, hasRole, isEnabled]);

  const isStudentCarousel = role === 'student';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 min-w-0',
        isStudentCarousel && 'h-[calc(100dvh-4.25rem)] overflow-hidden sm:h-auto sm:overflow-visible',
      )}
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className={cn(
          isStudentCarousel
            ? 'flex flex-1 min-h-0 gap-3 overflow-x-auto touch-pan-x overscroll-contain snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
          'items-stretch',
        )}
      >
        {widgetItems.map((widget) => (
          <div
            key={widget.key}
            className={isStudentCarousel ? 'w-full shrink-0 snap-center sm:contents' : 'contents'}
          >
            {widget.node}
          </div>
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
          <div className="mx-auto flex w-full max-w-7xl flex-grow flex-col gap-8 overflow-y-auto px-4 py-3 max-h-full lg:gap-8 lg:px-4 lg:py-6">
            {groupedCategories.map((cat) => (
              <div key={cat.id} className="flex min-h-0 flex-col">
                {/* Category Header */}
                <div className="mb-3 flex select-none flex-col gap-0.5 lg:mb-3.5">
                  <span className="text-[12px] font-black text-foreground font-sukhumvit lg:text-[13.5px]">
                    {cat.nameTh}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-sukhumvit lg:text-[11px]">
                    {cat.nameEn}
                  </span>
                </div>

                {/* iOS icon grid (mobile) · Apple Music tiles (desktop) */}
                <div className="grid grid-cols-4 justify-items-center gap-x-4 gap-y-6 lg:grid-cols-6 lg:justify-items-stretch lg:gap-4 lg:pb-4 xl:grid-cols-8">
                  {cat.items.map((menuItem) => (
                    <PortalMenuIcon
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
