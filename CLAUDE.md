# PMV-ONE — School Management System · Claude Guide

## Project Overview

**PMV-ONE** is a comprehensive School Management System built with React + Firebase for managing 6 distinct user roles and their respective portals: Students, Parents, Teachers, Staff, Admins, and System Admins.

**Key Goals:**
- Role-based access control with protected portals
- Real-time data synchronization via Firestore
- Push notifications and announcements (FCM)
- Grade management and academic reporting
- Attendance tracking, scheduling, and course syllabus management

---

## System Architecture

### Architecture Layers

```
┌──────────────────────────────────────────────────────┐
│  React 18 + Tailwind CSS + shadcn/ui (Radix)         │  Client Layer
│  React Router v6 · Zustand · React Query             │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  Firebase Authentication                              │  Auth Layer
│  Custom Claims (role) · Protected Routes             │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  Cloud Firestore — Flat Structure + Reference Fields  │  Database Layer
│  Partitioned by: academicYearId + departmentId       │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  Cloud Functions                                      │  Logic Layer
│  Role assignment · Notifications · Reports           │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  Firebase Storage · Hosting · FCM                    │  Storage & Hosting
└──────────────────────────────────────────────────────┘
```

### Role Hierarchy

```
sysadmin ┐  ← ตั้งค่าระบบ, จัดการผู้ใช้, กำหนดปีการศึกษา, อนุมัติแผนการสอน
admin    ├─  ← บริหารโรงเรียน, ดูรายงาน, จัดการครู
teacher  ├─  ← สร้างแผนการสอน, กรอกเกรด, บันทึกเข้าเรียน
staff    ├─  ← จัดการเอกสาร, ดูตารางงาน
parent   ├─  ← ดูข้อมูลบุตรหลาน
student  └─  ← ดูเกรด, ตารางเรียน, แจ้งเตือน
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 18 | Component-based UI with hooks |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Components** | shadcn/ui (Radix) | Accessible pre-built components (55 components) |
| **Routing** | React Router v6 | Protected routes with role-based access |
| **State** | Zustand | Global state (auth, UI) |
| **Data Fetching** | React Query | Server state, caching, synchronization |
| **Backend** | Firebase | Auth, Firestore, Storage, Functions, FCM |
| **Charts** | Recharts | Analytics and grade visualizations |
| **Date** | date-fns + th locale | Thai Buddhist calendar formatting |
| **Animation** | Framer Motion | Page transitions, micro-interactions |
| **Export** | jsPDF, xlsx | PDF and Excel report generation |
| **Build** | Vite | Fast bundling and HMR |

---

## Directory Structure

```
src/
├── components/
│   ├── layout/              # DashboardLayout, DashboardSidebar, PortalLayout
│   └── ui/                  # shadcn/ui components (55 components)
├── features/
│   ├── auth/                # Login, AuthContext, authService
│   ├── calendar/            # Academic calendar + Thai holidays
│   ├── curriculum/          # Subject master + Curriculum map
│   ├── schedule/            # Timetable editor + conflict detection
│   ├── syllabus/            # Course syllabus (teacher + admin views)
│   └── teachers/            # Teacher management + subject assignment
├── portals/
│   ├── admin/               # /admin portal
│   ├── parent/              # /parent portal
│   ├── staff/               # /staff portal
│   ├── student/             # /student portal
│   ├── sysadmin/            # /sysadmin portal + settings
│   └── teacher/             # /teacher portal (TeacherSyllabusPage, etc.)
├── hooks/                   # Custom hooks (see list below)
├── lib/                     # firebase.ts, utils.ts
├── router/                  # AppRouter.tsx, ProtectedRoute.tsx
├── store/                   # Zustand stores (authStore, uiStore)
└── types/                   # TypeScript interfaces
    ├── calendar.ts
    ├── curriculum.ts
    ├── schedule.ts
    ├── syllabus.ts
    ├── teacher.ts
    └── user.ts
```

### Key Custom Hooks

| Hook | Purpose |
|------|---------|
| `useActiveAcademicYear` | ดึงปีการศึกษา + ภาคเรียนที่ active (จาก localStorage) |
| `useCurriculum` | CRUD รายวิชา + curriculum map |
| `useCurriculumManager` | Orchestrator สำหรับหน้า Curriculum UI |
| `useTeacherManager` | CRUD ครู + กำหนดวิชาที่รับผิดชอบ |
| `useSchedule` | CRUD ตารางสอน + conflict detection |
| `useScheduleManager` | Orchestrator สำหรับหน้า Schedule UI |
| `useSyllabus` | CRUD แผนการสอน + teaching week calculator |
| `useSyllabusManager` | Orchestrator admin/sysadmin (join ข้อมูล 4 features) |
| `useTeacherSyllabus` | Orchestrator teacher-specific (กรองเฉพาะครูคนปัจจุบัน) |
| `useAcademicCalendar` | CRUD events + Thai holidays (Google Calendar API) |
| `useSchoolStructure` | Grade levels, departments, semesters |

---

## Authentication & Authorization

### Login Flow

1. **User Login** → Email/Password or Google Sign-In
2. **Firebase Auth** → Authenticates user, retrieves `idToken`
3. **Custom Claims** → Firebase Auth stores `role` in custom claims `{ role: "teacher" }`
4. **Role Detection** → React reads `user.getIdTokenResult()` → `claims.role`
5. **ProtectedRoute** → Validates role, redirects to appropriate portal
6. **Firestore Rules** → Enforces data access at database level

### Key Points

- **Roles:** `student` | `parent` | `teacher` | `staff` | `admin` | `sysadmin`
- **Custom Claims** set server-side via Cloud Functions
- **ProtectedRoute** wraps all portal pages:
  ```tsx
  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
    <TeacherDashboard />
  </ProtectedRoute>
  ```
- **Firestore Rules** are the source of truth — never trust client-side checks alone

---

## Firestore Database Schema ⚠️ CRITICAL

### Design Principle: Flat Structure + Reference Fields

**ไม่ใช้** Collection แยกตามปี (เช่น `students_2569`) เพราะ query ข้ามปีลำบากและ Security Rules ซับซ้อน

**ใช้** Field-based Partitioning แทน — ทุก document มีฟิลด์ `academicYearId` และ `departmentId` เพื่อให้ filter ได้ด้วย Compound Query

```
✗ WRONG  → students_2569/  students_2570/   (Collection per year)
✓ CORRECT → students/ { academicYearId: "2569", departmentId: "secondary", ... }
```

---

### Level 1 — Master Data (ข้อมูลหลักที่คงที่ ไม่ขึ้นกับปีการศึกษา)

#### `academic_years`
```typescript
{
  id: string;              // e.g. "2569"
  year: string;            // "2569" (Buddhist calendar)
  label: string;           // "ปีการศึกษา 2569"
  startDate: string;       // "YYYY-MM-DD"
  endDate: string;         // "YYYY-MM-DD"
  termCount: 2 | 3;
  activeSemester: 1 | 2 | 3;
  isActive: boolean;       // มีได้แค่ 1 ตัว
  status: "active" | "archived";
}
```

#### `departments`
```typescript
{
  id: string;              // "early" | "primary" | "secondary"
  name: string;            // "ปฐมวัย" | "ประถมศึกษา" | "มัธยมศึกษา"
  color: string;           // สำหรับ UI
  grades: string[];        // ["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"]
}
```

#### `users`
```typescript
{
  uid: string;             // Firebase Auth UID (same as document ID)
  displayName: string;
  email: string;
  role: "student" | "parent" | "teacher" | "staff" | "admin" | "sysadmin";
  isActive: boolean;
  createdAt: Timestamp;
  // ไม่มี academicYearId — user เป็น Master Data
}
```

#### `subjects` (Master Subject List — วิชาทั้งหมดในระบบ)
```typescript
{
  id: string;
  code: string;            // "M1002"
  name: string;            // "คณิตศาสตร์"
  nameEn?: string;
  credits: number;
  hoursPerWeek: number;
  departmentId: string;    // "secondary"  ← partition by department
  category: "core" | "added" | "elective" | "activity";
  description?: string;
}
```

---

### Level 2 — Relationship Data (การเชื่อมโยง ปี + แผนก + บุคลากร)

#### `classes` ⭐ จุดเชื่อมกลางของระบบ
```typescript
{
  id: string;
  className: string;          // "ม.3/1"
  gradeLevel: string;         // "ม.3"
  departmentId: string;       // "secondary"  ← partition by department
  academicYearId: string;     // "2569"       ← partition by year
  homeroomTeacherId: string;  // ref → users
  studentIds: string[];       // ref → students (ถ้าไม่เยอะ) หรือใช้ enrollments
  maxStudents: number;
  room?: string;
}
```

#### `teachers` (Teacher Profiles — ข้อมูลเพิ่มเติมจาก users)
```typescript
{
  id: string;                  // same as users.uid
  employeeCode: string;        // "T001"
  departmentId: string;        // "secondary"
  position: string;            // "ครูชำนาญการ"
  teachingSubjectIds: string[]; // ref → subjects (วิชาที่รับผิดชอบ)
  maxHoursPerWeek: number;
  status: "active" | "inactive";
  phone?: string;
}
```

#### `curriculum_maps` (หลักสูตรต่อชั้นปีต่อภาคเรียน)
```typescript
{
  id: string;
  gradeLevel: string;       // "ม.3"
  departmentId: string;     // "secondary"
  academicYearId: string;   // "2569"
  semester: 1 | 2;
  subjectIds: string[];     // ref → subjects
}
```

#### `enrollments` (นักเรียน → ห้องเรียน → ปีการศึกษา)
```typescript
{
  id: string;
  studentId: string;        // ref → users (role: student)
  classId: string;          // ref → classes
  academicYearId: string;   // "2569"  ← partition by year
  departmentId: string;     // "secondary"
  semester: 1 | 2;
  status: "studying" | "transferred" | "graduated";
  enrolledAt: Timestamp;
}
```

---

### Level 3 — Transactional Data (ข้อมูลที่เปลี่ยนบ่อย)

> **กฎเหล็ก:** ทุก document ใน Level 3 **ต้องมี** `academicYearId` และ `departmentId` เสมอ

#### `schedules` (ตารางสอน)
```typescript
{
  id: string;
  classId: string;          // ref → classes
  subjectId: string;        // ref → subjects
  teacherId: string;        // ref → users
  departmentId: string;     // "secondary"  ← partition
  academicYearId: string;   // "2569"       ← partition
  semester: 1 | 2;
  dayOfWeek: 1 | 2 | 3 | 4 | 5;  // 1=จันทร์
  period: number;           // 1–9
  room?: string;
  // Snapshot fields (ลด reads)
  subjectName: string;
  subjectCode: string;
  teacherName: string;
}
```

#### `syllabi` (แผนการสอน)
```typescript
{
  id: string;
  subjectId: string;        // ref → subjects
  teacherId: string;        // ref → users
  classId?: string;         // ref → classes (ถ้าเชื่อมกับห้อง)
  departmentId: string;     // "secondary"  ← partition
  academicYearId: string;   // "2569"       ← partition
  semester: 1 | 2;
  gradeLevel: string;       // "ม.3"
  // Content
  description: string;
  objectives: string[];
  weeklyPlan: WeeklyPlan[];
  assessment: { classwork: number; midterm: number; final: number };
  status: "draft" | "submitted" | "approved";
  // Snapshots
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `grades` (คะแนน/เกรด)
```typescript
{
  id: string;
  studentId: string;        // ref → users
  subjectId: string;        // ref → subjects
  teacherId: string;        // ref → users
  classId: string;          // ref → classes
  departmentId: string;     // ← partition
  academicYearId: string;   // ← partition
  semester: 1 | 2;
  score: number;            // 0–100
  grade: "A" | "B+" | "B" | "C+" | "C" | "D+" | "D" | "F";
  type: "classwork" | "midterm" | "final";
  recordedAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `attendance` (การเข้าเรียน)
```typescript
{
  id: string;
  studentId: string;        // ref → users
  classId: string;          // ref → classes
  scheduleId: string;       // ref → schedules
  departmentId: string;     // ← partition
  academicYearId: string;   // ← partition
  semester: 1 | 2;
  date: string;             // "YYYY-MM-DD"
  period: number;
  status: "present" | "absent" | "late" | "excused";
  recordedBy: string;       // ref → users (teacher)
  note?: string;
}
```

#### `notifications`
```typescript
{
  id: string;
  title: string;
  body: string;
  type: "announcement" | "grade" | "attendance" | "system";
  targetRoles: string[];    // ["student", "parent"]
  targetUIDs?: string[];    // specific users
  departmentId?: string;    // optional — ถ้าส่งเฉพาะแผนก
  academicYearId?: string;  // optional
  createdBy: string;        // ref → users
  readBy: string[];         // array ของ UIDs ที่อ่านแล้ว
  createdAt: Timestamp;
}
```

#### `calendar_events` (ปฏิทินการศึกษา)
```typescript
{
  id: string;
  title: string;
  startDate: string;        // "YYYY-MM-DD"
  endDate: string;
  type: "holiday" | "exam" | "activity" | "deadline";
  academicYearId: string;   // ← partition
  targetRoles: string[];
  description?: string;
  createdBy: string;
}
```

---

### Compound Query Patterns ⚠️ ต้องสร้าง Composite Index ใน Firestore

```typescript
// ✓ CORRECT — ครบ partition fields
const schedules = await db.collection('schedules')
  .where('academicYearId', '==', activeYear)
  .where('semester', '==', semester)
  .where('departmentId', '==', 'secondary')
  .where('teacherId', '==', teacherId)
  .get();

// ✓ CORRECT — ดูเกรดของนักเรียนในปีนั้น
const grades = await db.collection('grades')
  .where('academicYearId', '==', activeYear)
  .where('semester', '==', semester)
  .where('studentId', '==', studentId)
  .get();

// ✓ CORRECT — ดู syllabus ของครูในแผนกมัธยม
const syllabi = await db.collection('syllabi')
  .where('academicYearId', '==', activeYear)
  .where('departmentId', '==', 'secondary')
  .where('teacherId', '==', teacherId)
  .get();

// ✗ WRONG — ขาด partition fields → Full collection scan
const grades = await db.collection('grades')
  .where('studentId', '==', studentId)
  .get();
```

### Required Composite Indexes

```
Collection      Fields (in order)
─────────────────────────────────────────────────────
schedules       academicYearId ASC, semester ASC, departmentId ASC, teacherId ASC
grades          academicYearId ASC, semester ASC, studentId ASC
grades          academicYearId ASC, semester ASC, classId ASC, subjectId ASC
syllabi         academicYearId ASC, semester ASC, departmentId ASC, teacherId ASC
attendance      academicYearId ASC, classId ASC, date ASC
enrollments     academicYearId ASC, classId ASC, status ASC
```

---

## Academic Year Configuration ⚠️ CRITICAL

### Overview

The **Academic Year Setting** is a fundamental system configuration. All academic data queries **MUST** filter by `academicYearId` + `semester`.

### How It Works

1. **SysAdmin** ตั้งค่าที่ `/sysadmin/settings` → AcademicYearTab
2. Active year เก็บใน **localStorage** (migration to Firestore planned)
3. ทุก component เข้าถึงผ่าน `useActiveAcademicYear()` hook

```tsx
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';

const { activeYear, activeSemester, year, isLoaded } = useActiveAcademicYear();

// Hook returns:
// activeYear    → AcademicYear object | null
// activeSemester → 1 | 2 | 3 | null
// year          → "2569" | null
// isLoaded      → boolean
```

### Best Practices

```tsx
// 1. Guard ก่อน query เสมอ
const { activeYear, activeSemester } = useActiveAcademicYear();
if (!activeYear) return <Alert>กรุณาตั้งค่าปีการศึกษาก่อน</Alert>;

// 2. ใส่ partition fields ทุกครั้ง
const q = query(
  collection(db, 'grades'),
  where('academicYearId', '==', activeYear.year),
  where('semester', '==', activeSemester),
  where('departmentId', '==', departmentId),   // ← เพิ่มจากเดิม
);

// 3. เมื่อสร้าง document ใหม่ — ใส่ partition fields เสมอ
const newDoc = {
  ...data,
  academicYearId: activeYear.year,
  semester: activeSemester,
  departmentId: teacher.department,  // ← เพิ่มจากเดิม
};
```

---

## Feature Access Matrix

| Feature | Student | Parent | Teacher | Staff | Admin | SysAdmin |
|---------|---------|--------|---------|-------|-------|----------|
| ดูเกรดตัวเอง | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| กรอกเกรด | ✗ | ✗ | ✓ | ◐ | ✗ | ✓ |
| บันทึกเข้าเรียน | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| จัดการตารางสอน | ✗ | ✗ | ✗ | ✗ | ◐ | ✓ |
| สร้างแผนการสอน | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| อนุมัติแผนการสอน | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| จัดการหลักสูตร | ✗ | ✗ | ✗ | ✗ | ◐ | ✓ |
| จัดการครู | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| จัดการผู้ใช้ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| ตั้งค่าระบบ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| ดูแจ้งเตือน | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Legend:** ✓ Full | ◐ Partial | ✗ No access

---

## Firestore Security Rules Pattern

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ──────────────────────────────────────────────
    function isAuth() { return request.auth != null; }
    function role()   { return request.auth.token.role; }
    function uid()    { return request.auth.uid; }
    function isRole(r){ return isAuth() && role() == r; }
    function isAdmin(){ return isRole('admin') || isRole('sysadmin'); }

    // ── academic_years (sysadmin write, all read) ─────────────────────
    match /academic_years/{yearId} {
      allow read:  if isAuth();
      allow write: if isRole('sysadmin');
    }

    // ── syllabi (teacher เขียนเฉพาะของตัวเอง, admin อนุมัติ) ──────────
    match /syllabi/{syllabusId} {
      allow read:  if isAuth();
      allow create: if isRole('teacher')
                    && request.resource.data.teacherId == uid();
      allow update: if (isRole('teacher') && resource.data.teacherId == uid()
                        && resource.data.status == 'draft')
                    || isAdmin();
      allow delete: if isAdmin();
    }

    // ── grades (teacher เขียนเฉพาะวิชาที่รับผิดชอบ) ──────────────────
    match /grades/{gradeId} {
      allow read:  if isAdmin()
                   || (isRole('teacher') && resource.data.teacherId == uid())
                   || (isRole('student') && resource.data.studentId == uid())
                   || (isRole('parent'));  // ต้อง verify parentId
      allow write: if isRole('teacher') && request.resource.data.teacherId == uid();
      allow delete: if isAdmin();
    }

    // ── schedules (sysadmin/admin write) ─────────────────────────────
    match /schedules/{scheduleId} {
      allow read:  if isAuth();
      allow write: if isAdmin();
    }

    // ── attendance ────────────────────────────────────────────────────
    match /attendance/{attendanceId} {
      allow read:  if isAdmin()
                   || (isRole('teacher') && resource.data.recordedBy == uid())
                   || (isRole('student') && resource.data.studentId == uid());
      allow create: if isRole('teacher');
      allow update: if isRole('teacher') && resource.data.recordedBy == uid();
    }
  }
}
```

---

## Important Conventions & Guidelines

### 1. Component Organization
- **`src/components/ui/`** → shadcn/ui components (pure UI, no business logic)
- **`src/components/layout/`** → DashboardLayout, Sidebar (shell UI)
- **`src/features/{feature}/`** → Feature-specific components + hooks
- **`src/portals/{role}/`** → Page-level components per role
- **`src/hooks/`** → All custom hooks (data fetching, state orchestration)

### 2. Data Fetching Pattern
```tsx
// ใช้ React Query + custom hook
export function useGrades(classId: string) {
  const { year, activeSemester } = useActiveAcademicYear();
  return useQuery({
    queryKey: ['grades', classId, year, activeSemester],
    queryFn: async () => {
      const q = query(
        collection(db, 'grades'),
        where('academicYearId', '==', year),
        where('semester', '==', activeSemester),
        where('classId', '==', classId),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!year && !!activeSemester,
  });
}
```

### 3. Hook → Component Data Flow
```
useSyllabus (CRUD + week calculator)
    ↓
useSyllabusManager (admin: join curriculum + teacher + calendar)
useteacherSyllabus (teacher: filter by current user + schedule days)
    ↓
SyllabusManager / TeacherSyllabusPage
    ↓
SyllabusEditorPanel → SyllabusCalendarView (calendar weekly plan)
```

### 4. State Management
- **Zustand** → `authStore` (auth state, role, token), `uiStore` (modals, sidebar)
- **React Query** → Server state (Firestore data), caching, invalidation
- **Local useState** → UI-only state (open/close, selected item)

### 5. TypeScript
- All Firestore documents must be typed in `src/types/`
- Use snapshot pattern in hooks (store denormalized fields for fewer reads):
  ```typescript
  // ✓ Store snapshot — ลด Firestore reads
  { teacherId: "t03", teacherName: "ครูประเสริฐ", ... }
  // ✗ ไม่ต้อง join ทุกครั้ง — ข้อมูล teacher ไม่ค่อยเปลี่ยน
  ```

### 6. Security
- **Never** store sensitive data in localStorage without encryption
- **Never** trust client-side role checks — Firestore Rules คือ source of truth
- **Always** validate `academicYearId` + `departmentId` ก่อน write
- Academic year settings in localStorage → migrate to Firestore ใน production

### 7. Styling
- Tailwind utility classes เป็นหลัก
- Glassmorphism pattern ใช้ทั่วระบบ:
  ```typescript
  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(24px) saturate(150%)',
    border: '1px solid rgba(255,255,255,0.90)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
  };
  ```
- Animation: Framer Motion `motion.div` + `variants` pattern

---

## Feature Integration Map

```
Academic Calendar ──────────────────────────────────┐
  (holidays, exams, semester dates)                  │
                                                     ▼
Curriculum ──→ Subject Master ──→ Curriculum Map ──→ Syllabus
  (subjects)    (code/credits)    (grade+semester)   (weekly plan)
                                                     ▲
Teacher Mgmt ──→ teachingSubjectIds ────────────────┘
  (who teaches what)
                     ↓
Schedule ──→ teachingDays ──→ SyllabusCalendarView
  (Mon/Wed/Fri?)              (highlight teaching days)
                     ↓
Grade System ──→ assessment schema
  (30/30/40)       (classwork/midterm/final)
```

---

## Development Workflow

### Setup
```bash
npm install
npm run dev      # Vite dev server
```

### Building
```bash
npm run build
npm run preview
```

### Environment Variables (`.env`)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | Firebase initialization |
| `src/store/authStore.ts` | Zustand auth state |
| `src/hooks/useActiveAcademicYear.ts` | Active year/semester (localStorage) |
| `src/hooks/useCurriculum.ts` | Subject + CurriculumMap CRUD |
| `src/hooks/useTeacherManager.ts` | Teacher CRUD + subject assignment |
| `src/hooks/useSchedule.ts` | Schedule CRUD + conflict detection |
| `src/hooks/useSyllabus.ts` | Syllabus CRUD + teaching week calculator |
| `src/hooks/useTeacherSyllabus.ts` | Teacher-scoped syllabus orchestrator |
| `src/router/AppRouter.tsx` | All route definitions |
| `src/components/layout/DashboardSidebar.tsx` | Sidebar nav (ROLE_CONFIGS) |
| `src/portals/sysadmin/settings/types.ts` | AcademicYear interface |
| `src/types/syllabus.ts` | CourseSyllabus, WeeklyPlan, AssessmentSchema |
| `src/types/teacher.ts` | TeacherProfile, TeacherLoadInfo |

---

## Migration Roadmap (localStorage → Firestore)

| Feature | Current | Production |
|---------|---------|------------|
| Active Academic Year | localStorage | `academic_years` collection + real-time listener |
| Subjects/Curriculum | in-memory mock | `subjects` + `curriculum_maps` collections |
| Teacher profiles | in-memory mock | `teachers` collection (sub of users) |
| Schedule entries | in-memory mock | `schedules` collection |
| Syllabi | in-memory mock | `syllabi` collection |
| Calendar events | in-memory mock | `calendar_events` + Google Calendar API |
| Auth teacher ID | hardcoded `t03` | `useAuth().user.uid` |

---

## Notes for AI Assistants

- ระบบนี้เป็น **role-based multi-portal** — ตรวจสอบ role hierarchy ก่อนแก้ไขเสมอ
- **Firestore Schema** ใช้ Flat Structure + Reference Fields — ห้ามสร้าง Collection แยกตามปี
- **ทุก query ต้อง filter** ด้วย `academicYearId` + `semester` + `departmentId`
- **Snapshot pattern** — เก็บ denormalized fields (teacherName, subjectCode) เพื่อลด reads
- **Teacher Portal** → ครูเห็นเฉพาะข้อมูลของตัวเอง (filter by `teacherId == auth.uid`)
- **อย่าแก้ auth flow** — เป็นฐานของทุกอย่าง
- **MOCK_TEACHER_ID = 't03'** ใน TeacherSyllabusPage.tsx → แทนด้วย `useAuth().user.uid` เมื่อ backend พร้อม
- `useTeacherManager.scheduleTeachers` ส่งข้อมูลครูไปยัง `useScheduleManager` → `ScheduleSlotModal` (filter ครูตามวิชาที่เลือก)
