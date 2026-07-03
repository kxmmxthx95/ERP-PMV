# 💊 Premium Capsule Filter Component Design Guide

เอกสารนี้สรุปขั้นตอน โครงสร้าง และสไตล์สำหรับสร้าง **Capsule Filter / Tab Switcher** ที่มีดีไซน์หรูหราแบบ **Premium Glassmorphism** ดังรูปตัวอย่าง

---

## 🎨 UI/UX Design System
การ์ดเมนูแท็บนี้ใช้สไตล์การออกแบบที่ทันสมัย มีความลื่นไหล และตอบสนองต่อการมีปฏิสัมพันธ์อย่างพรีเมียม:

1. **Glassmorphism**: พื้นหลังโปร่งแสงหรูหราด้วยการใช้ฉากหลังเบลอ (Backdrop Blur) ช่วยให้กลมกลืนกับองค์ประกอบเบื้องหลัง
2. **Harmonious Palette**: คุมโทนด้วยสี Slate แสนอบอุ่น ผสมผสานสี Navy Blue เข้ม สำหรับแท็บที่กำลังใช้งานอยู่ เพื่อความสบายนัยน์ตาและดูพรีเมียม
3. **Soft Shadowing**: เงาที่มีความฟุ้งกระจายตัวสูงแต่บางเบา (`rgba(0,0,0,0.04)`) ทำให้ตัวควบคุมลอยขึ้นมาจากพื้นหลังอย่างเป็นธรรมชาติ
4. **Fluid Interactions**: มีการขยับและเปลี่ยนสถานะอย่างลื่นไหลเมื่อเลื่อนเมาส์ผ่าน (Hover) และคลิกใช้งาน

---

## 🛠️ Tailwind CSS Class Breakdown

วิเคราะห์คลาสของสไตล์แต่ละชิ้นงานตามระบบดีไซน์ของโปรเจกต์:

### 1. Main Container (แถบแคปซูลนอก)
```css
flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto
```
* `flex items-center`: จัดตำแหน่งเมนูย่อยให้อยู่ตรงกลางตามแนวตั้ง
* `bg-white/60`: พื้นหลังสีขาวโปร่งแสง 60% สำหรับเอฟเฟกต์กระจกฝ้า
* `backdrop-blur-xl`: เปิดเอฟเฟกต์เบลอฉากหลังระดับพิเศษ
* `border border-white`: ขอบเส้นสีขาวบางเฉียบเพื่อสร้างขอบคมชัดแบบกระจก
* `p-1`: ช่องไฟขอบใน (Padding) ขนาด 4px
* `rounded-full`: ทำมุมโค้งมนแบบแคปซูลสมบูรณ์แบบ
* `shadow-[0_8px_32px_rgba(0,0,0,0.04)]`: เงาเงียบหรูหรากระจายตัวนุ่มนวล
* `pointer-events-auto`: เปิดการตอบรับการทำงานคลิกสำหรับพื้นที่ Portal

### 2. Active Tab (แท็บที่เลือกใช้งาน)
```css
px-6 py-1.5 rounded-full text-[11px] font-black bg-slate-900 text-white shadow-md transition-all whitespace-nowrap
```
* `px-6 py-1.5`: ช่องไฟซ้ายขวา 24px และบนล่าง 6px เพื่อให้ปุ่มดูยาวเรียวโค้งมนเข้ากับแถบ
* `rounded-full`: ปุ่มโค้งมนเต็มตัว
* `text-[11px] font-black`: ขนาดตัวอักษร 11px แบบหนาพิเศษเพื่อเพิ่มน้ำหนักความเด่นชัด
* `bg-slate-900 text-white`: พื้นหลังสีเข้มหรูหราเกือบดำตัดด้วยตัวอักษรสีขาวบริสุทธิ์
* `shadow-md`: เพิ่มเงาเบาๆ ให้กับตัวแคปซูลปุ่มที่ลอยอยู่ด้านใน
* `whitespace-nowrap`: ป้องกันปุ่มตัดบรรทัดเมื่อจอแสดงผลหดแคบลง

### 3. Inactive Tab (แท็บที่ไม่ได้เลือก)
```css
px-6 py-1.5 rounded-full text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all whitespace-nowrap
```
* `text-slate-500`: ตัวอักษรสีเทา Slate อ่อนโยน เพื่อเน้นแท็บที่ใช้อยู่มากกว่า
* `hover:text-slate-800`: เมื่อนำเมาส์มาวางจะเปลี่ยนเป็นสีเทาเข้ม
* `hover:bg-black/5`: เมื่อนำเมาส์มาวางจะไฮไลต์พื้นหลังเบาบางสีดำ 5% เพื่อให้ตอบสนองมีมิติ
* `transition-all`: ทำให้การเปลี่ยนแปลงค่าสี สไตล์ และแสงเงาทั้งหมดมีอนิเมชันที่เรียบเนียน (Smooth Transition)

---

## 💻 React Component Implementation

ตัวอย่างโค้ดสำหรับสร้างคอมโพเนนต์นี้ร่วมกับ **TypeScript** และ **Lucide Icons**:

```tsx
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { motion } from 'framer-motion';

type PageTab = 'my' | 'team' | 'report' | 'settings';

interface TabItem {
  key: PageTab;
  label: React.ReactNode;
}

export default function PremiumCapsuleFilter() {
  const [activeTab, setActiveTab] = useState<PageTab>('team');

  const tabs: TabItem[] = [
    { key: 'my', label: 'คำขอของฉัน' },
    { key: 'team', label: 'ภาพรวมทีม' },
    { key: 'report', label: 'รายงาน' },
    { key: 'settings', label: <Settings size={13} className="shrink-0" /> },
  ];

  return (
    <div className="flex justify-center items-center py-6 bg-slate-100/50 w-full rounded-2xl">
      <div 
        className="
          flex items-center 
          bg-white/60 backdrop-blur-xl 
          border border-white p-1 
          rounded-full 
          shadow-[0_8px_32px_rgba(0,0,0,0.04)] 
          pointer-events-auto
        "
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-6 py-1.5 
                rounded-full 
                text-[11px] font-black 
                transition-all whitespace-nowrap
                flex items-center justify-center gap-1.5
                ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## ✨ เคล็ดลับความพรีเมียมเพิ่มเติม (Framer Motion Integration)
เพื่อเพิ่มระดับความพรีเมียมให้พุ่งสูงขึ้นไปอีกขั้น คุณสามารถนำ **Framer Motion** มาใช้ทำ **Layout Animation** เพื่อให้เม็ดสีเข้มด้านในไหลเลื่อน (Slide Transition) สลับระหว่างปุ่มเมื่อเปลี่ยนแท็บได้อย่างงดงามน่าทึ่ง:

```tsx
{isActive && (
  <motion.div
    layoutId="active-pill"
    className="absolute inset-0 bg-slate-900 rounded-full shadow-md z-0"
    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
  />
)}
```
*(เมื่อมีเลเอาต์อนิเมชันปุ่มสไลด์ ตัวเลือกทั้งหมดจะเปลี่ยนจากการกดเปลี่ยนค่าธรรมดา เป็นแถบสีเข้มที่เลื่อนสไลด์สลับตแหน่งอย่างสมูทมีมิติระดับโปร)*
