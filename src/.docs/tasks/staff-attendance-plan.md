# Implementation Plan: ระบบลงเวลาการทำงานบุคลากร (Staff Attendance)
## Project: PMV-ONE (HR Module)

### 1. Core Objectives
สร้างระบบเช็คอิน-เช็คเอาต์ที่ใช้งานง่ายบนมือถือและแท็บเล็ต มีความปลอดภัยสูงด้วยระบบ Geofencing (ตรวจสอบตำแหน่ง) และรองรับการดูภาพรวมของทีมงาน 9 คน

### 2. Technical Stack & Logic
- **Frontend:** React.js + Tailwind CSS + Shadcn UI
- **Backend:** Firebase Firestore + Cloud Functions
- **Location Logic:** ใช้ Geolocation API ตรวจสอบรัศมีรอบพิกัดโรงเรียน (รัศมี 100-200 เมตร)
- **Time Logic:** กำหนดเวลาเข้างานมาตรฐาน (เช่น 08:00 น.) เพื่อกำหนดสถานะ 'late' อัตโนมัติ

### 3. UI/UX Design (Apple Minimalist)
- **Check-in Widget:**
  - ใช้ `backdrop-blur-xl` และ `bg-white/10` สำหรับพื้นหลังกล่อง
  - ปุ่ม Action ขนาดใหญ่พร้อม Feedback เมื่อกด (haptic-like animation)
  - แสดงเวลาปัจจุบันที่ซิงค์กับ Server Time (ป้องกันการแก้ไขเวลาในเครื่อง)
- **Admin Monitoring Widget:**
  - ตารางสรุปรายชื่อลูกน้อง 9 คน
  - ระบบ Filter: 'ทั้งหมด', 'มาสาย', 'ยังไม่เข้า'
  - ปุ่ม 'ส่งออกรายงาน' (Export CSV) รายเดือน

### 4. Integration with Roles
- **Staff Role:** เห็นเฉพาะ Widget เช็คชื่อของตนเองและประวัติย้อนหลัง 7 วัน
- **Admin Role:** เห็น Widget สรุปผลของทีม 9 คน และปุ่ม Override (กรณีลืมเช็คชื่อ)

### 5. Agent Instructions
- ใช้ `lucide-react` ไอคอน: `<MapPin />`, `<Clock />`, `<UserCheck />`
- พัฒนาฟังก์ชันคำนวณระยะทาง GPS (Haversine Formula) เพื่อเช็คเขตโรงเรียน
- เชื่อมต่อข้อมูลกับหน้า Home Tab โดยอัตโนมัติผ่าน `ProtectedWidget`