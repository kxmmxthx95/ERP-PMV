import type { IconType } from 'react-icons';
import {
  HiAcademicCap,
  HiBell,
  HiBookOpen,
  HiCalendarDays,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiClipboardDocumentCheck,
  HiClipboardDocumentList,
  HiClock,
  HiCog6Tooth,
  HiCpuChip,
  HiDocumentText,
  HiEye,
  HiFingerPrint,
  HiHome,
  HiMegaphone,
  HiPuzzlePiece,
  HiShieldCheck,
  HiSparkles,
  HiSignal,
  HiSquares2X2,
  HiUser,
  HiUsers,
} from 'react-icons/hi2';
import type { FeaturePermission } from '@/types/rolePermission';

const FEATURE_ICON_MAP: Record<string, IconType> = {
  users: HiUsers,
  roles: HiShieldCheck,
  logs: HiDocumentText,
  settings: HiCog6Tooth,
  curriculum: HiBookOpen,
  lessonPlan: HiBookOpen,
  teaching: HiClipboardDocumentList,
  teachers: HiUsers,
  classes: HiHome,
  students: HiUsers,
  schedule: HiCalendarDays,
  calendar: HiCalendarDays,
  attendance: HiClipboardDocumentCheck,
  morningRollCall: HiClipboardDocumentCheck,
  staffAttendance: HiClock,
  fingerprintDevices: HiFingerPrint,
  exams: HiClipboardDocumentList,
  questionBank: HiBookOpen,
  aiAgents: HiCpuChip,
  grades: HiAcademicCap,
  leave: HiDocumentText,
  feedback: HiMegaphone,
  feedback_manage: HiMegaphone,
  feedback_view_identity: HiEye,
  dutySchedule: HiShieldCheck,
  reports: HiChatBubbleLeftRight,
  futurePlan: HiAcademicCap,
  wordGame: HiPuzzlePiece,
  announcements: HiBell,
  widget_wordGame: HiPuzzlePiece,
  widget_announcements: HiBell,
  widget_feedbackStatus: HiMegaphone,
  widget_leave: HiDocumentText,
  widget_leaveQuota: HiDocumentText,
  widget_staffAttendance: HiClock,
  widget_calendar: HiCalendarDays,
  widget_studentProfile: HiUser,
  widget_attendance: HiClipboardDocumentCheck,
  widget_schedule: HiCalendarDays,
  widget_morningRollCall: HiClipboardDocumentCheck,
  widget_teacherDailyTasks: HiClipboardDocumentList,
  widget_morningRollCallSummary: HiChartBarSquare,
  widget_dailyAttendanceSummary: HiChartBarSquare,
  widget_teacherLiveStatus: HiSignal,
  widget_studentSummary: HiUsers,
  widget_studentLeave: HiDocumentText,
  widget_studentExamScore: HiAcademicCap,
  widget_futurePlan: HiAcademicCap,
  widget_horoscope: HiSparkles,
};

export function getFeatureIcon(featureKey: string): IconType {
  return FEATURE_ICON_MAP[featureKey] ?? HiSquares2X2;
}

export function getFeatureDisplayName(feature: FeaturePermission): string {
  const label = feature.label.trim();
  if (feature.featureKey.startsWith('widget_')) {
    return label.replace(/^วิดเจ็ต\s*/u, '').trim() || label;
  }
  return label;
}

export function getFeatureCategoryLabel(feature: FeaturePermission): string {
  if (feature.featureKey.startsWith('widget_')) return 'วิดเจ็ต';
  return feature.category;
}
