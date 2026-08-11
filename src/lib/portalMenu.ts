/**
 * Single source of truth for portal menu items — shown on the HomePage menu grid.
 * Other places that need a page's display name (mobile header title, breadcrumbs)
 * must read from here instead of hardcoding their own copy, so labels never drift apart.
 */
import {
  IoPersonOutline,
  IoSchoolOutline,
  IoShieldCheckmarkOutline,
  IoCalendarOutline,
  IoClipboardOutline,
  IoNotificationsOutline,
  IoMegaphoneOutline,
  IoSettingsOutline,
  IoFingerPrintOutline,
  IoTimeOutline,
  IoCheckmarkDoneOutline,
  IoSparklesOutline,
  IoChatbubbleOutline,
  IoRibbonOutline,
  IoWalletOutline,
  IoPlayCircleOutline,
  IoBarChartOutline,
  IoAnalyticsOutline,
  IoSwapHorizontalOutline,
} from 'react-icons/io5';
import { HiBookOpen, HiBriefcase, HiClipboardDocument, HiComputerDesktop, HiMiniCalculator, HiMiniEnvelope, HiMiniTableCells, HiMiniUserCircle, HiMiniUserGroup, HiTv } from 'react-icons/hi2';
import type { IconType } from 'react-icons';

export interface PortalMenuItem {
  title: string;
  subtitle: string;
  icon: IconType;
  path: string;
  featureKey: string;
  count?: number;
}

export const ALL_MENUS: PortalMenuItem[] = [
  { title: 'จัดการผู้ใช้', subtitle: 'User Directory & Roles', icon: IoPersonOutline, path: '/portal/users', featureKey: 'users', count: 0 },
  { title: 'จัดการครู', subtitle: 'Teacher Management', icon: HiMiniUserCircle, path: '/portal/teachers', featureKey: 'teachers', count: 0 },
  { title: 'จัดการนักเรียน', subtitle: 'Student Records', icon: HiMiniUserGroup, path: '/portal/students', featureKey: 'students', count: 0 },
  { title: 'ระบบจัดการห้องเรียน', subtitle: 'Classroom Management', icon: HiComputerDesktop, path: '/portal/classes', featureKey: 'classes', count: 0 },
  { title: 'กำหนดสิทธิ์', subtitle: 'Role Permission Manager', icon: IoShieldCheckmarkOutline, path: '/portal/roles', featureKey: 'roles' },
  { title: 'หลักสูตร', subtitle: 'Curriculum & Programs', icon: HiBookOpen, path: '/portal/curriculum', featureKey: 'curriculum' },
  { title: 'ตารางสอน', subtitle: 'Class Schedule', icon: HiMiniTableCells, path: '/portal/schedule', featureKey: 'schedule' },
  { title: 'ปฏิทินการศึกษา', subtitle: 'Academic Calendar', icon: IoCalendarOutline, path: '/portal/calendar', featureKey: 'calendar' },
  { title: 'บันทึกเวลาเรียน', subtitle: 'Attendance Records', icon: IoClipboardOutline, path: '/portal/attendance', featureKey: 'attendance' },
  { title: 'บันทึกกิจกรรมหน้าเสาธง', subtitle: 'Morning Roll-Call', icon: IoCheckmarkDoneOutline, path: '/portal/morning-rollcall', featureKey: 'morningRollCall' },
  { title: 'บันทึกเวลาปฏิบัติงาน', subtitle: 'Staff Attendance', icon: IoTimeOutline, path: '/portal/staff-attendance', featureKey: 'staffAttendance' },
  { title: 'จัดการอุปกรณ์เชื่อมต่อ', subtitle: 'Fingerprint Terminals', icon: IoFingerPrintOutline, path: '/portal/fingerprint-devices', featureKey: 'fingerprintDevices' },
  { title: 'ประเมินผลการปฏิบัติงาน', subtitle: 'Teacher KPI Evaluation', icon: IoBarChartOutline, path: '/portal/teacher-kpi', featureKey: 'teacherKpi' },
  { title: 'จัดการการลา', subtitle: 'Leave Requests', icon: HiMiniEnvelope, path: '/portal/leave', featureKey: 'leave' },
  { title: 'จัดการเวรประจำวัน', subtitle: 'Duty Teacher Schedule', icon: IoShieldCheckmarkOutline, path: '/portal/duty-schedule', featureKey: 'dutySchedule' },
  { title: 'มอบหมายการสอนแทน', subtitle: 'Substitute Teaching', icon: IoSwapHorizontalOutline, path: '/portal/substitute-teaching', featureKey: 'substituteTeaching' },
  { title: 'Report Control Center', subtitle: 'ส่งรายงานผ่าน LINE OA', icon: IoChatbubbleOutline, path: '/portal/report-control', featureKey: 'reports' },
  { title: 'ประกาศ', subtitle: 'ข่าวสารและประกาศ', icon: IoNotificationsOutline, path: '/portal/announcements', featureKey: 'announcements' },
  { title: 'PMV Voice', subtitle: 'เสียงของนักเรียน', icon: IoMegaphoneOutline, path: '/portal/feedback', featureKey: 'feedback' },
  { title: 'คะแนนพฤติกรรม', subtitle: 'Behavior & Conduct Score', icon: IoRibbonOutline, path: '/portal/behavior', featureKey: 'behaviorScore' },
  { title: 'ห้องสอบออนไลน์', subtitle: 'Online Exam & Assessment', icon: HiTv, path: '/portal/exams', featureKey: 'exams' },
  { title: 'คลังข้อสอบ', subtitle: 'Question Bank & Repository', icon: HiBriefcase, path: '/portal/question-bank', featureKey: 'questionBank' },
  { title: 'AI Agent', subtitle: 'Agent Command Center', icon: IoSparklesOutline, path: '/portal/ai-agents', featureKey: 'aiAgents' },
  { title: 'ระบบบันทึกผลการเรียน', subtitle: 'Grade Book & Grade Cutting', icon: HiMiniCalculator, path: '/portal/grades', featureKey: 'grades' },
  { title: 'วิเคราะห์ผู้เรียน', subtitle: 'Student Risk Analytics', icon: IoAnalyticsOutline, path: '/portal/student-analytics', featureKey: 'studentAnalytics' },
  { title: 'แนะแนวการศึกษา', subtitle: 'Future Plan & University', icon: IoSchoolOutline, path: '/portal/future-plan', featureKey: 'futurePlan' },
  { title: 'มอบหมายงาน', subtitle: 'Task Delegation', icon: IoCheckmarkDoneOutline, path: '/portal/tasks', featureKey: 'tasks' },
  { title: 'การตั้งค่า', subtitle: 'ระบบและปีการศึกษา', icon: IoSettingsOutline, path: '/portal/settings', featureKey: 'settings' },
  { title: 'แผนการสอน', subtitle: 'Weekly Teaching Plan', icon: HiClipboardDocument, path: '/portal/micro-syllabus', featureKey: 'microSyllabus' },
  { title: 'ระบบจัดการค่าธรรมเนียม', subtitle: 'Tuition Fee Management', icon: IoWalletOutline, path: '/portal/tuition', featureKey: 'tuition' },
  { title: 'คอร์สออนไลน์', subtitle: 'Course on Demand / VOD', icon: IoPlayCircleOutline, path: '/portal/courses', featureKey: 'courseOnDemand' },
];

/** path → title lookup, derived from ALL_MENUS so it can never drift from the menu grid. */
export const PORTAL_MENU_TITLES: Record<string, string> = Object.fromEntries(
  ALL_MENUS.map((item) => [item.path, item.title]),
);

export function getPortalMenuTitle(path: string): string | undefined {
  return PORTAL_MENU_TITLES[path];
}
