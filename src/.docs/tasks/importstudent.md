# Implementation Plan: ระบบนำเข้านักเรียน (Student Bulk Import System)
## Project: PMV-ONE (Academic & Registrar Module)

### 1. Objective
สร้างระบบนำเข้ารายชื่อนักเรียนใหม่จากไฟล์ Excel (.xlsx / .csv) โดยสามารถตั้งค่าการผูกหลักสูตร (Curriculum Binding) และระดับชั้นเรียนก่อนทำการบันทึกลงฐานข้อมูล

### 2. UI/UX Workflow (Wizard Mode)
1. **Upload Zone:** พื้นที่ Drag & Drop ไฟล์ Excel
2. **Configuration Panel:** Form สำหรับตั้งค่าลอตข้อมูล (Batch Context)
   - `academicYear` (Select: 2569, 2570)
   - `level` (Select: ม.1, ม.4)
   - `curriculumId` (Select: ดึงข้อมูลจาก Collection `curriculums`)
   - `classroomId` (Select: ดึงห้องเรียนในปีนั้นๆ หรือปล่อยเป็น Unassigned)
3. **Data Preview Table:** ตารางแสดงรายชื่อที่ Parse จาก Excel พร้อมไฮไลท์แถวที่มีข้อมูลผิดพลาด (เช่น รหัส ปชช. ไม่ครบ 13 หลัก)
4. **Action Button:** กดเพื่อทำ Batch Write

### 3. Firebase Logic (Firestore Batch Write)
- เมื่อกดยืนยัน ให้ใช้ `firebase.firestore().batch()` เพื่อความปลอดภัย (ถ้าพังจะพังทั้งลอต ไม่เกิดข้อมูลแหว่ง)
- เขียนข้อมูลลง Collection `students` โดยฝัง `curriculumId` ไว้ในระดับ Document ของนักเรียนแต่ละคน
- หากระบุ `classroomId` ให้ Update Array `studentIds` ใน Collection `classrooms` ของห้องนั้นๆ ด้วย

### 4. Agent Instructions
- ใช้ไลบรารี `xlsx` (SheetJS) หรือ `papaparse` สำหรับอ่านไฟล์ฝั่ง Client-side
- หน้าต่างตั้งค่าใช้สไตล์ Glassmorphism ตาม Theme ของระบบ
- มี Progress Bar แสดงสถานะตอนกำลังอัปโหลดเข้า Firestore
- ใช้ `lucide-react` ไอคอน: `<UploadCloud />`, `<FileSpreadsheet />`, `<Settings2 />`