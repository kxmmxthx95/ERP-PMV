# 🎨 Piyamit School Management System — Design System Guide

> This document is the **single source of truth** for all visual and code patterns in this project.
> Any AI assistant or developer working on this codebase MUST follow these guidelines to maintain design consistency.

---

## 🏗️ Tech Stack Overview

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (Vite) |
| Styling | **Tailwind CSS v4** |
| UI Components | **shadcn/ui** (Radix UI base) |
| Animations | **Framer Motion** |
| Icons | **Lucide React** |
| Fonts | Sukhumvit Set (primary), Sarabun (body/description), SF Pro Display, Inter |
| State | Zustand (auth/UI), React Query (data) |
| Backend | Firebase (Firestore, Auth, Storage) |

---

## 🎨 Visual Identity

### Core Aesthetic Philosophy

> **"Glassmorphism Light"** — Not a dark UI. This is a **light, frosted-glass interface** layered over a blurred background image. Everything looks like polished glass or frosted acrylic.

Key traits:
- Semi-transparent backgrounds with strong `backdrop-filter: blur()`
- Rounded corners everywhere — never sharp edges
- Soft, barely-there shadows (not deep/dark)
- Micro-animations on every interactive element
- Off-black (`slate-900` / `#0f172a`) for primary CTAs — NOT pure black, NOT blue
- White text with `textShadow` when placed on glass/image backgrounds

### Background System

The main layout uses a **full-screen blurred photograph** as the background:

```tsx
// PortalLayout.tsx — Background
<div
  className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
  style={{
    backgroundImage: 'url(https://nutty-yellow-w6lw8f8pkd.edgeone.app/BG.jpg)',
    filter: 'blur(10px) brightness(0.95)',
  }}
/>
{/* White overlay to lighten the image */}
<div className="absolute inset-0 z-0 bg-white/15" />
```

**Ambient Blobs** (decorative, pointer-events-none):
```tsx
<div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-pink-100/20 blur-[120px]" />
<div className="absolute bottom-[0%] right-[-5%] w-[400px] h-[400px] rounded-full bg-rose-50/25 blur-[100px]" />
```

---

## 🪟 The GLASS Style Object (Most Important Pattern)

This is the cornerstone of the entire UI. **Export and reuse this constant — never copy-paste raw values.**

```tsx
// src/components/layouts/PortalLayout.tsx (exported)
export const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.35)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.55)',
};
```

### Glass Variants by Context

| Use Case | Background | Border | Blur |
|---|---|---|---|
| **Navbar / Capsule** (GLASS constant) | `rgba(255,255,255,0.35)` | `rgba(255,255,255,0.55)` | `20px` |
| **User Cards** | `rgba(255,255,255,0.95)` | `rgba(255,255,255,1)` | `20px` |
| **Stats Banner / Header Card** | `rgba(255,255,255,0.4)` | `rgba(255,255,255,0.3)` | `30px` |
| **FormModal** | `rgba(255,255,255,0.85)` | `rgba(255,255,255,0.7)` | `40px` |
| **Form Inputs** | `rgba(255,255,255,0.6)` | `rgba(200,180,255,0.4)` | — |

---

## 🔤 Typography System

All fonts are declared as Tailwind theme tokens in `src/index.css`:

```css
@theme inline {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter Variable", "Sukhumvit Set", "Sarabun", sans-serif;
  --font-sukhumvit: "Sukhumvit Set", "SF Pro Display", sans-serif;
  --font-sarabun: 'Sarabun', sans-serif;
}
```

### Usage Rules

| Class | Font | Use For |
|---|---|---|
| `font-sukhumvit` | Sukhumvit Set | **Headers, titles, labels, role names** — anything prominent |
| `font-sarabun` | Sarabun | **Body text, descriptions, form inputs, secondary labels** |
| *(default)* | System (SF Pro / Inter) | General UI chrome |

### Text Size Scale (Tailwind custom sizes we use)

```
text-[8px]      — Micro labels (e.g., department badge)
text-[9px]      — Secondary badges, timestamps
text-[10px]     — Captions, subtitle labels
text-[11px]     — Form labels, role labels (UPPERCASE + tracking-widest)
text-[12px]     — Small body text
text-[13px]–[15px] — Card names, primary body
text-xl / text-4xl — Stats / hero numbers
```

### Text Shadow (for text on glass/image)
```tsx
style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}  // subtle
style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}  // medium (for large titles)
```

---

## 🎭 Color System

### Role Color Map
```ts
const ROLE_LABELS = {
  student:  { label: 'นักเรียน',    color: '#7c3aed', bg: '#f3e8ff' },
  parent:   { label: 'ผู้ปกครอง',   color: '#2563eb', bg: '#dbeafe' },
  teacher:  { label: 'ครูผู้สอน',   color: '#e11d48', bg: '#ffe4e6' },
  staff:    { label: 'เจ้าหน้าที่', color: '#059669', bg: '#d1fae5' },
  admin:    { label: 'ผู้บริหาร',   color: '#d97706', bg: '#fef3c7' },
  sysadmin: { label: 'SysAdmin',    color: '#64748b', bg: '#f1f5f9' },
};
```

### Role Gradient Map (used in PortalLayout avatar)
```ts
const ROLE_CONFIG = {
  sysadmin: { gradient: 'from-violet-500 to-indigo-600' },
  admin:    { gradient: 'from-sky-500 to-blue-600' },
  teacher:  { gradient: 'from-rose-500 to-pink-600' },
  staff:    { gradient: 'from-emerald-500 to-teal-600' },
  student:  { gradient: 'from-amber-500 to-orange-600' },
  parent:   { gradient: 'from-blue-400 to-cyan-500' },
};
```

### Semantic Colors

| Purpose | Value |
|---|---|
| Primary CTA | `bg-blue-500` / `#3b82f6` |
| Active/Selected state | `bg-slate-900` (off-black) |
| Active status (live) | `bg-emerald-500` with glow `shadow-[0_0_8px_rgba(16,185,129,0.5)]` |
| Inactive status | `bg-slate-300` |
| Danger / Delete | `text-rose-500`, `hover:bg-rose-50` |
| Border divider | `bg-white/20` on glass |

---

## 🧱 Radius System

> **Rule: Use very large border radii. Never use `rounded-md` or `rounded-lg` for cards/surfaces.**

| Component | Radius Class |
|---|---|
| Page Cards / Panels | `rounded-[2rem]` or `rounded-[2.25rem]` |
| Modals / FormModal | `rounded-[2.5rem]` |
| Capsule pills / Filters | `rounded-full` |
| Avatars | `rounded-full` |
| Buttons (CTA) | `rounded-xl` |
| Form Inputs | `rounded-3xl` |
| Role filter rows | `rounded-[1.5rem]` |
| Badges | `rounded-xl` or `rounded-lg` |
| Icon containers | `rounded-2xl` |

---

## 💫 Animation Patterns (Framer Motion)

### Standard Card Entrance
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.03 }}
>
```

### Header/Banner Entrance
```tsx
<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.05 }}
>
```

### Button Interactions
```tsx
<motion.button
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.99 }}
>
```

### Hover Scale for Cards
```
className="... hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
```

### Skeleton Loading (pulsing placeholder)
```tsx
<motion.div
  animate={{ opacity: [0.4, 0.8, 0.4] }}
  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.08 }}
  className="w-10 h-10 rounded-full bg-white/40"
/>
```

---

## 📐 Layout Architecture

### Full-Height No-Scroll Pages

Sub-pages inside `PortalLayout` must fill the available height without page-level scroll:

```tsx
// Page root container
<div className="relative w-full bg-transparent overflow-hidden h-full">
  <div className="max-w-[1600px] mx-auto flex flex-col h-full gap-4 pb-10 pt-4">
    {/* content */}
  </div>
</div>
```

Internal scroll is allowed only within specific containers:
```tsx
<div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
```

### PortalLayout Outlet Context

Child pages receive shared state via React Router Outlet context:

```tsx
// In PortalLayout.tsx
<Outlet context={{ view, showSearch }} />

// In child pages
const { view, showSearch } = useOutletContext<{ view: 'dashboard' | 'menu'; showSearch: boolean }>();
```

### Horizontal Padding
```
PortalLayout top bar: px-8
Content area body:    px-24
```

### Scrollbar Utilities (defined in `src/index.css`)
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## 🧩 Key Component Patterns

### 1. User Card (Square, aspect-square)

Layout: **3-zone split**
- **Top-left**: `firstName` (large, bold) + `lastName` (small, muted, Sarabun)
- **Bottom-left**: Avatar (circle, `rounded-full`) + status dot
- **Bottom-right**: Role badge (solid color) + Dept badge (light border)

```tsx
<div className="absolute inset-0 flex flex-col justify-between p-4 md:p-5">
  {/* Top: Name */}
  <div className="flex flex-col text-left">
    <p className="text-[13px] md:text-[15px] font-black text-slate-800 font-sukhumvit">{firstName}</p>
    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 font-sarabun mt-0.5">{lastName}</p>
  </div>
  {/* Bottom: Avatar + Badge */}
  <div className="flex items-end justify-between w-full">
    <div className="relative shrink-0 translate-y-1">
      <div className="w-10 h-10 md:w-11 md:h-11 rounded-full ..." />
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
    </div>
    <div className="flex flex-col items-end gap-1.5 translate-y-1">
      <span className="text-[8.5px] font-black uppercase px-2.5 py-1 rounded-xl text-white" style={{ backgroundColor: roleStyle.color }}>{roleStyle.label}</span>
    </div>
  </div>
</div>
```

### 2. FormModal

```tsx
<FormModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="หัวข้อ Modal"
  icon={<SomeLucideIcon size={16} />}
  onSubmit={handleSubmit}
  submitLabel="บันทึก"
  onDelete={handleDelete}        // optional
  deleteLabel="ลบ"               // optional
  maxWidth="md"                  // 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  footerNote={<>note text</>}   // optional red warning text
>
  {/* form fields */}
</FormModal>
```

**Form input style** (consistent across all forms):
```tsx
<Input
  className="h-10 rounded-3xl border text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun"
  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
/>
```

**Form label style**:
```tsx
<label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
  FIELD NAME <span className="text-rose-400">*</span>
</label>
```

### 3. Bottom Capsule Filter (Fixed, Floating)

```tsx
<div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
  <motion.div
    className="flex items-center gap-1.5 px-2.5 py-2 rounded-full shadow-2xl"
    style={{
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(24px) saturate(200%)',
      border: '1px solid rgba(255,255,255,0.9)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    }}
  >
    {/* pills */}
    <button className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all
      ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-black/5'}`}>
      Label
    </button>
  </motion.div>
</div>
```

### 4. Sidebar Filter List (Role Selector)

Cards are stacked vertically with hover slide (`hover:translate-x-1`):
```tsx
<button className="group relative rounded-[1.5rem] p-3 px-4 flex items-center gap-4 transition-all hover:translate-x-1 duration-200"
  style={{
    background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.95)',
    border: isActive ? '1px solid #2563eb' : '1px solid rgba(255,255,255,1)',
    boxShadow: isActive ? '0 10px 20px -5px rgba(59,130,246,0.4)' : '0 4px 15px -3px rgba(0,0,0,0.05)'
  }}>
  {/* icon, label, count */}
</button>
```

---

## 📋 File Structure Reference

```
src/
├── components/
│   ├── layouts/
│   │   └── PortalLayout.tsx   ← Master layout, GLASS constant, Outlet context
│   └── ui/
│       ├── FormModal.tsx      ← Reusable modal wrapper
│       └── (shadcn components)
├── features/
│   ├── home/HomePage.tsx      ← Dashboard + Menu grid
│   ├── users/UsersPage.tsx    ← Full-height user management page
│   └── (other feature pages)
├── hooks/
│   ├── useUserForm.ts         ← Form state management
│   ├── useSchoolStructure.ts  ← School data (departments, grades)
│   └── useAuth.ts             ← Auth state
├── types/
│   └── user.ts                ← UserData interface
├── index.css                  ← @theme tokens, scrollbar-hide utility
└── App.css                    ← App-level styles
```

---

## ✅ Do's and ❌ Don'ts

### ✅ DO
- Use `GLASS` constant from `PortalLayout.tsx` for glass effects
- Use `rounded-full`, `rounded-[2rem]`, `rounded-3xl` — always pill/large radii
- Use `font-sukhumvit` for all titles and labels
- Use `font-sarabun` for descriptions, form inputs, body text
- Use `bg-slate-900` for primary active states (off-black)
- Add `whileHover` and `whileTap` on all interactive buttons
- Use `aspect-square` for user/entity grid cards
- Use `transition-all duration-300` on interactive elements
- Use `framer-motion` for entrance animations with staggered `delay: i * 0.03`
- Keep scrollbar hidden inside panels via `scrollbar-hide`

### ❌ DON'T
- Use `rounded`, `rounded-md`, `rounded-lg` on cards/surfaces — too sharp
- Use pure black `#000000` for text (use `text-slate-800` or `text-slate-900`)
- Use `overflow-y-auto` at the page root — only inside specific sub-containers
- Add a visible scrollbar — use `scrollbar-hide`
- Use plain background colors on cards — always use semi-transparent glass
- Use Tailwind default blue `bg-blue-500` as the primary active state — use `bg-slate-900`
- Copy-paste glass styles manually — import the `GLASS` constant

---

## 🔥 Quick Reference: Shadow Values

```ts
// Card (subtle lift)
boxShadow: '0 15px 35px -5px rgba(0,0,0,0.06), 0 10px 15px -6px rgba(0,0,0,0.04)'

// Active/Selected card (blue)
boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)'

// Stats banner
boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)'

// FormModal
boxShadow: '0 32px 80px rgba(0,0,0,0.12)'

// CTA Button (blue)
boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'

// Active status dot (emerald glow)
className="shadow-[0_0_8px_rgba(16,185,129,0.5)]"

// Bottom Capsule
boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
```
