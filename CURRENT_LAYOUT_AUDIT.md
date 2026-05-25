# Current Layout Audit — Known Issues & Fixes

Analysis of the PMV-ONE codebase to identify and fix layout issues.

---

## Summary

**Status:** 🔴 **Critical** layout issues detected

**Most Common Issues:**
1. Fixed heights (`h-[520px]`) without responsive fallback
2. Fixed column grids (`grid-cols-2`) that don't stack on mobile
3. Modals without proper scrollable content areas
4. Top bar elements that overlap on mobile/tablet
5. Missing `min-h-0` on flex children preventing scrolling

---

## Detailed Audit

### ✋ CRITICAL: src/components/layouts/PortalLayout.tsx

**Lines 275-279 — Content Container Issue**

```tsx
// CURRENT (PROBLEMATIC):
<div className="relative z-10 flex-1 overflow-hidden h-full">
  <div className="h-full w-full px-4 sm:px-6 md:px-12 lg:px-24">
    <Outlet context={{ view, showSearch }} />
  </div>
</div>

// ISSUES:
// 1. Nested div doesn't have flex layout — content can overflow width
// 2. No min-h-0 on Outlet container — prevents proper scrolling on child pages
// 3. Horizontal padding increases with screen size but doesn't account for content width

// RECOMMENDED FIX:
<div className="relative z-10 flex-1 overflow-hidden h-full flex flex-col">
  <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 md:px-12 lg:px-24 py-4">
    <Outlet context={{ view, showSearch }} />
  </div>
</div>
```

**Lines 91-226 — Top Bar Overlap Issue**

```tsx
// CURRENT (PROBLEMATIC):
<div className="relative z-20 flex items-center justify-between px-8 py-6">
  <div className="flex items-center gap-3">
    {/* Avatar, Name, Role, Time */}
  </div>
  <div className="hidden lg:flex flex-1 justify-center px-4">
    {/* Center portal */}
  </div>
  <div className="flex items-center gap-3">
    {/* Search, Buttons, Logout */}
  </div>
</div>

// ISSUES:
// 1. gap-3 is fixed — doesn't reduce on mobile → items overlap
// 2. No min-w-0 on left section → long names overflow
// 3. px-8 padding large on mobile
// 4. No responsive hidden/show — all elements fight for space on mobile

// RECOMMENDED FIX:
<div className="relative z-20 flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-4 sm:px-6 md:px-8 py-4 sm:py-6">
  <div className="flex items-center gap-2 min-w-0">
    {/* Avatar - always show */}
    {/* Name + Role - hide on small screens */}
  </div>
  <div className="hidden lg:flex flex-1 justify-center px-4 max-w-xl">
    {/* Center portal */}
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">
    {/* Buttons - reduce on mobile */}
  </div>
</div>
```

---

### 🟡 HIGH: src/features/curriculum/CurriculumManager.tsx

**Lines 93 — Fixed Height Two-Column Grid**

```tsx
// CURRENT (PROBLEMATIC):
<div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-[520px] overflow-hidden">
  <motion.div variants={cardAnim} className="flex flex-col h-full min-w-0">
    <SubjectMasterPanel ... />
  </motion.div>
  <div className="flex flex-col h-full min-w-0">
    <CurriculumMapPanel ... />
  </div>
</div>

// ISSUES:
// 1. Fixed h-[520px] doesn't respond to content on mobile
// 2. xl: breakpoint means it stacks below 1280px (should be lg at 1024px)
// 3. No horizontal scrollbar if panels are too narrow
// 4. Missing flex-shrink-0 on headers in panels

// RECOMMENDED FIX:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[400px] h-auto lg:h-[520px] overflow-hidden">
  <motion.div variants={cardAnim} className="flex flex-col h-full min-h-0 min-w-0">
    <SubjectMasterPanel ... />
  </motion.div>
  <motion.div variants={cardAnim} className="flex flex-col h-full min-h-0 min-w-0">
    <CurriculumMapPanel ... />
  </motion.div>
</div>

// KEY CHANGES:
// - lg: instead of xl: (stacks at 1024px, not 1280px)
// - min-h-[400px] for mobile (something visible)
// - h-auto lg:h-[520px] (responsive height)
// - min-h-0 on children (enables scrolling)
```

---

### 🟡 HIGH: src/features/schedule/ScheduleEditor.tsx

**Likely Issue — Similar Pattern**

```tsx
// PATTERN TO FIX:
// If this file has: <div className="grid grid-cols-2 gap-4 h-[600px]">
// Change to:      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[300px] h-auto lg:h-[600px]">
```

---

### 🟡 HIGH: All Modal Components

**Pattern — AddSubjectModal.tsx, ScheduleSlotModal.tsx, NewSyllabusModal.tsx, etc.**

```tsx
// CURRENT PATTERN (PROBLEMATIC):
<motion.div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
    <h2>Title</h2>
    <form className="space-y-4">
      {/* Many form fields */}
    </form>
    <div className="mt-4 flex gap-2">
      <button>Cancel</button>
      <button>Save</button>
    </div>
  </div>
</motion.div>

// ISSUES:
// 1. No max-height on modal → tall forms clip buttons on mobile
// 2. No scrollable content area → buttons get pushed off screen
// 3. No flex layout → can't separate header/content/footer
// 4. Single <form> with space-y-4 → if form is long, buttons disappear

// RECOMMENDED FIX:
<motion.div 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20"
>
  <motion.div 
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
  >
    {/* HEADER */}
    <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200">
      <h2 className="text-lg font-bold">Title</h2>
    </div>

    {/* CONTENT — Scrolls if needed */}
    <form className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Form fields */}
    </form>

    {/* FOOTER — Buttons always visible */}
    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 flex gap-2 justify-end">
      <button>Cancel</button>
      <button>Save</button>
    </div>
  </motion.div>
</motion.div>
```

---

### 🟡 HIGH: All Glassmorphism Cards

**Pattern — Any component using `GLASS` style from PortalLayout**

```tsx
// CURRENT ISSUE:
<div style={GLASS} className="p-4">
  <p className="text-sm">{user.veryLongDisplayName}</p>
</div>

// PROBLEM: Long text overflows glass card on mobile

// FIX:
<div style={GLASS} className="p-4 min-w-0">
  <p className="text-sm truncate">{user.veryLongDisplayName}</p>
</div>

// OR for descriptions:
<div style={GLASS} className="p-4 min-w-0">
  <p className="text-sm line-clamp-2">{description}</p>
</div>
```

---

### 🟡 MEDIUM: Card Grids

**Pattern — Dashboard pages, Event lists, etc.**

```tsx
// CURRENT (PROBLEMATIC):
<div className="grid grid-cols-4 gap-3">
  {items.map(item => (
    <div key={item.id} className="p-4 rounded-lg">
      <p className="text-sm">{item.longTitle}</p>
    </div>
  ))}
</div>

// ISSUES:
// 1. grid-cols-4 doesn't stack on mobile (too many columns, too narrow)
// 2. Text will overflow narrow cards
// 3. No responsive breakpoints

// RECOMMENDED FIX:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
  {items.map(item => (
    <div key={item.id} className="p-4 rounded-lg">
      <p className="text-sm truncate">{item.longTitle}</p>
    </div>
  ))}
</div>

// BREAKDOWN:
// - 1 column on mobile (< 640px)
// - 2 columns on small devices (640px+)
// - 3 columns on desktop (1024px+)
// - 4 columns on large desktop (1280px+)
```

---

### 🟢 GOOD PATTERNS (Don't Change)

1. **src/components/layouts/PortalLayout.tsx Lines 163-172** — Center portal area
   - ✓ Uses `hidden lg:flex` appropriately
   - ✓ `max-w-xl` limits width on large screens

2. **src/features/curriculum/CurriculumManager.tsx Line 80** — Container with padding
   - ✓ Uses `pb-16` to account for floating buttons below
   - ✓ `overflow-hidden` prevents content bleed

---

## Implementation Priority

### Phase 1 (Critical) — This Week
- [ ] Fix PortalLayout top bar (gap-3 → responsive gaps)
- [ ] Fix PortalLayout content container (add flex + min-h-0)
- [ ] Test at 375px, 768px, 1024px

### Phase 2 (High) — Next Week
- [ ] Fix CurriculumManager grid height
- [ ] Fix all modal components (add scrollable content area)
- [ ] Test all modals on mobile

### Phase 3 (Medium) — Following Week
- [ ] Fix card grids (add responsive columns)
- [ ] Add truncation to all long text
- [ ] Accessibility review (focus states, touch targets)

---

## Testing Checklist

For each fix, test at:

```
Mobile (375px)
├─ No overlapping text/buttons
├─ All buttons fully visible
├─ No horizontal scroll
└─ All interactive elements clickable

Tablet (768px)
├─ Two-column layouts work
├─ Scrollbars appear when needed
├─ Glassmorphism cards readable
└─ Forms properly aligned

Desktop (1024px+)
├─ Three-column layouts work
├─ Proper spacing between elements
├─ No unnecessary scrolling
└─ Responsive design looks intentional
```

---

## Files to Audit & Fix

| File | Issue | Priority | Status |
|------|-------|----------|--------|
| `PortalLayout.tsx` | Top bar overlap + content overflow | 🔴 Critical | 📋 Ready |
| `CurriculumManager.tsx` | Fixed grid height | 🟡 High | 📋 Ready |
| `ScheduleEditor.tsx` | Likely fixed grid height | 🟡 High | 📋 Review |
| `SyllabusManager.tsx` | Likely modal clipping | 🟡 High | 📋 Review |
| All modal components | Scrollable content area | 🟡 High | 📋 Ready |
| All card grids | Responsive columns | 🟡 High | 📋 Ready |
| All text content | Truncation on overflow | 🟢 Medium | 📋 Ready |

---

## Quick Reference: Copy-Paste Fixes

### Fix 1: Responsive gaps
```tsx
// Before
gap-3

// After
gap-2 sm:gap-3 md:gap-4
```

### Fix 2: Responsive padding
```tsx
// Before
px-8

// After
px-4 sm:px-6 md:px-8
```

### Fix 3: Responsive columns
```tsx
// Before
grid-cols-2

// After
grid-cols-1 lg:grid-cols-2
```

### Fix 4: Responsive height
```tsx
// Before
h-[520px]

// After
min-h-[400px] h-auto lg:h-[520px]
```

### Fix 5: Scrollable flex children
```tsx
// Before
<div className="h-full">

// After
<div className="h-full min-h-0 overflow-y-auto">
```

### Fix 6: Text truncation
```tsx
// Before
<p>{longText}</p>

// After
<p className="truncate">{longText}</p>
```

---

**Last Updated:** 2026-04-25
**Next Review:** After Phase 1 fixes are completed
