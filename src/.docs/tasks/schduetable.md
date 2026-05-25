# Implementation Plan: ระบบตารางเรียนและตารางสอน (Smart Timetable Module)
## Project: PMV-ONE

### 1. Objective
สร้างระบบจัดการตารางเรียนที่รองรับการแสดงผลแบบ Multi-view (รายวัน/รายสัปดาห์) แจ้งเตือนการเปลี่ยนแปลงแบบ Real-time และเชื่อมต่อกับระบบเช็กชื่อรายคาบ

### 2. UI/UX Specifications (Modern Glassmorphism)
- **Responsive Layout:** - Desktop: ตาราง Grid 5-7 วัน (รายสัปดาห์) 
  - Mobile: รายการ Card แนวนอน (รายวัน) สไลด์เพื่อเปลี่ยนวัน
- **Visual Style:** ใช้สีการ์ดแยกตามกลุ่มสาระวิชาที่กำหนดไว้ (คณิต-น้ำเงิน, วิทย์-เขียว, สังคม-ส้ม ฯลฯ)
- **Interaction:** เมื่อคลิกที่คาบเรียน จะแสดง Modal รายละเอียดวิชา, ชื่อครู, ห้องเรียน และปุ่มทางลัดไปยัง 'ระบบเช็กชื่อ'

### 3. Functional Requirements
- **Substitution Logic:** ระบบจัดการสอนแทน (Substitution) ที่สามารถดึงข้อมูลครูที่ว่างในคาบนั้นๆ มาแสดงผลให้เลือก
- **Notification System:** เชื่อมต่อ Firebase Cloud Messaging (FCM) เพื่อส่ง Push Notification เมื่อมีการสลับคาบหรือสอนแทน
- **Export & Print:** - ปุ่ม 'Download Image' (ใช้ html2canvas) สำหรับส่งในกลุ่ม LINE
  - ปุ่ม 'Print PDF' (ใช้ jspdf) สำหรับติดประกาศหน้าห้องเรียน

### 4. Database Integration (Firestore)
- ดึงข้อมูลวิชาจาก `curriculums` และข้อมูลครูจาก `staff_profile`
- สร้าง Collection `daily_schedules` เพื่อจัดการ Record การสอนแทนแยกต่างหากจากตารางหลัก

### 5. Agent Instructions
- ใช้ Tailwind CSS สำหรับทำ Responsive Breakpoints
- ใช้ Lucide React สำหรับไอคอน: <Calendar />, <Clock />, <Bell />, <Printer />
- เขียน Logic ให้ระบบตรวจสอบ 'คาบปัจจุบัน' อัตโนมัติและไฮไลท์การ์ดวิชาที่กำลังเรียนอยู่