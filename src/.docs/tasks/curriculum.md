import os

# Define the content for the implementation plan markdown file
md_content = """# Implementation Plan: ระบบจัดการหลักสูตร (Curriculum Management)
## Project: PMV-ONE (Piyamitwittaya School)

### 1. Objective
สร้างระบบจัดการรายวิชาและหน่วยกิตที่รองรับการทำ **Versioning** (แยกตามปีหลักสูตร) เพื่อป้องกันปัญหาข้อมูลหน่วยกิตเปลี่ยนแปลงย้อนหลังจนกระทบเกรดเฉลี่ยสะสม (GPAX) ของนักเรียนรุ่นเก่า

### 2. Data Architecture (Firestore NoSQL)

#### Collection: `curriculums`
เก็บหัวข้อหลักสูตรแยกตามปีที่ประกาศใช้
- `curriculumId`: string (e.g., "curr-2568")
- `year`: number (ปีที่เริ่มใช้หลักสูตร)
- `name`: string (ชื่อหลักสูตร เช่น 'หลักสูตรสถานศึกษา 2568')
- `isActive`: boolean
- `createdAt`: timestamp

#### Sub-collection: `curriculums/{curriculumId}/courses`
เก็บรายวิชาในหลักสูตรเวอร์ชันนั้นๆ
- `courseCode`: string (Primary Key - e.g., "ว31201")
- `courseName`: string
- `credit`: number (หน่วยกิตเฉพาะเวอร์ชันนี้)
- `category`: string ('basic' | 'additional' | 'activity')
- `department`: string ('science', 'math', etc.)

#### Collection: `enrollments` (Snapshot Strategy)
เมื่อบันทึกผลการเรียน ให้คัดลอกหน่วยกิตจากหลักสูตรลงมาเก็บไว้โดยตรง
- `studentId`: ref
- `courseCode`: string
- `creditAtEnrollment`: number (Snapshot ค่าหน่วยกิต ณ วันที่ลงทะเบียน)
- `grade`: number
- `curriculumRef`: string

### 3. Logic & Security Rules
- **Versioning Rule:** นักเรียน 1 คนจะถูก Binding กับ `curriculumId` 1 ตัวตลอดการศึกษา
- **Edit Mode Switch:** การแก้ไขข้อมูลใน `curriculums` จะต้องเปิดสวิตช์ "Allow Edit" ผ่านหน้า Admin เท่านั้น (ตรวจสอบสิทธิ์ `role == 'academic_head'`)
- **Validation:** ห้ามลบรายวิชาในหลักสูตรที่มีนักเรียนเคยลงทะเบียนไปแล้ว (ให้ใช้ `isRetired: true` แทน)

### 4. UI/UX Components (React + Tailwind CSS)
- **Layout Style:** Modern Minimalist / Glassmorphism (Rounded-2xl, Backdrop-blur)
- **Features:**
  1. **Dashboard:** แสดงลิสต์ปีหลักสูตร (Card View)
  2. **Course Editor:** ตารางแสดงวิชาพร้อมปุ่ม Toggle 'Edit Mode'
  3. **Duplicate Feature:** ปุ่ม "คัดลอกโครงสร้างจากปีเก่า" เพื่อสร้างหลักสูตรใหม่ได้เร็วขึ้น
  4. **Responsive Table:** บนมือถือให้เปลี่ยนตารางวิชาเป็น Card List

### 5. Agent Instructions (For Antigravity IDE)
- ใช้ `lucide-react` สำหรับไอคอน
- ใช้ `shadcn/ui` สำหรับ components พื้นฐาน (Table, Switch, Dialog)
- เขียนโค้ดแบบ Clean Code แยก Logic (Hooks) ออกจาก UI
- รองรับการแสดงผลภาษาไทยทั้งหมด (Font: Sarabun/Prompt)
"""

# Define the file path
file_path = "curriculum-structure.md"

# Write the content to the file
with open(file_path, "w", encoding="utf-8") as f:
    f.write(md_content)

print(f"File created at: {file_path}")