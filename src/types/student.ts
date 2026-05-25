import type { Department } from '@/types/curriculum';

// ── Student Status ─────────────────────────────────────────────────────────────

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';

export type EnrollmentStatus = 'studying' | 'transferred' | 'graduated';

export type Gender = 'male' | 'female';

export type BloodType = 'A' | 'B' | 'AB' | 'O';

// ── Student (Master Data — ไม่ขึ้นกับปีการศึกษา) ────────────────────────────────

export interface Student {
  id: string;                   // Firebase Auth UID หรือ Firestore auto ID
  studentCode: string;          // เลขประจำตัวนักเรียน เช่น "67001"
  prefix: string;               // "เด็กชาย" | "เด็กหญิง" | "นาย" | "นางสาว"
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  birthDate?: string;           // "YYYY-MM-DD"
  phone?: string;               // เบอร์โทรศัพท์นักเรียน
  email?: string;               // อีเมลนักเรียน
  gender: Gender;
  nationality?: string;
  religion?: string;
  bloodType?: BloodType;
  allergies?: string;
  photoURL?: string;
  address?: string;
  // Detailed Address
  address_houseNo?: string;
  address_moo?: string;
  address_village?: string;
  address_street?: string;
  address_subdistrict?: string;
  address_district?: string;
  address_province?: string;
  address_postalCode?: string;
  // Personal Details
  nickname?: string;
  friends_inSchool1?: string;
  friends_inSchool2?: string;
  friends_outside?: string;
  financial_dailyAllowance?: number;
  financial_dailySavings?: number;
  financial_status?: 'enough' | 'not_enough';
  // Family Details
  familyCount?: number;
  familyMembers?: Array<{
    id: string;
    prefix?: string;
    firstName: string;
    lastName: string;
    relation: string;
    age: number;
    education: string;
    occupation: string;
    income: number;
  }>;
  // Education Details
  edu_favoriteSubject?: string;
  edu_favoriteSubjectReason?: string;
  edu_leastFavoriteSubject?: string;
  edu_leastFavoriteSubjectReason?: string;
  edu_specialTalent?: string;
  edu_gpaxYear1?: number;
  edu_gpaxYear2?: number;
  edu_selfPerception?: 'no_problem' | 'has_problem';
  edu_problemDetail?: string;
  edu_problemCause?: string;
  // Home Visit Details (ตอนที่ 4)
  visit_familyStatus?: 'warm' | 'unwarm';
  visit_bothParentsDeceased?: boolean;
  visit_fatherOrMotherDeceased?: boolean;
  visit_parentsDivorced?: boolean;
  visit_notLivingWithParents?: boolean;
  visit_healthProblem?: boolean;
  visit_healthProblemDetail?: string;
  visit_risks?: string[];
  visit_riskDetail?: string;
  visit_economicProblem?: boolean;
  visit_urgentHelpNeeded?: boolean;
  visit_urgentHelpDetail?: string;
  visit_housingStatus?: 'own' | 'rent' | 'relative' | 'welfare';
  visit_housingType?: 'single_floor' | 'two_floors' | 'others';
  visit_housingTypeDetail?: string;
  visit_communityEnvironment?: 'safe' | 'unsafe';
  visit_homeBehavior?: 'good' | 'disobedient';
  visit_homeResponsibility?: 'has_tasks' | 'no_tasks';
  visit_partTimeIncome?: boolean;
  visit_internetAccess?: boolean;
  visit_learningEquipment?: 'ready' | 'not_ready';
  // แผนที่บ้าน
  address_latitude?: number;
  address_longitude?: number;
  address_mapImageURL?: string;
  // ข้อมูลผู้ปกครอง
  guardianPrefix?: string;      // "นาย" | "นาง" | "นางสาว"
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianPhone?: string;
  guardianRelation?: string;    // "บิดา" | "มารดา" | "ผู้ปกครอง"
  // System
  authUid?: string;             // Firebase Auth UID (อาจต่างจาก id ถ้า id เป็น Firestore auto ID)
  userId?: string;              // alias สำหรับ authUid (legacy)
  status: StudentStatus;
  createdAt: string;            // ISO date string
}

export type NewStudent = Omit<Student, 'id' | 'createdAt'>;

// ── Enrollment (Transaction Data — ขึ้นกับปีการศึกษา) ────────────────────────────
// สอดคล้องกับ CLAUDE.md Firestore Schema Level 3

export interface Enrollment {
  id: string;
  studentId: string;            // ref → students
  classId: string;              // ref → classes
  // Snapshot fields — ลด Firestore reads
  className: string;            // e.g. "ม.3/1"
  gradeLevel: string;           // e.g. "ม.3"
  departmentId: Department;     // ← partition by department
  academicYearId: string;       // ← partition by year
  semester: 1 | 2;
  status: EnrollmentStatus;
  enrolledAt: string;           // ISO date string
}

export type NewEnrollment = Omit<Enrollment, 'id' | 'enrolledAt'>;

// ── Derived View — StudentCard ────────────────────────────────────────────────
// ใช้ใน UI (join student + enrollment)

export interface StudentCard {
  student: Student;
  enrollment: Enrollment | null;   // null ถ้ายังไม่ได้ลงทะเบียนปีนั้น
  currentClass: string | null;     // "ม.3/1"
  currentGrade: string | null;     // "ม.3"
}
