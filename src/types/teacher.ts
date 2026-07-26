import type { Department } from '@/types/curriculum';

// ── Teacher Status ─────────────────────────────────────────────────────────────

export type TeacherStatus = 'active' | 'inactive';

// ── Teacher Profile ────────────────────────────────────────────────────────────
// รายละเอียดครูแบบเต็ม ใช้ใน Teacher Management Feature
// Teacher ใน schedule.ts เป็น subset ของ TeacherProfile

export interface TeacherProfile {
  id: string;
  name: string;                // ชื่อ-นามสกุลแบบรวม (เพื่อความเข้ากันได้ย้อนหลัง)
  prefix?: string;             // คำนำหน้า: นาย, นาง, นางสาว
  firstName?: string;
  lastName?: string;
  nameEn?: string;
  department: Department;       // ระดับที่สังกัด: 'early' | 'primary' | 'secondary'
  email?: string;
  phone?: string;
  position?: string;            // ตำแหน่งทางวิชาการ เช่น 'ครูชำนาญการ'
  teachingSubjectIds: string[]; // รหัสวิชาที่ได้รับมอบหมาย (อ้างอิง Subject.id)
  status: TeacherStatus;
  photoURL?: string;
  userId?: string;
  lineId?: string;
  lineUserId?: string;
  isLineConnected?: boolean;
  createdAt?: string;           // ISO date string
}

// ── Derived Types ──────────────────────────────────────────────────────────────

export type NewTeacherProfile = Omit<TeacherProfile, 'id' | 'createdAt'>;

export interface TeacherLoadInfo {
  teacherId: string;
  currentHours: number;      // คาบที่สอนจริงในตาราง
  maxHours: number;          // ภาระสูงสุด
  isOverloaded: boolean;     // currentHours > maxHours
  utilizationPct: number;    // 0–100+
}
