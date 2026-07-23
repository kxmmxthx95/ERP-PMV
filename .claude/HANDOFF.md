# Handoff — 2026-07-23

Switching from Cursor to Antigravity IDE (Cursor tokens exhausted). This file
summarizes recent work so a fresh AI session in the new IDE can pick up
without re-deriving context. Delete this file once absorbed.

## Just committed

Commit `cf190d0` — bundles two things together (see below): the user's own
in-progress GradeBookPage sidebar redesign (already sitting uncommitted in
the working tree before this session started) + this session's fixes. They
were committed together because splitting hunks across 125 mixed files was
impractical, not because they're the same change.

## What this session actually did

### 1. Firestore quota-amplification fixes (see memory: `firestore-quota-amplification-pattern`)
Found and fixed unscoped whole-school `onSnapshot` listeners (`classes`,
`enrollments`) opened per-teacher across morning roll-call, micro-syllabus,
online exam room, `useTeachingManager`. Fix pattern: scoped one-shot `getDocs`
stores in `src/lib/firestoreShared/studentSummaryStore.ts`
(`getTeachingClassesStore`, `getHomeroomClassesStore`, etc.), keyed by
teacher identity (`buildTeacherIdentityKeys`). Required denormalizing
`classes.teacherIds` from `enrolledCourses` (`src/types/class.ts`,
`useClassroomManager.ts`) with a one-time backfill
(`src/functions/src/backfillClassTeacherIds.ts`) — **already run in
production**, confirmed working.

Recurring bug found alongside this: `useSyncExternalStore` null-store
fallbacks using inline `() => []` (new array ref every call → infinite
re-render). Fixed in ~9 files by hoisting a stable module-level empty
constant. **If you see "Maximum update depth exceeded" anywhere else, check
for this exact pattern first.**

### 2. GradeBookPage blank-screen bug (teacher view)
Root cause: `src/features/grades/GradeBookPage.tsx` top wrapper used
`h-full` for the teacher branch (admin branch used
`h-[calc(100dvh-8.5rem)]`, which is self-contained). The user's own sidebar
redesign changed the parent layout chain so `h-full` resolved to 0 —
cards rendered correctly in the DOM (verified) but had zero visible height.
Fixed by using the same `dvh`-based height for both branches. Debugged live
via injected `console.debug` + DOM inspection with the user over screenshots
— all temp debug logging has been removed already, nothing to clean up.

### 3. Teacher KPI (`src/hooks/useTeacherKpi.ts`)
- `subjectBreakdown` now built from the union of `teacher.teachingSubjectIds`
  (assigned) and subjects actually present in `schedules` — previously it
  only showed subjects that already had a timetable entry, silently hiding
  "assigned but never scheduled" subjects. New `inSchedule: boolean` field on
  `TeacherSubjectKpi`, rendered as a badge in `TeacherSubjectExclusionDrawer.tsx`.
- Fixed: setting a **future** KPI start date (`KpiStartDateSetting`) was
  silently ignored — the code required `configuredStart <= computedThrough`
  (today), so a future date fell back to the semester's real start with no
  visible effect. Now only bounds the date within the semester range;
  `enumerateWorkingDays` naturally returns `[]` for a not-yet-reached start,
  which is the correct "no progress yet" behavior.

## Known issues raised but NOT yet fixed (flagged during audit, user hasn't asked for the fix)

- **KPI attendance-rate doesn't exclude approved staff leave.** `%
  เข้างาน` in `useTeacherKpi.ts` counts every non-holiday working day as the
  denominator, with no check against `leave_requests`
  (`requesterType: 'staff'`, `status: 'approved'`). A teacher on legitimate
  approved leave is scored as absent. Fix would pull approved leave per
  `teacher.userId` in range and exclude/count those days before computing
  `attendanceRate`.
- **KPI teacherId matching is fragile.** `schedules.filter(s => s.teacherId
  === teacher.id)` and the `class_sessions` session-count lookup use raw
  string equality instead of `matchesTeacherIdentity`/
  `buildTeacherIdentityKeys` (the identity-ambiguity helper used everywhere
  else — `schedules`/`class_sessions.teacherId` can theoretically be an auth
  uid instead of a teacher doc id). Verified current production data is
  consistent (always doc id) so nothing is broken today, but there's no
  defense if a future write path uses the other format.
- Exam room admin/staff branch of `useExamRoom.ts` still queries
  unscoped-by-department — flagged as a possible follow-up if that page's
  read volume becomes a problem, not confirmed as an actual issue yet.
- `useSchedule()`'s classes listener in `AttendanceSheet.tsx` still opens a
  separate `getClassesByYearStore` subscription just for a `classesReady`
  boolean, discarding the fetched data — explicitly deprioritized earlier
  ("zero net benefit in that specific file").

## NOT committed — needs a decision, do not act on these blindly

These looked suspicious (deletions of top-level docs that were previously
tracked) and were deliberately left out of the commit:

```
D  README.md
D  memory.md
D  UI_FIX_CHECKLIST.md
D  capsule_filter.md
D  .claude/skills/gridgeist/**  (whole skill dir)
M  skills-lock.json
M  .firebase/hosting.ZGlzdA.cache   (build artifact, regenerate don't commit)
M  graphify-out/**                  (tool cache, don't commit)
```

Also present as **untracked, not committed**: `.agents/skills/`,
`.claude/skills/` (minus gridgeist), `.cursor/rules/`, `ui-skills/` —
these look like IDE/tool-installed skill packages, not project source. Judge
call on whether they belong in this repo at all before adding them.

## Orientation

Read `/CLAUDE.md` first — it's the source of truth for conventions
(permission system, Firestore schema rules, styling, path aliases). Key
files touched this session: `src/hooks/useTeachingManager.ts`,
`src/hooks/useTeacherKpi.ts`, `src/features/grades/GradeBookPage.tsx`,
`src/lib/firestoreShared/studentSummaryStore.ts`.
