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

/** นักเรียนที่ยัง "กำลังศึกษา" อยู่ (ยังไม่จบ/ยังไม่ย้ายออก) */
export function isStudyingStudent(student: StudentStatusLike): boolean {
  return !isInactiveStudent(student);
}
