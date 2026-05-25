# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: PMV-ONE — School Management System

React 19 + Firebase app with 6 user roles (sysadmin, admin, teacher, staff, parent, student) all sharing a single unified portal at `/portal`. Permissions are managed via Firestore (`role_permissions` collection), not hardcoded role checks.

---

## Setup & Commands

### Environment Variables

Copy `.env` as-is — it contains Firebase config, Google Calendar API key, and LINE Login credentials. Do not commit sensitive secrets to code; `.env` is already in `.gitignore`.

### Scripts

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run validate:firestore-config   # Validate Firestore config (Node script)
```

**TypeScript:** Strict mode enforced (`tsconfig.app.json`). Run `npm run build` before committing to catch type errors.

**No test runner:** Features are tested manually via the dev server.

---

## Architecture

### Single Portal + Permission Gate

All authenticated users land at `/portal`. The **`PermissionGate`** component (`src/components/PermissionGate.tsx`) guards every route using the `featureKey` → `accessLevel` map loaded from Firestore. Do not use role checks (`role === 'teacher'`) as a substitute — always go through `useMyPermissions()`.

```tsx
// Route protection (redirects if no permission)
<PermissionGate featureKey="grades">...</PermissionGate>

// UI element visibility (hides without redirecting)
<PermissionVisible featureKey="grades" require="edit">...</PermissionVisible>
```

Permission levels: `view-only` → `edit` → `full`. `sysadmin` bypasses all checks.

The canonical feature key list is in `src/types/rolePermission.ts` (`FEATURE_LIST`). When adding a new route, add its `featureKey` there first.

### Routing

The active router is **`src/App.tsx`** (not `src/router/AppRouter.tsx`, which is legacy/unused). All feature pages are lazy-loaded via `React.lazy`. The layout wrapper is `src/components/layouts/PortalLayout.tsx`, which renders the mobile bottom tab bar and the side drawer nav — both configured per role via `ROLE_CONFIG` and `BOTTOM_TAB_CONFIG` inside that file.

```
/login              → LoginPage (public)
/portal             → PortalLayout (protected)
  /portal           → HomePage (widgets, role-aware)
  /portal/users     → UsersPage
  /portal/grades    → GradeBookPage
  ... (see App.tsx for full list)
/exam/:roomId       → StudentExamPage (standalone, no layout)
```

### State Management

- **`useAuthStore`** (Zustand, `src/store/authStore.ts`) — `user`, `userData`, `role`, `isLoading`. Session expiry (6h) managed in `authService.ts` via localStorage.
- **`useAuth`** (`src/hooks/useAuth.ts`) — thin wrapper; `sysadmin` passes any `isAuthorized()` call.
- **React Query** (`@tanstack/react-query`) — all Firestore data fetching. Cache keys always include `academicYearId` + `semester`.
- Local `useState` — UI-only state only.

### Features Directory

Each subdirectory of `src/features/` is a self-contained feature with its own components and may pull from hooks in `src/hooks/`:

| Feature dir | Routes | Key hook |
|---|---|---|
| `auth/` | `/login` | `authService.ts` |
| `home/` | `/portal` | `useRolePermissions` |
| `grades/` | `/portal/grades` | `useGradeBook` |
| `attendance/` | `/portal/attendance`, `/portal/staff-attendance` | `useStaffAttendance`, `useDailySchedules` |
| `schedule/` | `/portal/schedule` | `useSchedule` |
| `curriculum/` | `/portal/curriculum` | `useCurriculum` |
| `syllabus/` | (admin/teacher views) | `useSyllabus`, `useSyllabusManager`, `useTeacherSyllabus` |
| `teachers/` | `/portal/teachers` | (no dedicated hook yet) |
| `students/` | `/portal/students` | `useStudentManager` |
| `exam/` | `/portal/exams`, `/exam/:roomId` | `useExamRoom`, `useQuestionSetBank` |
| `leave/` | `/portal/leave`, `/portal/leave/report` | `useLeaveRequests` |
| `lessonPlan/` | `/portal/lesson-plan` | `useLessonPlan` |
| `duty/` | `/portal/duty-schedule` | — |
| `reports/` | `/portal/reports`, `/portal/report-control` | — |
| `settings/` | `/portal/settings` | — |

---

## Firestore Schema (Critical)

### Design Rule: Flat Collections + Field-based Partitioning

Never create collections named by year (e.g., `students_2569`). All transactional documents must include `academicYearId` and `departmentId` fields.

**Every Level 3 query must filter on `academicYearId` + `semester` + `departmentId`.**

```typescript
// ✓ Correct
query(collection(db, 'grades'),
  where('academicYearId', '==', year),
  where('semester', '==', semester),
  where('studentId', '==', uid))

// ✗ Wrong — full collection scan
query(collection(db, 'grades'), where('studentId', '==', uid))
```

### Collection Levels

**Level 1 — Master Data** (no `academicYearId`): `academic_years`, `departments`, `users`, `subjects`

**Level 2 — Relationship Data**: `classes`, `teachers`, `curriculum_maps`, `enrollments`

**Level 3 — Transactional** (must have `academicYearId` + `departmentId`): `schedules`, `syllabi`, `grades`, `attendance`, `notifications`, `calendar_events`

### Snapshot Pattern

Store denormalized fields on writes to avoid join reads:
```typescript
{ teacherId: 't03', teacherName: 'ครูประเสริฐ', subjectCode: 'M1002', ... }
```

### Composite Indexes (defined in `firestore.indexes.json`)

```
schedules   → academicYearId, semester, departmentId, teacherId
grades      → academicYearId, semester, studentId
syllabi     → academicYearId, semester, departmentId, teacherId
attendance  → academicYearId, classId, date
```

Deploy indexes to Firebase:
```bash
firebase deploy --only firestore:indexes
```

---

## Academic Year Configuration

Active year stored in **localStorage** (migration to Firestore is planned). All data hooks use:

```tsx
const { activeYear, activeSemester, year, isLoaded } = useActiveAcademicYear();
if (!activeYear) return <Alert>กรุณาตั้งค่าปีการศึกษาก่อน</Alert>;
```

SysAdmin configures at `/portal/settings`.

---

## Key Conventions

### Data Fetching Pattern

```tsx
export function useGrades(classId: string) {
  const { year, activeSemester } = useActiveAcademicYear();
  return useQuery({
    queryKey: ['grades', classId, year, activeSemester],
    queryFn: async () => { /* Firestore query with all partition fields */ },
    enabled: !!year && !!activeSemester,
  });
}
```

### Styling

- Tailwind utility classes everywhere.
- Glassmorphism is the system-wide card style — use the exported `GLASS` constant from `PortalLayout.tsx`:
  ```typescript
  import { GLASS } from '@/components/layouts/PortalLayout';
  // background: rgba(255,255,255,0.35), backdropFilter: blur(20px) saturate(180%)
  ```
- Animations: Framer Motion `motion.div` + `variants`.

### Home Page Widgets

`src/features/home/HomePage.tsx` renders role-aware widgets from `src/features/home/widgets/`. Each widget is wrapped in `ProtectedWidget` (checks `featureKey` starting with `widget_`). To add a new widget:
1. Add a `widget_*` entry to `FEATURE_LIST` in `src/types/rolePermission.ts`.
2. Create widget component in `src/features/home/widgets/`.
3. Register it in `HomePage.tsx`.

### Permission System Flow

```
authService.ts → onAuthStateChanged
  → loads user doc from Firestore
  → stores role in authStore
    → useMyPermissions() reads role_permissions/{role} from Firestore
      → PermissionGate / PermissionVisible uses canAccess/canEdit/canDelete helpers
```

`sysadmin` role never calls Firestore for permissions — it short-circuits to `full` for everything.

---

## Known Mock/TODOs in Code

- `MOCK_TEACHER_ID = 't03'` in teacher-scoped hooks → replace with `useAuth().user.uid` when teacher backend is ready.
- Active academic year in localStorage → migrate to Firestore real-time listener.
- **In-memory mock data:** Several features (`curriculum/`, `syllabus/`, `schedule/`) still use hardcoded mock data instead of Firestore:
  - `src/features/curriculum/hooks/useCurriculum.ts` → curriculum maps are mocked
  - `src/features/syllabus/` → syllabus queries return mock documents
  - Subject lists in curriculum/schedule features are not yet integrated with Firestore `subjects` collection
  - These will need Firestore integration when ready for production use.

---

## Firestore Quota Optimizations

### Curriculum Feature (Soft Delete + Admin-Only Listener)

**Applied:** 2026-05-20

- **Soft Delete:** `deleteVersion()` now sets `isDeleted: true` + `deletedAt` instead of hard-deleting. Saves ~90% writes on curriculum deletion.
- **Admin-Only Listener:** `useCurriculumVersioned()` listener only activates for `admin` / `sysadmin` roles. Saves ~80% reads from non-admin users.
- **New Index:** `curriculums(isDeleted)` composite index added to `firestore.indexes.json` — deploy with `firebase deploy --only firestore:indexes`.

See `.claude/CURRICULUM_SOFT_DELETE_MIGRATION.md` for details.

---

## Debugging & Development

### React Query Cache

Inspect cached data in React DevTools → Components tab → click on any component using `useQuery` and check the "Hooks" panel. The `queryKey` always includes `[featureName, ...params]`.

### Firestore State

- Enable Firestore debug logging:
  ```typescript
  import { enableLogging } from 'firebase/firestore';
  enableLogging(true);
  ```
- Use [Firebase Console](https://console.firebase.google.com) to browse live data and run test queries.

### Permission Debugging

Add to any component to see current permissions:
```tsx
const perms = useMyPermissions();
console.log('Current permissions:', perms);
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | All routes + ProtectedRoute logic |
| `src/components/layouts/PortalLayout.tsx` | Shell UI, nav, role configs |
| `src/components/PermissionGate.tsx` | Route + UI access control |
| `src/types/rolePermission.ts` | `FEATURE_LIST` — source of truth for all feature keys |
| `src/store/authStore.ts` | Zustand auth state |
| `src/features/auth/authService.ts` | Firebase auth + session management |
| `src/hooks/useActiveAcademicYear.ts` | Active year/semester (localStorage) |
| `src/hooks/useMyPermissions.ts` | Permission helpers for current user |
| `src/lib/firebase.ts` | Firebase initialization |
| `firestore.indexes.json` | Composite indexes (deploy with Firebase CLI) |
