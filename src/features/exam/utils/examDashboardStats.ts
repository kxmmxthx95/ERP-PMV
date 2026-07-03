import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { SUBJECT_GROUP_CONFIG, DEPARTMENT_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import { getGradeLevelBadgeStyle, inferDepartmentFromGradeLevel } from '@/lib/school/gradeLevelBadge';
import { attemptScorePercent } from '@/lib/exam/examRoomScoring';
import { resolveAttemptTotalScore } from '@/lib/exam/manualEssayGrading';

export interface ExamDashboardStats {
  roomCounts: { all: number; upcoming: number; active: number; closed: number };
  attemptCounts: {
    total: number;
    inProgress: number;
    submitted: number;
    graded: number;
    pendingGrading: number;
    pendingManual: number;
    suspicious: number;
  };
  gradeBookLinked: number;
  scoredPercents: number[];
  distribution: { name: string; value: number; color: string }[];
  avgPercent: number;
  passRate: number;
  activeRooms: Array<{
    room: ExamRoom;
    inProgress: number;
    submitted: number;
    suspicious: number;
  }>;
  recentRooms: ExamRoom[];
  subjectBreakdown: Array<{ subjectName: string; count: number }>;
  subjectGroupBreakdown: Array<{
    groupKey: SubjectGroupId;
    name: string;
    color: string;
    bg: string;
    border: string;
    count: number;
    active: number;
    upcoming: number;
    closed: number;
  }>;
  gradeLevelBreakdown: Array<{
    gradeLevel: string;
    color: string;
    bg: string;
    border: string;
    count: number;
    active: number;
    upcoming: number;
    closed: number;
  }>;
  teacherRoomBreakdown: Array<{
    teacherId: string;
    teacherName: string;
    teacherPhotoURL?: string;
    count: number;
    active: number;
    upcoming: number;
    closed: number;
  }>;
}

export interface StudentExamDashboardStats {
  activeRooms: ExamRoom[];
  upcomingRooms: ExamRoom[];
  myAttempts: ExamAttempt[];
  inProgress: number;
  submitted: number;
  graded: number;
  bestPercent: number | null;
  avgPercent: number | null;
  subjectScores: Array<{
    subjectName: string;
    bestPercent: number;
    roomTitle: string;
  }>;
}

function groupAttemptsByRoom(attempts: ExamAttempt[]): Map<string, ExamAttempt[]> {
  const map = new Map<string, ExamAttempt[]>();
  attempts.forEach((att) => {
    const list = map.get(att.roomId) ?? [];
    list.push(att);
    map.set(att.roomId, list);
  });
  return map;
}

export function resolveSubjectGroupId(room: ExamRoom): SubjectGroupId {
  const raw = room.subjectGroupId?.trim();
  if (raw && raw in SUBJECT_GROUP_CONFIG) return raw as SubjectGroupId;
  return 'other';
}

export function resolveExamRoomGradeLevel(room: ExamRoom): string {
  const direct = room.gradeLevel?.trim();
  if (direct) return direct;
  const className = room.className?.trim();
  if (className?.includes('/')) {
    const [gradeLevel] = className.split('/');
    return gradeLevel?.trim() || '';
  }
  return '';
}

function gradeLevelSortKey(gradeLevel: string): number {
  if (!gradeLevel || gradeLevel === 'ไม่ระบุระดับชั้น') return 9999;
  const dept = inferDepartmentFromGradeLevel(gradeLevel);
  const deptOrder = { early: 0, primary: 100, secondary: 200 }[dept];
  const gradeIndex = DEPARTMENT_CONFIG[dept].grades.indexOf(gradeLevel);
  return deptOrder + (gradeIndex >= 0 ? gradeIndex : 50);
}

export function buildExamDashboardStats(
  rooms: ExamRoom[],
  attempts: ExamAttempt[],
): ExamDashboardStats {
  const attemptsByRoom = groupAttemptsByRoom(attempts);
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  const roomCounts = {
    all: rooms.length,
    upcoming: rooms.filter((room) => room.status === 'upcoming').length,
    active: rooms.filter((room) => room.status === 'active').length,
    closed: rooms.filter((room) => room.status === 'closed').length,
  };

  const attemptCounts = {
    total: attempts.length,
    inProgress: attempts.filter((att) => att.status === 'in_progress').length,
    submitted: attempts.filter((att) => att.status === 'submitted').length,
    graded: attempts.filter((att) => att.status === 'graded').length,
    pendingGrading: attempts.filter(
      (att) => att.status === 'submitted' && resolveAttemptTotalScore(att) === null,
    ).length,
    pendingManual: attempts.filter((att) => att.pendingManualGrading === true).length,
    suspicious: attempts.filter((att) => (att.suspiciousActivities ?? 0) >= 2).length,
  };

  const gradeBookLinked = rooms.filter(
    (room) => room.settings?.scoreCollectionEnabled === true,
  ).length;

  const scoredPercents: number[] = [];
  attempts.forEach((att) => {
    const room = roomById.get(att.roomId);
    if (!room) return;
    const pct = attemptScorePercent(room, att);
    if (pct !== null) scoredPercents.push(pct);
  });

  const distribution = [
    { name: '0-39%', value: scoredPercents.filter((v) => v < 40).length, color: '#ef4444' },
    { name: '40-59%', value: scoredPercents.filter((v) => v >= 40 && v < 60).length, color: '#f59e0b' },
    { name: '60-79%', value: scoredPercents.filter((v) => v >= 60 && v < 80).length, color: '#3b82f6' },
    { name: '80-100%', value: scoredPercents.filter((v) => v >= 80).length, color: '#10b981' },
  ];

  const avgPercent = scoredPercents.length > 0
    ? scoredPercents.reduce((sum, value) => sum + value, 0) / scoredPercents.length
    : 0;
  const passRate = scoredPercents.length > 0
    ? (scoredPercents.filter((value) => value >= 50).length / scoredPercents.length) * 100
    : 0;

  const activeRooms = rooms
    .filter((room) => room.status === 'active')
    .map((room) => {
      const roomAttempts = attemptsByRoom.get(room.id) ?? [];
      return {
        room,
        inProgress: roomAttempts.filter((att) => att.status === 'in_progress').length,
        submitted: roomAttempts.filter(
          (att) => att.status === 'submitted' || att.status === 'graded',
        ).length,
        suspicious: roomAttempts.filter((att) => (att.suspiciousActivities ?? 0) >= 2).length,
      };
    })
    .sort((a, b) => b.inProgress - a.inProgress || b.suspicious - a.suspicious);

  const recentRooms = [...rooms]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 5);

  const subjectMap = new Map<string, number>();
  rooms.forEach((room) => {
    const name = room.subjectName?.trim() || 'ไม่ระบุวิชา';
    subjectMap.set(name, (subjectMap.get(name) ?? 0) + 1);
  });
  const subjectBreakdown = Array.from(subjectMap.entries())
    .map(([subjectName, count]) => ({ subjectName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const subjectGroupMap = new Map<
    SubjectGroupId,
    { count: number; active: number; upcoming: number; closed: number }
  >();
  rooms.forEach((room) => {
    const groupKey = resolveSubjectGroupId(room);
    const existing = subjectGroupMap.get(groupKey) ?? {
      count: 0,
      active: 0,
      upcoming: 0,
      closed: 0,
    };
    existing.count += 1;
    if (room.status === 'active') existing.active += 1;
    else if (room.status === 'upcoming') existing.upcoming += 1;
    else existing.closed += 1;
    subjectGroupMap.set(groupKey, existing);
  });
  const subjectGroupBreakdown = Array.from(subjectGroupMap.entries())
    .map(([groupKey, counts]) => {
      const cfg = SUBJECT_GROUP_CONFIG[groupKey];
      return {
        groupKey,
        name: cfg.name,
        color: cfg.color,
        bg: cfg.bg,
        border: cfg.border,
        ...counts,
      };
    })
    .sort(
      (a, b) =>
        (SUBJECT_GROUP_CONFIG[a.groupKey]?.order ?? 99)
        - (SUBJECT_GROUP_CONFIG[b.groupKey]?.order ?? 99),
    );

  const gradeLevelMap = new Map<
    string,
    { count: number; active: number; upcoming: number; closed: number }
  >();
  rooms.forEach((room) => {
    const gradeLevel = resolveExamRoomGradeLevel(room) || 'ไม่ระบุระดับชั้น';
    const existing = gradeLevelMap.get(gradeLevel) ?? {
      count: 0,
      active: 0,
      upcoming: 0,
      closed: 0,
    };
    existing.count += 1;
    if (room.status === 'active') existing.active += 1;
    else if (room.status === 'upcoming') existing.upcoming += 1;
    else existing.closed += 1;
    gradeLevelMap.set(gradeLevel, existing);
  });
  const gradeLevelBreakdown = Array.from(gradeLevelMap.entries())
    .map(([gradeLevel, counts]) => {
      const badge = getGradeLevelBadgeStyle(gradeLevel === 'ไม่ระบุระดับชั้น' ? '' : gradeLevel);
      return {
        gradeLevel,
        color: badge.color,
        bg: badge.bg,
        border: badge.border,
        ...counts,
      };
    })
    .sort((a, b) => gradeLevelSortKey(a.gradeLevel) - gradeLevelSortKey(b.gradeLevel));

  const teacherMap = new Map<
    string,
    {
      teacherId: string;
      teacherName: string;
      teacherPhotoURL?: string;
      count: number;
      active: number;
      upcoming: number;
      closed: number;
    }
  >();
  rooms.forEach((room) => {
    const teacherId = room.teacherId?.trim() || 'unknown';
    const teacherName = room.teacherName?.trim() || 'ไม่ระบุครู';
    const existing = teacherMap.get(teacherId) ?? {
      teacherId,
      teacherName,
      teacherPhotoURL: room.teacherPhotoURL?.trim() || undefined,
      count: 0,
      active: 0,
      upcoming: 0,
      closed: 0,
    };
    if (room.teacherPhotoURL?.trim()) {
      existing.teacherPhotoURL = room.teacherPhotoURL.trim();
    }
    existing.count += 1;
    if (room.status === 'active') existing.active += 1;
    else if (room.status === 'upcoming') existing.upcoming += 1;
    else existing.closed += 1;
    teacherMap.set(teacherId, existing);
  });
  const teacherRoomBreakdown = Array.from(teacherMap.values()).sort(
    (a, b) => b.count - a.count || a.teacherName.localeCompare(b.teacherName, 'th'),
  );

  return {
    roomCounts,
    attemptCounts,
    gradeBookLinked,
    scoredPercents,
    distribution,
    avgPercent,
    passRate,
    activeRooms,
    recentRooms,
    subjectBreakdown,
    subjectGroupBreakdown,
    gradeLevelBreakdown,
    teacherRoomBreakdown,
  };
}

export function buildStudentExamDashboardStats(
  rooms: ExamRoom[],
  attempts: ExamAttempt[],
  studentIds: string[],
): StudentExamDashboardStats {
  const idSet = new Set(studentIds.map((id) => String(id).trim()).filter(Boolean));
  const myAttempts = attempts.filter((att) => idSet.has(String(att.studentId).trim()));
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  const activeRooms = rooms.filter((room) => room.status === 'active');
  const upcomingRooms = rooms.filter((room) => room.status === 'upcoming');

  const percents: number[] = [];
  const subjectBest = new Map<string, { bestPercent: number; roomTitle: string }>();

  myAttempts.forEach((att) => {
    const room = roomById.get(att.roomId);
    if (!room) return;
    const pct = attemptScorePercent(room, att);
    if (pct === null) return;
    percents.push(pct);

    const subjectName = room.subjectName?.trim() || room.title;
    const existing = subjectBest.get(subjectName);
    if (!existing || pct > existing.bestPercent) {
      subjectBest.set(subjectName, { bestPercent: pct, roomTitle: room.title });
    }
  });

  const subjectScores = Array.from(subjectBest.entries())
    .map(([subjectName, value]) => ({
      subjectName,
      bestPercent: value.bestPercent,
      roomTitle: value.roomTitle,
    }))
    .sort((a, b) => b.bestPercent - a.bestPercent);

  const bestPercent = percents.length > 0 ? Math.max(...percents) : null;
  const avgPercent = percents.length > 0
    ? percents.reduce((sum, value) => sum + value, 0) / percents.length
    : null;

  return {
    activeRooms,
    upcomingRooms,
    myAttempts,
    inProgress: myAttempts.filter((att) => att.status === 'in_progress').length,
    submitted: myAttempts.filter((att) => att.status === 'submitted').length,
    graded: myAttempts.filter((att) => att.status === 'graded').length,
    bestPercent,
    avgPercent,
    subjectScores,
  };
}

export function formatExamRoomStatus(status: ExamRoom['status']): string {
  if (status === 'upcoming') return 'รอเปิด';
  if (status === 'active') return 'กำลังสอบ';
  return 'ปิดแล้ว';
}

export function formatExamRoomStatusColor(status: ExamRoom['status']): string {
  if (status === 'upcoming') return 'text-amber-600 bg-amber-50';
  if (status === 'active') return 'text-emerald-700 bg-emerald-50';
  return 'text-slate-500 bg-slate-100';
}
