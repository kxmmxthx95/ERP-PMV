# Implementation Plan: หน้าหลัก (Role-Based Home Dashboard)
## Project: PMV-ONE (Core Portal)

### 1. Objective
สร้าง Component `HomeTab.tsx` สำหรับเป็นหน้าแรกหลังจากการล็อกอิน (Landing Page) โดยใช้ระบบ Role-Based Rendering เพื่อแสดง Widget ที่เหมาะสมกับตำแหน่งของผู้ใช้งานแบบอัตโนมัติ

### 2. UI/UX Layout (Glassmorphism Grid)
- **Header Section:** แสดงข้อความต้อนรับตามช่วงเวลา (เช่น "สวัสดีตอนเช้า, ครูสมชาย") พร้อมสรุปข้อมูลสั้นๆ
- **Widget Grid Container:** ใช้ CSS Grid ที่มีความยืดหยุ่นสูง:
  - Mobile: `grid-cols-1` (เรียงแถวตอนลึก)
  - Tablet/iPad: `grid-cols-2`
  - Desktop: `grid-cols-3` หรือ `grid-cols-4` พร้อมกำหนด `gap-6`

### 3. Role-Based Widget Assignment
หน้านี้จะทำหน้าที่เป็น Container ที่ดึง Widget จากระบบมาวางตามสิทธิ์:
- **Global Widgets (เห็นทุกคน):**
  - `AnnouncementWidget`: ประกาศข่าวสารจากโรงเรียน
  - `QuickActionsWidget`: ปุ่มลัด (เช่น สแกนเช็กชื่อ, ยื่นใบลางาน)
- **Admin Widgets (เห็นเฉพาะผู้บริหาร):**
  - `StaffAttendanceOverview`: สรุปการมาทำงานของบุคลากร (ที่คุณเคยออกแบบไว้)
  - `SchoolStatWidget`: สถิติจำนวนนักเรียนและครู
- **Teacher Widgets (เห็นเฉพาะครูผู้สอน):**
  - `TodayScheduleWidget`: ตารางสอนของวันนี้ (ดึงจาก Timetable)
  - `PendingTaskWidget`: แจ้งเตือนห้องที่ยังไม่ได้เช็กชื่อ หรือยังไม่ได้กรอกคะแนน

### 4. Logic & Security (`ProtectedWidget` Wrapper)
- สร้าง Component `ProtectedWidget.tsx` ที่รับ Props `allowedRoles` (array)
- ดึงข้อมูล Role ปัจจุบันของผู้ใช้จาก `AuthContext`
- ถ้าระดับสิทธิ์ไม่ถึง ให้ `return null` (ซ่อน Widget นั้นไปเลย โดยไม่กระทบ Layout)

### 5. Agent Instructions (For Antigravity IDE)
- โครงสร้าง Grid ให้ใช้ Tailwind CSS `auto-rows-min` เพื่อให้ Widget จัดเรียงความสูงแบบ Masonry (ต่อกันลงมาสวยงามแม้กล่องสูงไม่เท่ากัน)
- ใช้ `framer-motion` ใส่แอนิเมชัน `staggerChildren` เพื่อให้ Widget ค่อยๆ โผล่ขึ้นมาทีละกล่องตอนโหลดหน้าแรก
- สไตล์กล่อง Widget ให้ใช้คลาสมาตรฐาน `bg-white/20 backdrop-blur-lg border border-white/30 rounded-3xl p-6 shadow-sm`