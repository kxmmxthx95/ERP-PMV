import type { Gender } from '@/types/student';

export interface UniversityChoice {
  rank: number;          // 1–5
  universityName: string;
  /** Hipo domain e.g. chula.ac.th — used for logo + myTCAS bridge */
  universityDomain?: string;
  faculty: string;
  program?: string;
  entranceMethod?: string;
  country?: string;      // only for international
}

export type FuturePlanType = 'continue' | 'not_continue';
export type StudyLocation = 'domestic' | 'international';

export interface StudentFuturePlan {
  id: string;            // Firestore doc ID = studentId
  studentId: string;
  studentName: string;   // denormalised snapshot
  studentCode: string;
  photoURL?: string;
  gender?: Gender;
  classId?: string;
  className?: string;
  gradeLevel?: string;
  departmentId?: string;
  academicYearId: string;

  lifeGoal: string;
  desiredCareer: string;
  planType: FuturePlanType;
  studyLocation?: StudyLocation; // only when planType === 'continue'
  /** สาเหตุที่ไม่ศึกษาต่อ — only when planType === 'not_continue' */
  notContinueReason?: string;

  // only present when planType === 'continue'
  universityChoices?: UniversityChoice[];

  createdAt: string;     // ISO string
  updatedAt: string;
}

export interface FuturePlanFormData {
  lifeGoal: string;
  desiredCareer: string;
  planType: FuturePlanType;
  studyLocation: StudyLocation;
  notContinueReason: string;
  universityChoices: UniversityChoice[];
}

export const ENTRANCE_METHODS = [
  'TCAS รอบ 1 Portfolio',
  'TCAS รอบ 2 Quota',
  'TCAS รอบ 3 Admission',
  'TCAS รอบ 4 Direct Admission',
  'สอบตรง (ไม่ผ่าน TCAS)',
  'ทุนการศึกษา',
  'อื่นๆ',
] as const;

export const INTERNATIONAL_ENTRANCE_METHODS = [
  'สมัครตรงกับมหาวิทยาลัย',
  'ทุนรัฐบาล (กพ.)',
  'ทุนมหาวิทยาลัย (Scholarship)',
  'ทุนส่วนตัว',
  'ทุนองค์กร / บริษัท',
  'Exchange Program',
  'อื่นๆ',
] as const;

export const STUDY_COUNTRIES = [
  'สหรัฐอเมริกา',
  'สหราชอาณาจักร',
  'ออสเตรเลีย',
  'ญี่ปุ่น',
  'จีน',
  'สิงคโปร์',
  'แคนาดา',
  'เยอรมนี',
  'ฝรั่งเศส',
  'เกาหลีใต้',
  'นิวซีแลนด์',
  'ไต้หวัน',
  'ฮ่องกง',
  'สวิตเซอร์แลนด์',
  'เนเธอร์แลนด์',
  'อื่นๆ (ระบุเอง)',
] as const;
