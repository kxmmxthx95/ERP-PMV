# Project Context: Piyamit School Management System

## 🏫 Overview
ระบบบริหารจัดการสถานศึกษา (School Management System) สำหรับโรงเรียนระดับมัธยมศึกษา เน้นการจัดการข้อมูลนักเรียน ผลการเรียน ตารางเรียน และการแจ้งเตือนแบบ Real-time

## 🏗️ Architecture Layers
- **Client Layer**: React 18 (TypeScript) + Vite
- **Auth Layer**: Firebase Auth พร้อมระบบ Custom Claims เพื่อระบุ Role
- **Database Layer**: Cloud Firestore (NoSQL)
- **Logic Layer**: Cloud Functions สำหรับงานเบื้องหลัง
- **Storage**: Firebase Storage สำหรับเก็บไฟล์และรูปภาพ

## 👥 Role Portals (6 Portals)
ระบบแบ่งการเข้าถึงตามบทบาท (Role-Based Access Control) ดังนี้:
1. **Student**: ดูตารางเรียน, ผลการเรียน, ประวัติการเข้าเรียน
2. **Parent**: ติดตามผลการเรียนและพฤติกรรมบุตรหลาน
3. **Teacher**: บันทึกคะแนน, เช็คชื่อนักเรียน, จัดการตารางสอน
4. **Staff**: บริหารงานธุรการ, จัดการห้องเรียน
5. **Admin**: ดู Dashboard ภาพรวม, อนุมัติกิจกรรม, สถิติวิเคราะห์
6. **SysAdmin**: สิทธิ์สูงสุด, จัดการ User & Roles, ตั้งค่าระบบ

## ⚙️ Tech Stack & Styling
- **Frontend**: React (TS) + Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI base)
- **State Management**: Zustand (Global Auth & UI state)
- **Data Fetching**: React Query (TanStack Query)
- **Animations**: Framer Motion
- **Design Guidelines**: สไตล์ Minimalist, Glassmorphism, ธีม Dark Mode (พื้นหลัง #0f172a), ใช้ Backdrop Blur และ Border โปร่งแสง

## 📁 Project Structure
- `src/portals/`: หน้า UI Pages แยกตาม Role
- `src/features/`: Business Logic ที่ใช้ร่วมกัน (auth, attendance, grades, notifications)
- `src/components/`: UI Components กลาง (shadcn)
- `src/hooks/`: Custom hooks (useAuth, useFirestoreQuery, useNotification)

## 🗄️ Database Schema Highlights
- `users`: ข้อมูลพื้นฐานและ Role
- `students`: รหัสนักเรียน, ชั้นเรียน, ข้อมูลผู้ปกครอง
- `grades`: คะแนนรายวิชา, เกรด, เทอม
- `notifications`: ระบบประกาศและแจ้งเตือนตาม Target Roles