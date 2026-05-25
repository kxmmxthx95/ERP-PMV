import os

# เนื้อหาสำหรับไฟล์แผนการสร้างระบบห้องสอบ
exam_system_md = """# Implementation Plan: ระบบจัดการห้องสอบและประเมินผล (Exam & Assessment System)
## Project: PMV-ONE (Smart Exam Module)

### 1. Objective
สร้างระบบทำข้อสอบออนไลน์ที่รองรับการตรวจคะแนนอัตโนมัติ มีระบบป้องกันการทุจริตเบื้องต้น และระบบสำรองข้อมูลคำตอบ (Auto-save) เพื่อป้องกันปัญหาอินเทอร์เน็ตหลุดระหว่างสอบ

### 2. Database Schema (Firestore)

#### Collection: `exam_rooms`
เก็บข้อมูลห้องสอบที่เปิดอยู่
- `roomId`: string (ID ห้องสอบ)
- `examPaperId`: ref (เชื่อมกับคลังข้อสอบ)
- `startTime` / `endTime`: timestamp
- `password`: string (รหัสเข้าห้องสอบ)
- `status`: string ('upcoming' | 'active' | 'closed')
- `settings`: { shuffleQuestions: bool, showResultImmediately: bool }

#### Collection: `exam_attempts`
เก็บกระดาษคำตอบรายคน
- `studentId`: string
- `roomId`: string
- `status`: string ('in_progress' | 'submitted' | 'graded')
- `answers`: map { questionId: selectedOptionId }
- `suspiciousActivities`: number (นับจำนวนครั้งที่สลับหน้าจอ)
- `score`: number (จะถูกเติมโดย Cloud Functions เท่านั้น)

### 3. Logic & Security Rules
- **Server-Side Grading:** ห้ามส่งเฉลยไปที่เครื่องนักเรียน ให้ React ส่งแค่คำตอบ (`answers`) ไปที่ **Firebase Cloud Functions** เพื่อตรวจคะแนนและบันทึกลง Firestore
- **Time Check:** ระบบจะไม่อนุญาตให้บันทึกคำตอบหากเกินเวลา `endTime`
- **Device Binding:** (Optional) ล็อกให้ 1 บัญชีผู้ใช้ สอบได้จากอุปกรณ์เดียวในเวลาเดียวกัน

### 4. Anti-Cheat Features (React Logic)
- **Tab Switching Detection:** ใช้ `visibilitychange` หรือ `window.onblur` เพื่อตรวจจับการสลับแท็บ และแจ้งเตือนครูคุมสอบผ่าน `suspiciousActivities`
- **Right-Click & Copy Block:** ป้องกันการคลิกขวาและคัดลอกข้อความโจทย์

### 5. UI/UX Design (Glassmorphism)
- **Student Exam Interface:** หน้าจอสะอาดตา (Distraction-free), แถบความคืบหน้า (Progress Bar), นาฬิกานับถอยหลัง (Countdown Timer)
- **Teacher Proctor Dashboard:** หน้าจอ Monitor แสดงสถานะนักเรียนแบบ Real-time (ใครกำลังทำ, ใครส่งแล้ว, ใครมีพฤติกรรมน่าสงสัย)

### 6. Agent Instructions (For Antigravity IDE)
- ใช้ `framer-motion` สำหรับ Animation ตอนเปลี่ยนข้อ
- ใช้ `localStorage` เป็นสำรองข้อมูล (Offline Fallback) ก่อน Sync ขึ้น Firestore
- ส่วนการคำนวณคะแนนให้เขียนในโฟลเดอร์ `functions/` เพื่อเตรียม Deploy เป็น Cloud Functions
"""