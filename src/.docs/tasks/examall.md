# Implementation Plan: ระบบคลังข้อสอบ (Question Bank System)
## Project: PMV-ONE (Smart Exam Module)

### 1. Objective
สร้างระบบคลังข้อสอบส่วนกลางที่รองรับคำถามหลายรูปแบบ (ปรนัย, อัตนัย) รองรับการใส่รูปภาพและสมการคณิตศาสตร์ และผูกติดกับตัวชี้วัดของหลักสูตร โดยมีกลไกป้องกันการแก้ไขข้อสอบที่ถูกนำไปใช้งานแล้ว

### 2. Database Schema (Firestore)

#### Collection: `questions`
ออกแบบ Schema แบบ Polymorphic (ยืดหยุ่นตามประเภทข้อสอบ)
- `questionId`: string (Auto-generated)
- `subjectCode`: string (e.g., "ว31201")
- `curriculumYear`: number
- `indicator`: string (ตัวชี้วัด เช่น "ว 2.2 ม.4/1")
- `difficulty`: string ('easy' | 'medium' | 'hard')
- `type`: string ('multiple_choice' | 'essay')
- `isLocked`: boolean (Default: false. จะเป็น true เมื่อถูกดึงไปใช้สร้างชุดสอบแล้ว เพื่อป้องกันการแก้เฉลยย้อนหลัง)

**เนื้อหาข้อสอบ (Shared Fields):**
- `questionText`: string (เก็บเป็น HTML Content จาก Rich Text Editor)
- `images`: array of strings (URLs ของรูปภาพโจทย์ ถ้ามี)

**ตัวเลือกและเฉลย (Dynamic Payload):**
- `payload`: map (โครงสร้างเปลี่ยนไปตาม `type`)
  - *If type == 'multiple_choice':*
    - `options`: array of objects `[{ id: "1", text: "10 m/s", isCorrect: false }, ...]`
  - *If type == 'essay':*
    - `rubric`: string (เกณฑ์การให้คะแนน)
    - `maxScore`: number

### 3. UI/UX Design & Components (Glassmorphism)
- **Layout:** ใช้ Card โปร่งแสง ขอบมน (rounded-2xl) แยกส่วน Settings (ด้านซ้าย/บน) และส่วน Editor (ด้านขวา/ล่าง)
- **Components ที่ต้องสร้าง:**
  1. `QuestionList`: ตารางหรือลิสต์แสดงข้อสอบที่มีอยู่ พร้อมตัวกรอง (วิชา, ระดับความยาก)
  2. `QuestionBuilder`: หน้าฟอร์มหลักสำหรับสร้างข้อสอบ
  3. `RichTextEditor`: รองรับการจัดรูปแบบข้อความเบื้องต้น (ใช้ไลบรารีเช่น React-Quill หรือ TipTap)
  4. `MultipleChoiceOptions`: Component ย่อยสำหรับกดเพิ่ม/ลด/แก้ไขตัวเลือก และติ๊กเลือกข้อถูก (Render เฉพาะเมื่อ `type == 'multiple_choice'`)

### 4. Logic & Rules
- **Dynamic Form:** ถ้าเลือกประเภทข้อสอบเป็น "อัตนัย" ให้ซ่อนกล่องเพิ่มตัวเลือก และแสดงกล่องใส่ Rubric แทน
- **Immutability:** ถ้าเปิดข้อสอบที่ `isLocked == true` ปุ่ม "บันทึก/แก้ไข" จะถูก Disable และขึ้นแจ้งเตือนว่า "ข้อสอบนี้ถูกใช้งานแล้ว ให้คัดลอก (Duplicate) เป็นข้อใหม่แทน"

### 5. Agent Instructions (For Antigravity IDE)
- ใช้ `shadcn/ui` สำหรับ Select, Input, Button และ Badge
- เขียน Logic การจัดการ State ของตัวเลือก (Options) ด้วย `useState` แบบ Array
- โทนสีและ UI ให้คงสไตล์ Glassmorphism ตาม Theme ของระบบ
- รองรับภาษาไทย (Font: Prompt/Sarabun)