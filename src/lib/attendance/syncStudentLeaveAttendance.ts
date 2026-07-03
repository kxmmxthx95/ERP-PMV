import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildClassSessionDocId } from '@/lib/classSessionDocId';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { logActivity } from '@/lib/activityLogger';
import {
  buildLeaveNote,
  isDateInLeaveRange,
  leaveRequestMatchesStudent,
} from '@/lib/attendance/leaveRequestStudentMatch';
import { resolveEnrollmentClassId } from '@/lib/students/classRoster';
import type { ClassRoom } from '@/types/class';
import type { LeaveRequest } from '@/types/leave';
import type { MorningRollCallSession, RollCallStatus, StudentRollCall } from '@/types/morningRollCall';
import type { SchoolDay } from '@/types/schedule';
import { LUNCH_PERIOD } from '@/types/schedule';
import type { Student, Enrollment } from '@/types/student';
import type { AttendanceStatus, StudentAttendance } from '@/types/teaching';

const SYSTEM_RECORDED_BY = 'system';
const SYSTEM_RECORDED_BY_NAME = 'ระบบ (ใบลา)';

type ScheduleRow = {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
  day: number;
  period: number;
  semester: 1 | 2;
};

type ResolvedLeaveContext = {
  student: Student;
  classId: string;
  classRoom: ClassRoom;
  academicYearId: string;
  semester: 1 | 2;
};

function eachDateInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function dateToSchoolDay(date: string): SchoolDay | null {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day === 0 || day === 6) return null;
  return day as SchoolDay;
}

function generateRollCallDocId(date: string, classId: string): string {
  return `${date}_${classId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function shouldApplyLeaveStatus(existingStatus: AttendanceStatus | RollCallStatus | null | undefined): boolean {
  return existingStatus == null || existingStatus === 'leave' || existingStatus === 'unmarked';
}

function recalcClassSessionFields(attendance: StudentAttendance[]) {
  const presentStudentIds = attendance.filter(a => a.status === 'present').map(a => a.studentId);
  const absentStudentIds = attendance.filter(a => a.status === 'absent').map(a => a.studentId);
  const lateStudentIds = attendance.filter(a => a.status === 'late').map(a => a.studentId);
  const excusedStudentIds = attendance.filter(a => a.status === 'excused').map(a => a.studentId);
  const leaveStudentIds = attendance.filter(a => a.status === 'leave').map(a => a.studentId);

  return {
    summary: {
      present: presentStudentIds.length,
      late: lateStudentIds.length,
      absent: absentStudentIds.length,
      leave: leaveStudentIds.length + excusedStudentIds.length,
    },
    presentStudentIds,
    absentStudentIds,
    lateStudentIds,
    excusedStudentIds,
    leaveStudentIds,
    totalStudents: attendance.length,
  };
}

function recalcRollCallFields(attendance: StudentRollCall[]) {
  const presentStudentIds = attendance.filter(a => a.status === 'present').map(a => a.studentId);
  const absentStudentIds = attendance.filter(a => a.status === 'absent').map(a => a.studentId);
  const lateStudentIds = attendance.filter(a => a.status === 'late').map(a => a.studentId);
  const leaveStudentIds = attendance.filter(a => a.status === 'leave').map(a => a.studentId);

  return {
    summary: {
      present: presentStudentIds.length,
      absent: absentStudentIds.length,
      late: lateStudentIds.length,
      leave: leaveStudentIds.length,
    },
    presentStudentIds,
    absentStudentIds,
    lateStudentIds,
    leaveStudentIds,
    totalStudents: attendance.length,
  };
}

async function resolveStudentForLeave(leave: LeaveRequest): Promise<ResolvedLeaveContext | null> {
  const candidateMap = new Map<string, Student>();

  const directSnap = await getDoc(doc(db, 'students', leave.requesterId));
  if (directSnap.exists()) {
    candidateMap.set(directSnap.id, { id: directSnap.id, ...directSnap.data() } as Student);
  }

  const byUserIdSnap = await getDocs(
    query(collection(db, 'students'), where('userId', '==', leave.requesterId)),
  );
  byUserIdSnap.docs.forEach((snap) => {
    candidateMap.set(snap.id, { id: snap.id, ...snap.data() } as Student);
  });

  if (leave.requesterStudentCode?.trim()) {
    const byCodeSnap = await getDocs(
      query(collection(db, 'students'), where('studentCode', '==', leave.requesterStudentCode.trim())),
    );
    byCodeSnap.docs.forEach((snap) => {
      candidateMap.set(snap.id, { id: snap.id, ...snap.data() } as Student);
    });
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 0) return null;

  const student = candidates.find((row) => leaveRequestMatchesStudent(leave, row))
    ?? candidates[0];

  const enrollSnap = await getDocs(
    query(
      collection(db, 'enrollments'),
      where('studentId', '==', student.id),
      where('status', '==', 'studying'),
    ),
  );
  if (enrollSnap.empty) return null;

  const enrollments = enrollSnap.docs.map(
    (snap) => ({ id: snap.id, ...snap.data() } as Enrollment & { academicYear?: string }),
  );

  const yearIds = [...new Set(
    enrollments
      .map((row) => String(row.academicYearId ?? row.academicYear ?? '').trim())
      .filter(Boolean),
  )];

  for (const academicYearId of yearIds) {
    const classesSnap = await getDocs(
      query(collection(db, 'classes'), where('academicYearId', '==', academicYearId)),
    );
    const classes = classesSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() } as ClassRoom));

    for (const enrollment of enrollments) {
      if (String(enrollment.academicYearId ?? enrollment.academicYear ?? '').trim() !== academicYearId) {
        continue;
      }

      const classId = resolveEnrollmentClassId(enrollment, classes, academicYearId);
      if (!classId) continue;

      const classRoom = classes.find((row) => row.id === classId);
      if (!classRoom) continue;

      return {
        student,
        classId,
        classRoom,
        academicYearId,
        semester: (enrollment.semester ?? classRoom.semester ?? 1) as 1 | 2,
      };
    }
  }

  return null;
}

async function loadSchedulesForClass(
  classId: string,
  academicYearId: string,
  semester: 1 | 2,
): Promise<ScheduleRow[]> {
  const [byYearSnap, byAcademicYearSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'schedules'),
      where('classId', '==', classId),
      where('year', '==', academicYearId),
      where('semester', '==', semester),
    )).catch(() => null),
    getDocs(query(
      collection(db, 'schedules'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
    )).catch(() => null),
  ]);

  const rows = new Map<string, ScheduleRow>();
  const ingest = (snap: { id: string; data: () => Record<string, unknown> }) => {
    const data = snap.data();
    const subjectId = String(data.subjectId ?? '').trim();
    const period = Number(data.period ?? 0);
    if (!subjectId || !period || period === LUNCH_PERIOD) return;

    const day = Number(data.day ?? data.dayOfWeek ?? 0);
    if (day < 1 || day > 5) return;

    const key = `${subjectId}|${period}|${day}`;
    rows.set(key, {
      subjectId,
      subjectName: String(data.subjectName ?? subjectId),
      subjectCode: String(data.subjectCode ?? ''),
      teacherId: String(data.teacherId ?? ''),
      teacherName: String(data.teacherName ?? ''),
      day,
      period,
      semester,
    });
  };

  byYearSnap?.docs.forEach(ingest);
  byAcademicYearSnap?.docs.forEach(ingest);

  return [...rows.values()];
}

async function loadClassRoster(classId: string): Promise<Student[]> {
  const enrollSnap = await getDocs(
    query(
      collection(db, 'enrollments'),
      where('classId', '==', classId),
      where('status', '==', 'studying'),
    ),
  );
  const studentIds = enrollSnap.docs
    .map((snap) => String(snap.data().studentId ?? '').trim())
    .filter(Boolean);
  return fetchStudentsByIds<Student>(studentIds);
}

function buildStudentRollCallRow(
  student: Student,
  status: RollCallStatus,
  note: string,
): StudentRollCall {
  return {
    studentId: student.id,
    studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
    studentCode: student.studentCode || '',
    status,
    note,
    photoURL: student.photoURL,
    gender: student.gender,
  };
}

export async function syncStudentLeaveAttendance(leave: LeaveRequest): Promise<void> {
  if (leave.requesterType !== 'student' || leave.status !== 'approved') return;

  const context = await resolveStudentForLeave(leave);
  if (!context) {
    console.warn('[syncStudentLeaveAttendance] Could not resolve student/class for leave', leave.id);
    return;
  }

  const { student, classId, classRoom, academicYearId, semester } = context;
  const leaveNote = buildLeaveNote(leave);
  const dates = eachDateInRange(leave.startDate, leave.endDate);
  const schedules = await loadSchedulesForClass(classId, academicYearId, semester);
  const roster = await loadClassRoster(classId);

  const batch = writeBatch(db);
  let writes = 0;
  const now = new Date().toISOString();

  for (const date of dates) {
    if (!isDateInLeaveRange(date, leave)) continue;

    const schoolDay = dateToSchoolDay(date);
    if (!schoolDay) continue;

    const rollCallDocId = generateRollCallDocId(date, classId);
    const rollCallRef = doc(db, 'morning_rollcall', rollCallDocId);
    const rollCallSnap = await getDoc(rollCallRef);

    let shouldWriteRollCall = true;
    let rollCallAttendance: StudentRollCall[];
    if (rollCallSnap.exists()) {
      rollCallAttendance = [...((rollCallSnap.data() as MorningRollCallSession).attendance ?? [])];
      const idx = rollCallAttendance.findIndex((row) => row.studentId === student.id);
      if (idx >= 0) {
        if (!shouldApplyLeaveStatus(rollCallAttendance[idx].status)) {
          shouldWriteRollCall = false;
        } else {
          rollCallAttendance[idx] = {
            ...rollCallAttendance[idx],
            status: 'leave',
            note: leaveNote,
          };
        }
      } else {
        rollCallAttendance.push(buildStudentRollCallRow(student, 'leave', leaveNote));
      }
    } else {
      rollCallAttendance = roster.map((row) => (
        row.id === student.id
          ? buildStudentRollCallRow(row, 'leave', leaveNote)
          : buildStudentRollCallRow(row, 'unmarked', '')
      ));
    }

    if (shouldWriteRollCall) {
      const rollCallFields = recalcRollCallFields(rollCallAttendance);
      batch.set(rollCallRef, {
        id: rollCallDocId,
        date,
        classId,
        className: classRoom.className,
        departmentId: classRoom.departmentId ?? classRoom.department,
        academicYearId,
        semester,
        recordedBy: SYSTEM_RECORDED_BY,
        recordedByName: SYSTEM_RECORDED_BY_NAME,
        attendance: rollCallAttendance,
        ...rollCallFields,
        updatedAt: now,
        createdAt: rollCallSnap.exists()
          ? ((rollCallSnap.data() as MorningRollCallSession).createdAt ?? now)
          : now,
      }, { merge: true });
      writes += 1;
    }

    const daySchedules = schedules.filter((slot) => slot.day === schoolDay);
    for (const slot of daySchedules) {
      const sessionDocId = buildClassSessionDocId(date, classId, slot.subjectId, slot.period);
      const sessionRef = doc(db, 'class_sessions', sessionDocId);
      const sessionSnap = await getDoc(sessionRef);

      const existingAttendance: StudentAttendance[] = sessionSnap.exists()
        ? [...((sessionSnap.data().attendance ?? []) as StudentAttendance[])]
        : [];

      const idx = existingAttendance.findIndex((row) => row.studentId === student.id);
      const existingStatus = idx >= 0 ? existingAttendance[idx].status : null;
      if (!shouldApplyLeaveStatus(existingStatus)) continue;

      const nextEntry: StudentAttendance = { studentId: student.id, status: 'leave', note: leaveNote };
      if (idx >= 0) existingAttendance[idx] = { ...existingAttendance[idx], ...nextEntry };
      else existingAttendance.push(nextEntry);

      const sessionFields = recalcClassSessionFields(existingAttendance);
      const existingData = sessionSnap.exists() ? sessionSnap.data() : null;

      batch.set(sessionRef, {
        scheduleId: sessionDocId,
        subjectId: slot.subjectId,
        subjectName: slot.subjectName,
        subjectCode: slot.subjectCode,
        classId,
        className: classRoom.className,
        teacherId: slot.teacherId,
        teacherName: slot.teacherName,
        departmentId: classRoom.departmentId ?? classRoom.department,
        academicYearId,
        semester,
        date,
        period: slot.period,
        topic: typeof existingData?.topic === 'string' ? existingData.topic : '',
        attendance: existingAttendance,
        ...sessionFields,
        updatedAt: now,
        createdAt: typeof existingData?.createdAt === 'string' ? existingData.createdAt : now,
      }, { merge: true });
      writes += 1;
    }
  }

  if (writes === 0) return;

  await batch.commit();

  void logActivity({
    action: 'sync_student_leave_attendance',
    category: 'academic',
    status: 'success',
    targetId: leave.id,
    detail: `Synced morning roll call + class attendance for ${student.studentCode || student.id}`,
    metadata: {
      studentId: student.id,
      classId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      writes,
    },
  });
}

export async function syncStudentLeaveAttendanceById(requestId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'leave_requests', requestId));
  if (!snap.exists()) return;
  await syncStudentLeaveAttendance({ id: snap.id, ...snap.data() } as LeaveRequest);
}
