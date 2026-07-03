# memory.md

บันทึกบริบทและรูปแบบที่ใช้ซ้ำจากงาน Dashboard (อัปเดต 2026-07-03)

---

## Dashboard Mobile — Section Frame

บน mobile **ไม่ใช้กรอบ glass card** ครอบ section ทั้งก้อน ให้เหลือแค่หัวข้อ + เนื้อหา/การ์ดย่อย

```ts
const DASHBOARD_SECTION_CLASS =
  'rounded-none border-0 bg-transparent p-0 shadow-none md:rounded-[28px] md:border md:border-white/90 md:bg-white/[0.72] md:p-4 md:shadow-[0_8px_32px_rgba(0,0,0,0.06)] md:backdrop-blur-2xl md:saturate-150 lg:p-5';
```

**ไฟล์ที่ใช้แล้ว**
- `src/features/exam/ExamDashboardPage.tsx`
- `src/features/attendance/MorningRollCallDashboardPage.tsx`

---

## Dashboard Mobile — ระยะห่างระหว่าง Section

- **ระหว่างหัวข้อสถิติ (mobile):** `gap-5`
- **Desktop grid:** `md:gap-3` / `xl:gap-4`
- **Outer page (mobile):** `gap-2 pb-10` — ไม่ใช้ `pb-28` บน mobile
- **ไม่ยืดเต็ม viewport บน mobile:** เอา `flex-1` ออกจาก page root และ layout outlet

| ไฟล์ | Pattern |
|---|---|
| `ExamDashboardPage.tsx` | `<div className="flex flex-col gap-5">` ครอบ section ใน `StaffDashboard` / `StudentDashboard` |
| `MorningRollCallDashboardPage.tsx` | `grid … gap-5 md:gap-3 xl:gap-4` |
| `ExamLayout.tsx` | `flex min-h-0 flex-col md:flex-1` |
| `MorningRollCallLayout.tsx` | เหมือน Exam |

---

## Dashboard Mobile — Carousel รายชื่อ (clip bleed)

ใช้กับ carousel การ์ดรายชื่อที่ต้องการให้การ์ดถัดไปโผล่ขอบขวาและถูก clip ที่ขอบจอ

```tsx
<DashboardListCarousel clipBleed … />
```

- Wrapper: `-mx-1.5 overflow-hidden sm:-mx-2` (ตรงกับ gutter ของ `PortalLayout`)
- การ์ดรายชื่อ: `overflow-hidden` บน card container
- **Morning Roll Call:** ใช้กับ Watchlist + Staff Tracking เท่านั้น

---

## Dashboard — Stat List Drawer (แทน Dialog)

**Morning Roll Call** — คลิก stat card เปิดรายชื่อนักเรียน

- ใช้ `Drawer` แทน `Dialog`
- Mobile: `direction="bottom"` · Desktop (`lg+`): `direction="right"`
- Pagination: `STAT_DRAWER_ITEMS_PER_PAGE = 20`
- Reset หน้าเมื่อเปลี่ยนหมวดหรือปิด drawer
- อ้างอิง pattern จาก `BehaviorScoreQuickDrawer.tsx`

---

## Dashboard — Typography / Spacing Tokens

```ts
const DASHBOARD_KICKER_CLASS = 'text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]';
const DASHBOARD_SECTION_TITLE_CLASS = 'mt-1 text-sm font-black text-slate-900 sm:text-lg';
const DASHBOARD_SECTION_META_CLASS = 'text-[11px] font-semibold text-slate-400 sm:text-xs';
```

**Mobile กระชับ**
- Carousel margin: `mt-2 md:mt-4`, dots `mt-2 md:mt-3`
- Stat cards: padding เล็กลง (`p-2`), ตัวเลข `text-base` บน mobile
- กราฟ Morning Roll Call: `h-40 md:h-48`, กราฟแผนก `h-20 md:h-24`

---

## Exam Dashboard — โครงสร้าง Section

ลำดับใน `StaffDashboard`:

1. Exam Overview (สรุปภาพรวมห้องสอบ)
2. By Teacher
3. By Subject Group
4. By Grade Level
5. Recent Rooms

Carousel mobile: `DashboardStatCarousel` — `mt-2 md:mt-4`

---

## Morning Roll Call Dashboard — โครงสร้าง Section

ลำดับบน mobile (single column):

1. Student Overview (สรุปภาพรวมนักเรียน)
2. Watchlist (รายชื่อเฝ้าระวัง)
3. Staff Tracking (ความคืบหน้าการเช็คชื่อ) — เฉพาะ `viewMode === 'day'`
4. Trends (กราฟเปรียบเทียบรายสัปดาห์)

**Nav:** `MorningRollCallNavCapsule` — mobile ใช้ dropdown ใน header (เหมือน Exam)

**Filters mobile:** ปุ่มกลม + drawer (`ExamMobileFilterDrawer` pattern)

---

## สิ่งที่ยังไม่ทำ / หมายเหตุ

- `pb-28` ยังใช้ในหน้าอื่นๆ (เช่น `LeaveManagementPage`) — dashboard ใหม่ใช้ `pb-10` บน mobile
- Department chart carousel บน Morning Roll Call ยังไม่มี `clipBleed`
- ไม่มี test runner — ทดสอบผ่าน dev server + `npm run build` ก่อน commit
