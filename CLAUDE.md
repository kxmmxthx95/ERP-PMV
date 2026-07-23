# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: PMV-ONE — School Management System

React 19 + Firebase app with 6 user roles (sysadmin, admin, teacher, staff, parent, student) all sharing a single unified portal at `/portal`. Permissions are managed via Firestore (`role_permissions` collection), not hardcoded role checks.

---

## Setup & Commands

### Prerequisites

- **Node.js:** 22+ required for Cloud Functions (`src/functions/`); main app works with any recent Node version
- **Firebase CLI:** Install for local emulator and deployments: `npm install -g firebase-tools`

### Environment Variables

Root `.env` contains Firebase config, Google Calendar API key, and LINE Login credentials. Do not commit sensitive secrets; `.env` is already in `.gitignore`. Copy `.env` from a team member if setting up locally.

### Main App Scripts

```bash
npm run dev                           # Vite dev server on http://localhost:3000
npm run build                         # TypeScript check + Vite build (run before committing)
npm run lint                          # ESLint; use --fix to auto-fix issues
npm run preview                       # Preview production build locally
npm run validate:firestore-config     # Validate Firestore schema + indexes
```

**TypeScript:** Strict mode enforced. Rules like `noUnusedLocals`, `noUnusedParameters` are errors. **Always run `npm run build` before committing** — it performs full type checking and will catch issues that the IDE might miss.

**No test runner:** Features are tested manually via the dev server.

### Firebase & Cloud Functions

Cloud Functions live in `src/functions/` with their own `package.json`, TypeScript config, and build process. They require **Node 22**.

```bash
# From project root:
npm run backfill:class-sessions                      # Backfill missing class session records
npm run cleanup:staff-attendance-duplicates          # Remove duplicate attendance records
npm run cleanup:staff-attendance-duplicates:dry-run  # Preview cleanup without applying
npm run validate:firestore-config                    # Validate Firestore indexes & schema

# From src/functions/:
npm run build          # TypeScript → lib/
npm run build:watch    # Watch mode during development
npm run serve          # Run emulator locally (requires firebase-tools)
npm run deploy         # Deploy functions to Firebase
npm run logs           # Stream production function logs
```

**Before running migrations:** Always do a dry-run first and review what will change. Backup Firestore data if possible.

### Path Alias

Use `@/` to import from `src/` (configured in `vite.config.ts`):
```tsx
import { PermissionGate } from '@/components/PermissionGate';  // ✓
import { PermissionGate } from '../components/PermissionGate'; // ✗
```

---

## Firebase Setup & Firestore Indexes

### Initial Setup

1. Get `.env` with Firebase config from a team member
2. Install Firebase CLI: `npm install -g firebase-tools`
3. Authenticate: `firebase login`
4. Verify config: `npm run validate:firestore-config`

### Deploying Indexes

Composite indexes are defined in `firestore.indexes.json`. They are **required** for efficient queries on `schedules`, `grades`, `syllabi`, and `attendance` collections:

```bash
firebase deploy --only firestore:indexes
```

This is safe to run locally — it just creates indexes in your Firebase project, doesn't mutate data. Check [Firebase Console](https://console.firebase.google.com) → Firestore → Indexes to see deployment status.

### Local Emulator (Optional)

To test locally without hitting live Firebase:

```bash
firebase emulators:start
```

Then point your app to the local emulator by setting environment variables in your `.env.local` or modifying `src/lib/firebase.ts`.

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
/login                    → LoginPage (public)
/line/connect             → LineConnectPage (public)
/portal                   → PortalLayout (protected)
  /portal                 → HomePage (widgets, role-aware)
  /portal/users           → UsersPage
  /portal/logs            → LogsPage
  /portal/roles           → RolePermissionManager
  /portal/calendar        → AcademicCalendar
  /portal/curriculum      → CurriculumManager
  /portal/schedule        → ScheduleEditor
  /portal/teachers        → TeacherManager
  /portal/lesson-plan     → LessonPlanManager
  /portal/classes         → ClassManager
  /portal/students        → StudentManager
  /portal/profile         → ProfilePage
  /portal/teaching        → TeachingManager
  /portal/exams           → ExamManager
  /portal/question-bank   → QuestionBankManager
  /portal/grades          → GradeBookPage
  /portal/attendance      → AttendanceCenterPage
  /portal/staff-attendance → StaffAttendancePage
  /portal/morning-rollcall → MorningRollCallPage
  /portal/leave           → LeaveManagementPage
  /portal/leave/report    → LeaveReportPage
  /portal/duty-schedule   → DutySchedulePage
  /portal/report-control  → ReportControlCenter
  /portal/announcements   → AnnouncementsPage
  /portal/feedback        → FeedbackPage
  /portal/settings        → SettingsPage (sysadmin, require='full')
  /portal/migrate         → CourseMigrationTool (sysadmin, require='full')
/exam/:roomId             → StudentExamPage (standalone, no layout)
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
| `announcements/` | `/portal/announcements` | `useAnnouncements` |
| `attendance/` | `/portal/attendance`, `/portal/staff-attendance`, `/portal/morning-rollcall` | `useStaffAttendance`, `useDailySchedules`, `useMorningRollCall` |
| `calendar/` | `/portal/calendar` | `useAcademicCalendar` |
| `classes/` | `/portal/classes` | `useSchoolStructure` |
| `curriculum/` | `/portal/curriculum` | `useCurriculum`, `useCurriculumVersioned` |
| `duty/` | `/portal/duty-schedule` | — |
| `exam/` | `/portal/exams`, `/exam/:roomId` | `useExamRoom`, `useQuestionSetBank` |
| `feedback/` | `/portal/feedback` | `useStudentFeedback` |
| `grades/` | `/portal/grades` | `useGradeBook` |
| `leave/` | `/portal/leave`, `/portal/leave/report` | `useLeaveRequests` |
| `lessonPlan/` | `/portal/lesson-plan` | `useLessonPlan` |
| `logs/` | `/portal/logs` | — |
| `profile/` | `/portal/profile`, `/line/connect` | — |
| `questionBank/` | `/portal/question-bank` | `useQuestionSetBank`, `useSetQuestions` |
| `reports/` | `/portal/report-control` | — |
| `roles/` | `/portal/roles` | `useRolePermissions` |
| `schedule/` | `/portal/schedule` | `useSchedule` |
| `settings/` | `/portal/settings`, `/portal/migrate` | — |
| `students/` | `/portal/students` | `useStudentManager` |
| `syllabus/` | (admin/teacher views) | `useSyllabus`, `useSyllabusManager`, `useTeacherSyllabus` |
| `teachers/` | `/portal/teachers` | — |
| `teaching/` | `/portal/teaching` | `useTeachingManager` |
| `users/` | `/portal/users` | `useUserForm` |

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

- Tailwind utility classes everywhere. Use `cn()` from `src/lib/utils.ts` (wraps `clsx` + `tailwind-merge`) to conditionally join classes.
- Glassmorphism is the system-wide card style. Two sources:
  - `GLASS` from `@/components/layouts/PortalLayout` — the portal shell's translucent card style
  - `glassStyles`, `typography`, `spacing`, `colors` from `@/lib/designTokens` — richer set of tokens (card/panel variants, label/sectionTitle text styles, border radius, color palette)
- Animations: Framer Motion `motion.div` + `variants`.
- Icons: Prefer `react-icons/hi2` for all new UI work. Do not introduce new `lucide-react` imports in newly created code.

### UI Components: Never Hand-Roll — Always Import from `components/ui/`

`src/components/ui/` is a full shadcn/ui primitive set (button, card, dialog, form, input, etc.) already wired to the theme. For buttons, forms, cards, and modals/dialogs:

- **NEVER** write a new Tailwind-styled `<button>`, `<div className="rounded-lg border ...">` card, or custom modal from scratch.
- **ALWAYS** import the existing primitive: `Button` from `@/components/ui/button`, `Card`/`CardHeader`/`CardContent` from `@/components/ui/card`, `Dialog`/`AlertDialog` from `@/components/ui/dialog` / `@/components/ui/alert-dialog`, `Form`/`Field` from `@/components/ui/form` / `@/components/ui/field`.
- Need a variant that doesn't exist (e.g. a new button color/size)? Edit the source component in `src/components/ui/` itself — don't override with one-off classes at the call site. One edit propagates system-wide.
- Check `src/components/ui/` before writing any new interactive element — most needs (accordion, combobox, drawer, popover, pagination, etc.) already exist there.

### Color: CSS Variables Only, No Hardcoded Hex

Theme colors are defined once in `src/index.css` as CSS variables (`:root` block, mapped through `@theme inline` to Tailwind color utilities):

```css
--primary: oklch(0.205 0 0);
--destructive: oklch(0.577 0.245 27.325);
```

- **NEVER** hardcode a color value in a component (`text-[#ef4444]`, `bg-[#3b82f6]`, inline `style={{ color: '#...' }}`).
- **ALWAYS** use the semantic Tailwind class instead: `text-primary`, `bg-destructive`, `border-border`, `text-muted-foreground`, etc.
- To rebrand (e.g. change the school's institutional color), edit the variables in `src/index.css` once — every component using `primary`/`destructive`/etc. updates automatically.

### Home Page Widgets

`src/features/home/HomePage.tsx` renders role-aware widgets from `src/features/home/widgets/`. Each widget is wrapped in `ProtectedWidget` (checks `featureKey` starting with `widget_`). To add a new widget:
1. Add a `widget_*` entry to `FEATURE_LIST` in `src/types/rolePermission.ts`.
2. Create widget component in `src/features/home/widgets/`.
3. Register it in `HomePage.tsx`.

### Local Cache Layer

`src/lib/sessionCache.ts` wraps `localStorage` with a 1-hour TTL. Use it to avoid redundant Firestore reads for slow-changing data (e.g. schedules, subjects). Call `sessionCache.invalidate(key)` after any write to that data.

### Audit Logging

All significant user actions (create/update/delete) should call `logEvent()` from `src/lib/activityLogger.ts`. Logs land in Firestore `activity_logs/{date}` and are visible at `/portal/logs`. Supply `action`, `category` (`academic`, `user`, `data`, etc.), `status`, and `targetId`.

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

### Type Errors

Before pushing, always run `npm run build` to catch type errors. The IDE may not flag all strict mode violations:

```bash
npm run build            # Full type check
npm run lint --fix       # Fix auto-fixable lint issues
```

### React Query Cache

Inspect cached data in React DevTools → Components tab → click on any component using `useQuery` and check the "Hooks" panel. The `queryKey` always includes `[featureName, ...params]`.

To manually trigger a refetch in the browser console:
```javascript
import { queryClient } from '@/lib/queryClient'; // (if exported)
queryClient.invalidateQueries({ queryKey: ['grades'] });
```

### Firestore State

- Enable debug logging temporarily:
  ```typescript
  import { enableLogging } from 'firebase/firestore';
  enableLogging(true); // writes detailed logs to console
  ```
- Use [Firebase Console](https://console.firebase.google.com) → Firestore to browse live data and run test queries
- Check composite index status: Console → Firestore → Indexes

### Permission Debugging

Add to any component to see current permissions:
```tsx
const perms = useMyPermissions();
console.log('Current permissions:', perms);
// Logs: { view: [...], edit: [...], full: [...], canAccess: fn, canEdit: fn, ... }
```

### Common Issues

**Query returns empty:** Verify that all 3 partition fields (`academicYearId`, `semester`, `departmentId`) are included in the Firestore query. See Firestore Schema section for details.

**Lint errors on commit:** Run `npm run lint --fix` to auto-correct most issues (unused imports, formatting). For remaining errors, fix manually or skip the pre-commit hook if certain (use `git commit --no-verify` as a last resort).

---

## Build & Deployment

### Production Build

```bash
npm run build    # Runs: tsc -b && vite build
```

This:
1. Type-checks all TypeScript (`tsc -b` uses incremental compilation)
2. Bundles with Vite to `dist/` folder
3. Minifies and optimizes for production

Preview locally before deploying:
```bash
npm run preview   # Serves dist/ on http://localhost:3000
```

### Deploying to Firebase Hosting

```bash
npm run build && firebase deploy --only hosting
```

To deploy everything (hosting + functions + indexes):
```bash
firebase deploy
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | All routes + ProtectedRoute logic |
| `src/components/layouts/PortalLayout.tsx` | Shell UI, nav, role configs, `GLASS` constant |
| `src/components/PermissionGate.tsx` | Route + UI access control |
| `src/types/rolePermission.ts` | `FEATURE_LIST` — source of truth for all feature keys |
| `src/store/authStore.ts` | Zustand auth state |
| `src/features/auth/authService.ts` | Firebase auth + session management |
| `src/hooks/useActiveAcademicYear.ts` | Active year/semester (localStorage) |
| `src/hooks/useMyPermissions.ts` | Permission helpers for current user |
| `src/lib/firebase.ts` | Firebase initialization |
| `src/lib/designTokens.ts` | Design tokens: `glassStyles`, `typography`, `spacing`, `colors` |
| `src/lib/utils.ts` | `cn()` — Tailwind class merging utility |
| `src/lib/activityLogger.ts` | `logEvent()` — writes to `activity_logs/{date}` in Firestore |
| `src/lib/sessionCache.ts` | localStorage TTL cache (1h) for slow-changing Firestore data |
| `firestore.indexes.json` | Composite indexes (deploy with Firebase CLI) |
| `vite.config.ts` | Vite config, path aliases, port settings |
| `tsconfig.app.json` | TypeScript strict mode config |
| `src/functions/` | Cloud Functions source (separate package.json, Node 22) |
| `src/functions/lib/` | Compiled JS (after `npm run build` in functions/) |
| `firebase.json` | Firebase hosting + functions config |
