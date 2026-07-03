# codex.md

## Project Identity
- Name: School Management App (PMV-ONE)
- Type: Web app สำหรับบริหารโรงเรียนแบบ role-based
- Frontend: React 19 + TypeScript + Vite
- Styling/UI: Tailwind CSS + Framer Motion
- State/Data: Zustand + React Query
- Backend: Firebase (Auth, Firestore, Storage, Functions)

## Current Firebase Setup
- Firebase Project ID: `pmv1-90180`
- Firestore Database ID (active): `pmv1`
- Region ที่ต้องการใช้งาน: `asia-southeast1`
- Important: ใน repo นี้ตั้งค่าให้ deploy Firestore rules/indexes ไปทั้ง `(default)` และ `pmv1`

## Main App Structure
- Entry/Routes: `src/App.tsx`
- Firebase config: `src/lib/firebase.ts`
- Auth service: `src/features/auth/authService.ts`
- Permission gate: `src/components/PermissionGate.tsx`
- Main layout: `src/components/layouts/PortalLayout.tsx`
- Feature modules: `src/features/*`

## Core Business Modules
- Authentication / Profile
- Users / Roles / Permissions
- Students / Teachers / Classes
- Curriculum / Course management
- Schedule / Attendance / Leave
- Grades / Exam / Question Bank
- Announcements / Reports / Dashboard widgets

## Authorization Model
- ใช้ RBAC จากข้อมูลผู้ใช้ใน Firestore (`users/{uid}.role`)
- สิทธิ์หลักในระบบ: `sysadmin`, `admin`, `teacher`, `staff`, `parent`, `student`
- หลายหน้าบริหารต้องใช้ role ระดับ admin/teacher ขึ้นไป

## Coding Conventions (Current)
- ใช้ path alias `@/` อ้างถึง `src/`
- โค้ดใหม่ด้านไอคอนให้ใช้ `react-icons/hi2` แทน `lucide-react`
- TypeScript strict mode (ควรเช็ก build ก่อน deploy)

## Operational Notes
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Deploy Firestore config:
  - `firebase deploy --only firestore:rules,firestore:indexes --project pmv1-90180`

## Known Migration Context
- โปรเจกต์กำลังย้ายจาก Firebase เดิม (`pmv-1-92b9a`) ไปใหม่ (`pmv1-90180`)
- ต้องตรวจเสมอว่า `.env`, `.firebaserc`, และ redirect/webhook ชี้โปรเจกต์ใหม่ครบ
