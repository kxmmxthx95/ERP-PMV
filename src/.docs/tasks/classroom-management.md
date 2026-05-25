# Implementation Plan: ระบบจัดการชั้นเรียน (Classroom Management)
## Project: PMV-ONE (Academic Operations)

### 1. Objective
สร้างระบบจัดการห้องเรียนแบบเบ็ดเสร็จ (All-in-one Workspace) ที่สามารถเพิ่มนักเรียน กำหนดครูประจำชั้น และจัดรายวิชาเรียนได้ภายในหน้าจอเดียว

### 2. Database Schema (Firestore)
- **Collection `classrooms`**:
  - `classroomId`: string (PK, e.g., "2569-M4-1")
  - `academicYear`: number
  - `level`: string (e.g., "ม.4")
  - `roomNumber`: string
  - `homeroomTeacherIds`: array of strings
  - `studentIds`: array of strings
  - `enrolledCourses`: array of objects `{ courseCode, teacherId }`

### 3. UI/UX Design (Glassmorphism & Layout)
- **Main View (Room List):** แสดงการ์ดห้องเรียนทั้งหมดในเทอมนั้นเรียงตามระดับชั้น (ม.1 - ม.6)
- **Room Detail View (Tabs Layout):**
  - **Tab 1: รายชื่อนักเรียน:** ตารางแสดงรายชื่อนักเรียนในห้อง มีปุ่ม `[+ เพิ่มนักเรียน]` (ดึงเฉพาะเด็ก status: 'unassigned' มาให้เลือก)
  - **Tab 2: ครูประจำชั้น:** กล่องค้นหาเพื่อเลือกครู 1-2 คน
  - **Tab 3: รายวิชา:** ดึงข้อมูลจากคลังหลักสูตรมาแสดง และมี Dropdown ให้เลือก 'ครูผู้สอน' ประจำวิชานั้นๆ

### 4. Logic & Validations
- **Prevent Duplication:** นักเรียน 1 คนต้องอยู่ได้แค่ห้องเดียวใน 1 ปีการศึกษา (ตรวจสอบก่อนแอดเข้าห้อง)
- **Auto-Sync:** เมื่อเพิ่มครูผู้สอนใน Tab รายวิชา ระบบจะต้องอัปเดตสิทธิ์ให้ครูคนนั้นสามารถเข้าถึงหน้า "ตัดเกรด" ของห้องนี้ได้

### 5. Agent Instructions
- ใช้ `shadcn/ui` Components: `Tabs`, `Table`, `Dialog` (Modal), และ `Multi-select`
- สไตล์การ์ดหลักใช้ `bg-white/20 backdrop-blur-md rounded-3xl`
- ไอคอน (Lucide React): `<Users />` (นักเรียน), `<GraduationCap />` (ครู), `<BookOpen />` (รายวิชา)
- รองรับภาษาไทยสมบูรณ์