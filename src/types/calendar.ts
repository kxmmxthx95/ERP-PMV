export type CalendarEventType = 'holiday' | 'exam' | 'activity' | 'meeting' | 'semester-start' | 'semester-end';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  type: CalendarEventType;
  targetRoles: string[];
  description?: string;
  createdBy?: string;
}

// ── Google Calendar API Types ─────────────────────────────────────────────────
export interface GoogleCalendarEvent {
  id: string;
  summary: string;          // ชื่อกิจกรรม (ภาษาไทยสำหรับ calendar วันหยุดไทย)
  description?: string;
  start: { date: string };  // "YYYY-MM-DD" (all-day event)
  end: { date: string };    // "YYYY-MM-DD" exclusive — วันหลังจากวันสุดท้ายจริง
}

export interface GoogleCalendarListResponse {
  kind: 'calendar#events';
  summary: string;
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export const EVENT_TYPE_CONFIG: Record<CalendarEventType, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  holiday: {
    label: 'วันหยุด',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.25)',
    glow: '#ef444440',
  },
  exam: {
    label: 'สอบ',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.10)',
    border: 'rgba(234,179,8,0.25)',
    glow: '#eab30840',
  },
  activity: {
    label: 'กิจกรรม',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.25)',
    glow: '#3b82f640',
  },
  meeting: {
    label: 'ประชุม',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.25)',
    glow: '#06b6d440',
  },
  'semester-start': {
    label: 'เปิดเทอม',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.25)',
    glow: '#10b98140',
  },
  'semester-end': {
    label: 'ปิดเทอม',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.25)',
    glow: '#8b5cf640',
  },
};
