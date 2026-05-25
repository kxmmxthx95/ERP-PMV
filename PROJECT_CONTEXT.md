# PROJECT_CONTEXT

## Purpose

This document is a fast orientation guide for future AI or developer sessions working in this repository. It summarizes the architecture, folder layout, runtime boundaries, and the main data flow patterns without replacing source-of-truth code.

## Project Snapshot

- Name: `school-management-app`
- Type: client-heavy school management portal
- Frontend: React + TypeScript + Vite single-page application
- Backend model: Firebase services, primarily direct client access to Firestore
- Deployment shape: Vite static build hosted by Firebase Hosting, with Firebase Cloud Functions as a small auxiliary backend

## Core Stack

- React 19
- TypeScript
- Vite 8
- React Router
- Tailwind CSS v4
- shadcn/Radix-style UI components
- Framer Motion
- Zustand
- TanStack Query
- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Cloud Functions

See `package.json`, `vite.config.ts`, and `src/lib/firebase.ts` for the authoritative setup.

## Runtime Topology

There are two runtime parts in this repo:

1. Frontend SPA
- Lives under `src/`
- Bootstrapped by `src/main.tsx`
- Main route tree is defined in `src/App.tsx`

2. Firebase Functions project
- Lives under `src/functions/`
- Separate Node/TypeScript package
- Deployed via `firebase.json`

This repository does not use a traditional server framework with REST route files such as Express, Next.js API routes, or Hono route trees.

## Entry Points

- Frontend bootstrap: `src/main.tsx`
- App shell and routing: `src/App.tsx`
- Firebase client initialization: `src/lib/firebase.ts`
- Firebase deployment config: `firebase.json`
- Cloud Functions entry: `src/functions/src/index.ts`

Note: `src/router/AppRouter.tsx` is not active. It is a placeholder/reference file only.

## High-Level Architecture

### 1. App Shell and Navigation

- `src/App.tsx` defines public routes and protected portal routes.
- `/portal/*` is wrapped by `src/components/layouts/PortalLayout.tsx`.
- Most business areas are route-level feature pages mounted under `/portal`.
- `src/features/home/HomePage.tsx` acts as the portal landing page and permission-aware menu/dashboard.

### 2. Auth and Session Model

- Firebase Auth is the identity provider.
- Auth session state is stored in Zustand via `src/store/authStore.ts`.
- `src/features/auth/authService.ts` listens for auth changes, fetches the user profile from Firestore, resolves role information, ensures role permissions exist, and syncs active academic year into `localStorage`.
- `src/hooks/useAuth.ts` exposes the current user, role, and auth loading state.

### 3. Permissions Model

- Route and UI gating is mostly driven by `role_permissions` documents in Firestore.
- Feature definitions live in `src/types/rolePermission.ts`.
- Permission loading is handled by `src/hooks/useRolePermissions.ts` and `src/hooks/useMyPermissions.ts`.
- Route-level enforcement is done by `src/components/PermissionGate.tsx`.

Important distinction:

- Client permission gating controls UX and navigation.
- Firestore rules provide actual backend enforcement.
- Firestore rules are still fairly broad, so do not assume the client is the only security boundary.

### 4. Data Access Pattern

The app is mostly a direct-to-Firestore client.

Typical pattern:

- feature page
- uses one or more custom hooks
- hooks read/write Firestore directly
- many hooks use `onSnapshot` for realtime updates
- some hooks use `getDocs`/`getDoc` for fetch-on-demand flows

TanStack Query exists, but it is not the dominant abstraction across the app.

## Main Folders

### `src/features`

Business domains and route-level screens.

Main areas currently visible in the route tree:

- `auth`
- `home`
- `users`
- `logs`
- `calendar`
- `curriculum`
- `schedule`
- `teachers`
- `classes`
- `students`
- `roles`
- `settings`
- `teaching`
- `exam`
- `questionBank`
- `attendance`
- `leave`
- `lessonPlan`

Most feature folders contain:

- a route page or manager component
- feature-specific components
- sometimes feature-specific hooks

### `src/hooks`

Primary data layer and orchestration layer.

This is one of the most important directories in the repo. Many hooks do more than fetch data; they also:

- own CRUD logic
- merge/join multiple collections
- compute derived state for screens
- normalize Firestore schema inconsistencies

Representative hooks:

- `useSchedule.ts`
- `useStudentManager.ts`
- `useTeachingManager.ts`
- `useLeaveRequests.ts`
- `useRolePermissions.ts`
- `useActiveAcademicYear.ts`

### `src/components`

Shared UI primitives and layouts.

Key subfolders:

- `components/layouts`: application shell components such as `PortalLayout`
- `components/ui`: shared UI primitives
- `components/attendance`: attendance-related shared widgets/components

### `src/lib`

Infrastructure helpers and setup.

Most important file:

- `src/lib/firebase.ts`: initializes Auth, Firestore, Storage, and Functions

### `src/store`

Global client state.

Currently most important:

- `authStore.ts`

### `src/types`

Shared domain types and feature metadata.

Useful for understanding shape and intent of the app’s business entities.

### `src/functions`

Separate Firebase Functions project.

- own `package.json`
- own `tsconfig`
- compiled output under `src/functions/lib`

### `src/.docs`

Internal notes and implementation documents. Useful for historical context, but not part of runtime behavior.

## Database Layer

### Firestore

Primary datastore: Firestore database `all-pmv`.

Used collections observed in code include:

- `users`
- `students`
- `teachers`
- `classes`
- `enrollments`
- `schedules`
- `calendar_events`
- `role_permissions`
- `leave_requests`
- `staff_attendance`
- `lesson_plans`
- `notifications`
- `subject_repository`
- `curriculum_maps`
- `curriculums`
- `assignments`
- `assignment_submissions`
- `exams`
- `exam_scores`

### Firebase Rules

Rules live in `src/firestore.rules`.

Current rule shape, simplified:

- any authenticated user can read broadly
- super admin, admin, and teacher can write broadly
- a few narrower exceptions exist for self-updates and staff attendance

This means feature-level access is not modeled with fine-grained Firestore rules yet.

### Storage

Firebase Storage is initialized but not a dominant architectural theme in the current code scan.

## Cloud Functions Layer

Cloud Functions are defined in `src/functions/src/index.ts`.

Current callable functions:

- `setAnonymousUserRole`
- `deleteAuthUser`
- `setUserClaims`

Observed behavior:

- the functions project is real and deployable
- the frontend initializes Firebase Functions
- active client-side callable usage was not found during the scan

Important caveat:

- frontend functions client is initialized for region `asia-southeast3`
- deployed functions are defined in region `asia-southeast1`

If callable functions are used later, verify region alignment first.

## API Surface

There are no conventional API route files in the app root.

Instead, the application talks to:

- Firebase Auth SDK
- Firestore SDK
- Firebase Storage SDK
- Firebase Functions SDK
- a few external HTTP endpoints via `fetch`

Examples of direct external HTTP usage:

- Firebase Identity Toolkit signup
- Google Calendar API
- Google Sheets CSV export URLs
- Google Maps script loading
- Thai address JSON source

## Data Flow

### Login and Session Boot

1. `src/main.tsx` mounts the app.
2. `src/App.tsx` starts the auth listener through `authService`.
3. `authService` receives Firebase Auth state changes.
4. It loads the matching Firestore `users/{uid}` profile.
5. It resolves role and permission context.
6. It syncs active academic year settings into `localStorage`.
7. Zustand auth state is updated.
8. Protected routes and widgets render based on role and permissions.

### Route Protection

1. `ProtectedRoute` checks authentication.
2. `PermissionGate` checks feature access level for the route.
3. `HomePage` builds dashboard/menu items from the loaded `role_permissions` map.

### Typical Feature Data Flow

1. Route page mounts.
2. Page calls one or more feature hooks.
3. Hook subscribes to Firestore or fetches from Firestore.
4. Hook returns:
- raw entities
- CRUD actions
- derived state
- view-friendly collections
5. Page renders UI and invokes hook mutations directly.

### Example: Schedule

The schedule area is a good example of orchestration-heavy client logic.

- `src/hooks/useSchedule.ts` handles base schedule CRUD and realtime Firestore subscriptions.
- `src/features/schedule/hooks/useScheduleManager.ts` composes:
  - active academic year
  - schedules
  - curriculum
  - versioned curriculum
  - teacher manager
  - classroom manager

This is effectively a view-model/controller hook for the schedule editor.

## Representative Architectural Patterns

### Pattern: Domain Route + Hook Pair

Common pattern:

- feature page or manager component in `src/features/...`
- one or more hooks in `src/hooks/...` or `src/features/.../hooks/...`
- Firestore CRUD and derived logic colocated in the hook

### Pattern: Realtime Firestore First

Many core features use `onSnapshot` instead of request/response fetching, especially:

- users
- students
- teachers
- classes
- schedules
- calendar

### Pattern: Client-Side Join Logic

The frontend often joins data across collections itself, for example combining:

- students + enrollments + classes
- schedules + teachers + classes
- curriculum versions + courses + class enrollment metadata

This means many “manager” hooks are business-logic heavy.

## Known Architectural Quirks

### 1. Schema Alias Drift

Some hooks explicitly map or sync multiple field names for the same concept, such as:

- `academicYear` vs `academicYearId`
- `department` vs `departmentId`
- `capacity` vs `maxStudents`

This indicates schema evolution over time. When editing data logic, check for both legacy and current field names.

### 2. Mixed Data Access Styles

The app uses:

- realtime `onSnapshot`
- direct `getDocs`/`getDoc`
- some TanStack Query
- direct `fetch` for a few backend operations

Do not assume one consistent repository-wide data strategy.

### 3. Active Academic Year is Cross-Cutting

`src/hooks/useActiveAcademicYear.ts` is a key cross-feature dependency.

- it reads from `localStorage`
- many features use it as a primary filter
- auth bootstrap also syncs it from Firestore settings

If a feature appears to “miss data,” year/semester filtering is one of the first things to verify.

### 4. Security is Partly UI-Layer Driven

The app has a substantial permission UX layer, but Firestore rules are broader than the route-level permission model. Any security-sensitive change should review both:

- client permission checks
- Firestore rules

## Where to Look First in Future Sessions

If the task is about:

- routing or entry flow: start at `src/App.tsx`
- auth or role issues: start at `src/features/auth/authService.ts`, `src/store/authStore.ts`, `src/hooks/useRolePermissions.ts`
- Firebase setup: start at `src/lib/firebase.ts`
- schedule behavior: start at `src/features/schedule/hooks/useScheduleManager.ts` and `src/hooks/useSchedule.ts`
- student/class linkage: start at `src/hooks/useStudentManager.ts` and `src/features/classes/hooks/useClassroomManager.ts`
- leave flows: start at `src/hooks/useLeaveRequests.ts` and `src/features/leave/LeaveManagementPage.tsx`
- backend/admin tasks: inspect `src/functions/src/index.ts` and `src/firestore.rules`

## Suggested Maintenance Rule

Update this document when any of the following changes:

- route structure
- Firebase service usage
- permission model
- major collections or schema strategy
- Cloud Functions responsibilities
- primary data-access pattern

## Non-Goals of This File

This file is not intended to:

- document every component
- replace code-level reading
- define product requirements
- serve as a full data schema reference

It is a fast-start orientation artifact for future work sessions.
