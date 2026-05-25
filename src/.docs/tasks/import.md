# Implementation Plan: ระบบนำเข้านักเรียนและผูกหลักสูตร (Student Import Wizard)
## Project: PMV-ONE (Registrar Module)

### 1. Objective
สร้างหน้าต่างนำเข้ารายชื่อนักเรียนจากไฟล์ Excel (.xlsx) โดยบังคับให้ผู้ใช้งานกำหนด "ปีการศึกษา" "ระดับชั้น" และ "โครงสร้างหลักสูตร" ก่อนอัปโหลด เพื่อให้เกิดการทำ Curriculum Binding ที่ถูกต้อง

### 2. UI/UX Design (Apple Music Aesthetic)
- **Typography:** หัวข้อใช้ `text-4xl font-extrabold tracking-tight` (เช่น "นำเข้านักเรียนใหม่")
- **Ambient Background:** เรียกใช้ `DynamicAmbientBackground` โดยกำหนดโทนสีสว่าง (เช่น ธีมสีฟ้าอมชมพู) เพื่อให้หน้าจอดูลื่นไหล
- **Wizard Cards:** แบ่งเนื้อหาเป็นกล่องใสขอบมน `rounded-3xl bg-white/40 backdrop-blur-xl shadow-sm p-8` 
- **Upload Zone:** ทำเป็นกล่องเส้นประ (Dashed border) ตรงกลางจอ เมื่อลากไฟล์มาวางให้กล่องเรืองแสง
- **Buttons:** ใช้ทรงแคปซูล `rounded-full` สีสันจัดจ้านสำหรับปุ่ม Action หลัก

### 3. Workflow & Data Parsing Logic
- **Step 1 (Context):** สร้าง Form สำหรับเลือก `entranceYear`, `entranceLevel`, `curriculumId` 
- **Step 2 (Parse):** ใช้ไลบรารี `xlsx` (SheetJS) ในการอ่านไฟล์ที่อัปโหลด ดึงข้อมูล ชื่อ นามสกุล เลขบัตรประชาชน
- **Step 3 (Preview):** แสดงข้อมูลที่ Parse ได้ในรูปแบบตาราง (Table) พร้อมโชว์ Badge สถานะการผูกหลักสูตรให้แอดมินตรวจสอบความถูกต้อง
- **Step 4 (Commit):** เมื่อกดยืนยัน ใช้ Firestore Batch Write วนลูปสร้าง Document ใน Collection `students` โดยฝังตัวแปรจาก Step 1 เข้าไปในประวัติของนักเรียนทุกคน

### 4. Agent Instructions
- ใช้ไลบรารี `react-dropzone` สำหรับจัดการเรื่องการอัปโหลดไฟล์
- ตรวจสอบ (Validation) ก่อนอัปโหลดเสมอว่า รหัสบัตรประชาชน 13 หลัก มีการกรอกซ้ำในระบบหรือไม่
- หากไฟล์ Excel มีคอลัมน์ไม่ตรงกับที่ระบบต้องการ ให้แสดงแจ้งเตือน (Error UI) สไตล์ Apple Music (กล่องข้อความขอบมนสีแดง)