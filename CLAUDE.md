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

## Firestore Indexes

### Deploying Indexes

Composite indexes are defined in `firestore.indexes.json`. They are **required** for efficient queries on `schedules`, `grades`, `syllabi`, and `attendance` collections:

```bash
firebase deploy --only firestore:indexes
```

This is safe to run locally — it just creates indexes in your Firebase project, doesn't mutate data. Check [Firebase Console](https://console.firebase.google.com) → Firestore → Indexes to see deployment status.

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
/login                        → LoginPage (public)
/signup                       → LoginPage (public)
/line/connect                 → LineConnectPage (public)
/line/checkin                 → LineCheckInPage (public)
/portal                       → PortalLayout (protected)
  /portal                     → HomePage (widgets, role-aware)
  /portal/users               → UsersPage
  /portal/logs                → LogsPage
  /portal/roles               → RolePermissionManager
  /portal/calendar            → AcademicCalendar
  /portal/curriculum          → CurriculumManager
  /portal/schedule            → ScheduleEditor
  /portal/teachers            → TeacherManager
  /portal/lesson-plan         → LessonPlanManager
  /portal/micro-syllabus      → MicroSyllabusPage
  /portal/classes             → ClassManager
  /portal/students            → StudentManager
  /portal/profile             → ProfilePage
  /portal/exams               → ExamLayout
  /portal/exams/rooms         → ExamManager
  /portal/question-bank       → QuestionBankManager
  /portal/ai-agents           → AiAgentCommandPage
  /portal/tasks               → TasksPage
  /portal/grades              → GradeBookPage
  /portal/student-analytics   → StudentAnalyticsPage
  /portal/attendance          → AttendanceRouter (role-aware: routes to staff/teacher/admin attendance views)
  /portal/staff-attendance    → StaffAttendancePage
  /portal/fingerprint-devices → FingerprintDeviceManagerPage
  /portal/teacher-kpi         → TeacherKpiPage
  /portal/morning-rollcall    → MorningRollCallPage
  /portal/leave               → LeaveManagementPage
  /portal/leave/report        → LeaveReportPage
  /portal/duty-schedule       → DutySchedulePage
  /portal/substitute-teaching → SubstituteAssignmentPage
  /portal/report-control      → ReportControlCenter
  /portal/announcements       → AnnouncementsPage
  /portal/feedback            → FeedbackPage
  /portal/behavior            → BehaviorScorePage
  /portal/future-plan         → FuturePlanPage
  /portal/tuition             → TuitionLayout (index=TuitionDashboardPage, +campaigns, +campaigns/:campaignId)
  /portal/courses             → CoursesPage
  /portal/courses/:courseId   → CoursePlayerPage
  /portal/settings            → SettingsPage (sysadmin, require='full')
  /portal/migrate             → CourseMigrationTool (sysadmin, require='full')
/exam/:roomId                 → StudentExamPage (standalone, no layout)
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
| `aiAgents/` | `/portal/ai-agents` | `useAgentChat` |
| `auth/` | `/login`, `/signup` | `authService.ts` |
| `behavior/` | `/portal/behavior` | `useBehaviorCatalog` |
| `home/` | `/portal` | `useRolePermissions` |
| `announcements/` | `/portal/announcements` | `useAnnouncements` |
| `attendance/` | `/portal/attendance`, `/portal/staff-attendance`, `/portal/morning-rollcall` | `useStaffAttendance`, `useDailySchedules`, `useMorningRollCall` |
| `calendar/` | `/portal/calendar` | `useAcademicCalendar` |
| `classes/` | `/portal/classes` | `useSchoolStructure` |
| `courses/` | `/portal/courses`, `/portal/courses/:courseId` | — |
| `curriculum/` | `/portal/curriculum` | `useCurriculum`, `useCurriculumVersioned` (both in `src/hooks/`) |
| `duty/` | `/portal/duty-schedule` | — |
| `exam/` | `/portal/exams`, `/portal/exams/rooms`, `/exam/:roomId` | `useExamRoom`, `useQuestionSetBank` |
| `feedback/` | `/portal/feedback` | `useStudentFeedback` |
| `fingerprintDevices/` | `/portal/fingerprint-devices` | `useAttendanceDevices` |
| `futurePlan/` | `/portal/future-plan` | `useAllFuturePlans` |
| `grades/` | `/portal/grades` | `useGradeBook` |
| `leave/` | `/portal/leave`, `/portal/leave/report` | `useLeaveRequests` |
| `lessonPlan/` | `/portal/lesson-plan` | `useLessonPlan` |
| `lineCheckIn/` | `/line/checkin` | — |
| `logs/` | `/portal/logs` | — |
| `microSyllabus/` | `/portal/micro-syllabus` | `useMicroSyllabus` |
| `profile/` | `/portal/profile`, `/line/connect` | — |
| `questionBank/` | `/portal/question-bank` | `useQuestionSetBank`, `useSetQuestions` |
| `reports/` | `/portal/report-control` | — |
| `roles/` | `/portal/roles` | `useRolePermissions` |
| `schedule/` | `/portal/schedule` | `useSchedule` |
| `settings/` | `/portal/settings`, `/portal/migrate` | — |
| `studentAnalytics/` | `/portal/student-analytics` | `useStudentAnalytics` |
| `students/` | `/portal/students` | `useStudentManager` |
| `substituteTeaching/` | `/portal/substitute-teaching` | `useDailySchedules` |
| `tasks/` | `/portal/tasks` | `useCreatedTasks` |
| `teacherKpi/` | `/portal/teacher-kpi` | `useTeacherKpi` |
| `teachers/` | `/portal/teachers` | — |
| `tuition/` | `/portal/tuition` (+`campaigns`, `campaigns/:campaignId`) | — |
| `users/` | `/portal/users` | `useUserForm` |

`syllabus` hooks (`useSyllabus`, `useSyllabusManager`, `useTeacherSyllabus`) live in `src/hooks/` but aren't wired to a routed feature currently — used by each other only, not imported by any page. `teaching/` also exists under `src/features/` (components only, no page/route) — only `useTeachingManager` (a different, actively-used hook in `src/hooks/`) shares part of the name.

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

### Portal UI Iron Rules

These patterns are enforced across the portal. Canonical reference files are the source of truth if this section and the code ever disagree.

**Button radius:** every new button defaults to `rounded-2xl` (set on `@/components/ui/button`). Don't override with `rounded-full`/`rounded-4xl` except for circular things like avatars.

**Header icon buttons** (filter/settings/home/menu/back in a portal header): use `HEADER_ICON_BTN` + `HEADER_ICON_BTN_GROUP` from `@/lib/headerIconBtn` (group gap is always `gap-1.5`). Filter trigger specifically = `HEADER_ICON_BTN` + `HiOutlineFunnel` (`react-icons/hi2`, size 16); active-filter state is an `absolute` dot (`bg-destructive`), never a restyled button. Canonical: `ScheduleEditor`.

**Data tables** (student rosters, grades, exam scores — anything list+columns): use the `GradeTable` CSS-grid pattern, not `@/components/ui/table` or a card grid. Shell: `rounded-2xl border border-border bg-card overflow-hidden`. Row: `grid gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-muted/40`. Student avatar: `<StudentAvatar />` from `@/features/students/components/StudentAvatar`. Mobile (`md:hidden`) gets cards; desktop (`hidden md:block`) gets the grid. Canonical: `src/features/grades/components/GradeTable.tsx`, `ExamRoomScoreTable.tsx`.

**Split-panel pages** (sidebar list ↔ detail, e.g. student/class/teacher managers): root locks viewport height (`h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)] overflow-hidden`) — the page itself never scrolls, only inner panels do (`overflow-y-auto scrollbar-hide` + `min-h-0`, required together or flexbox won't shrink). Sidebar↔detail gap is `gap-4`; use `GradeBookClassSidebar` as the sidebar shell, don't hand-roll one. Canonical: `src/features/students/StudentManager.tsx`.

**Drawer close button:** `DRAWER_HEADER_ICON_BTN` + `DRAWER_HEADER_RIGHT_ACTIONS` from `@/lib/drawerHeaderBtn`, icon `HiXMark` (`react-icons/hi2`), top-right of `DrawerHeader` (never left, never footer). A paired back button uses the same class + `HiArrowLeft`, placed left of close in the same cluster. Canonical: `MorningRollCallWidget` drawer header.

**Dialog/form design** (settings & edit forms in Dialog/Sheet/Drawer): shell `rounded-2xl`, no nested bordered/shadowed card wrapping the body. Label: `text-[10px] font-black uppercase tracking-wider text-slate-600`. Input: `Input` from `@/components/ui/input` styled `h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold`. Primary save button is full-width in `DialogFooter`, system `primary` variant — never a hardcoded color, never a footer "cancel" button (use the Dialog's own X). Canonical: `src/features/schedule/components/ScheduleSettingsModal.tsx`.

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

### Installing Skills

Cursor and Claude Code both read the same `SKILL.md` format natively — Cursor has its own skill support (`.cursor/skills/` project-level, `~/.cursor/skills/` user-level, plus its built-in `~/.cursor/skills-cursor/` — never touch that one). No transcription needed between tools.

Install new skills into `.claude/skills/<name>/`. If the skill should also be available in Cursor, symlink it: `ln -s ../../.claude/skills/<name> .cursor/skills/<name>`. One real copy, two tools see it, nothing to keep in sync by hand.

`.cursor/rules/*.mdc` is a separate, older mechanism (always-on project rules, not the skill system) — reserve it for genuinely project-specific conventions written by hand (see `agent-core.mdc`), not as a place to dump a skill's content. A generic skill's guidance can be wrong for this project's actual stack if copied in blind (a Next.js-focused skill once got transcribed this way and left a wrong "stack is Next.js" claim in the now-removed `.cursorrules`).

### Commit Discipline (Cursor + Claude Code)

This project is worked on from both Cursor and Claude Code, sequentially (not concurrently). To keep unrelated work from piling up uncommitted in one giant diff:

- Commit at every working checkpoint — a logical unit of work done and `npm run build` passing — not just when switching tools.
- Claude Code should proactively ask "commit now?" at each checkpoint rather than waiting to be asked.
- Never switch tools mid-task before reaching a checkpoint. Finish and commit first, then switch. This removes the need for handoff notes between tools — git log is the handoff.

---

## Known Mock/TODOs in Code

- `MOCK_TEACHER_ID = 't03'` in teacher-scoped hooks (`AttendanceCenterPage.tsx`, `LessonPlanManager.tsx`) → replace with `useAuth().user.uid` when teacher backend is ready.
- Active academic year in localStorage → migrate to Firestore real-time listener.

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
