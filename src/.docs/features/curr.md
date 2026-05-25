# Implementation Plan: Curriculum Management Module
## Project: PMV-ONE (Academic Core)

### 1. Objective
สร้างระบบจัดการ 'โครงสร้างหลักสูตร (Curriculums)' เพื่อทำหน้าที่เป็น Master Blueprint สำหรับนำไปผูกกับห้องเรียน โดยออกแบบให้มีการจัดเก็บแบบ Versioning (แยกปี แยกสาย) เพื่อป้องกันประวัติการเรียนของปีก่อนหน้าเสียหาย

### 2. UI/UX Specifications (Apple macOS/iPadOS Split View)
- **Layout Structure:** ใช้ดีไซน์แบบ Master-Detail (Split View) 
  - **Left Sidebar (Master):** แสดง List ของแพ็กเกจหลักสูตร (เช่น ม.4 วิทย์-คณิต 2569) มีปุ่ม `[ + สร้างหลักสูตรใหม่ ]` และช่องค้นหา
  - **Right Content (Detail):** เมื่อคลิกเลือกแพ็กเกจซ้ายมือ ด้านขวาจะแสดงรายละเอียดวิชาทั้งหมดในแพ็กเกจนั้น นำเสนอแบบ Bento Grid หรือ Data Table ขอบมน `rounded-3xl`
- **Aesthetic:** ใช้พื้นหลัง `bg-white/50 backdrop-blur-2xl` พร้อมเงา Drop Shadow นุ่มๆ ปุ่ม Action ใช้สี Vibrant Accent

### 3. Database Schema (Firestore)
**Collection:** `curriculums`
**Document Path:** `curriculums/{curriculumId}`
```json
{
  "name": "หลักสูตร ม.4 สายวิทย์-คณิต",
  "academicYear": 2569,
  "level": "ม.4",
  "track": "sci-math",
  "totalCredits": 16.5,
  "courses": [
    {
      "courseId": "ว31201",
      "name": "ฟิสิกส์ 1",
      "type": "core", // core (พื้นฐาน), elective (เพิ่มเติม)
      "credit": 1.5,
      "hoursPerWeek": 3
    },
    // ... รายวิชาอื่นๆ
  ],
  "createdAt": "timestamp"
}