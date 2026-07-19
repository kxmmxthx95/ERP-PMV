/**
 * นักเรียนที่ "จบการศึกษา" หรือ "ย้ายออก" จะไม่นับว่ากำลังศึกษา
 * และจะไม่แสดงในรายชื่อนักเรียนที่กำลังศึกษาอยู่
 *
 * ระบบเก็บสถานะไว้ 2 ที่ (legacy):
 *   - `status`        : 'active' | 'inactive' | 'graduated' | 'transferred'
 *   - `currentStatus` : 'active' | 'graduated' | 'left'  (ใช้ในหน้าเลื่อนชั้น/ย้ายออก)
 * ฟังก์ชันด้านล่างรวมทั้งสองฟิลด์ให้ตัดสินใจแบบเดียวกันทุกที่
 */

type StudentStatusLike = {
  status?: string | null;
  currentStatus?: string | null;
};

/** สถานะที่ถือว่า "ออกจากระบบแล้ว" (จบการศึกษา / ย้ายออก) */
export function isInactiveStudent(student: StudentStatusLike): boolean {
  const status = String(student.status ?? '').toLowerCase();
  const currentStatus = String(student.currentStatus ?? '').toLowerCase();

  return (
    status === 'graduated' ||
    status === 'transferred' ||
    currentStatus === 'graduated' ||
    currentStatus === 'left'
  );
}

export type StudentStudyStatus = 'studying' | 'transferred' | 'graduated';

/** นักเรียนที่จบการศึกษาแล้ว */
export function isGraduatedStudent(student: StudentStatusLike): boolean {
  const status = String(student.status ?? '').toLowerCase();
  const currentStatus = String(student.currentStatus ?? '').toLowerCase();

  return status === 'graduated' || currentStatus === 'graduated';
}

/** นักเรียนที่ย้ายออกจากโรงเรียน */
export function isTransferredStudent(student: StudentStatusLike): boolean {
  const status = String(student.status ?? '').toLowerCase();
  const currentStatus = String(student.currentStatus ?? '').toLowerCase();

  return status === 'transferred' || currentStatus === 'left';
}

/** นักเรียนที่ยัง "กำลังศึกษา" อยู่ (ยังไม่จบ/ยังไม่ย้ายออก) */
export function isStudyingStudent(student: StudentStatusLike): boolean {
  return !isInactiveStudent(student);
}

/** นักเรียนที่ควรแสดงในรายชื่อค่าเทอม (กำลังศึกษา หรือย้ายออกแล้ว) */
export function isTuitionRosterStudent(
  student: StudentStatusLike,
  enrollmentStatus?: string | null,
): boolean {
  if (isStudyingStudent(student)) return true;
  if (isTransferredStudent(student)) return true;
  return (enrollmentStatus ?? 'studying') === 'transferred';
}

/** สถานะการเรียนสำหรับแสดงใน UI */
export function resolveStudentStudyStatus(
  student: StudentStatusLike,
  enrollmentStatus?: string | null,
): StudentStudyStatus {
  if (isGraduatedStudent(student) || enrollmentStatus === 'graduated') return 'graduated';
  if (isTransferredStudent(student) || enrollmentStatus === 'transferred') return 'transferred';
  return 'studying';
}
