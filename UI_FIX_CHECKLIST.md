# UI Layout & Responsive Design Fix Checklist

This document outlines all the layout improvements needed to fix overlapping, overflow, and clipping issues in the PMV-ONE portal.

## Priority 1: Core Layout Issues (Immediate)

### [ ] PortalLayout.tsx — Ensure proper page content container
**File:** `src/components/layouts/PortalLayout.tsx` (Line 275-279)

**Issue:** Page content might overflow on smaller screens or modals might clip buttons

**Fix:**
```tsx
// Current (275-279):
<div className="relative z-10 flex-1 overflow-hidden h-full">
  <div className="h-full w-full px-4 sm:px-6 md:px-12 lg:px-24">
    <Outlet context={{ view, showSearch }} />
  </div>
</div>

// Should add proper responsive padding:
<div className="relative z-10 flex-1 overflow-hidden h-full">
  <div className="h-full w-full flex flex-col min-h-0">
    <div className="flex-1 overflow-auto px-4 sm:px-6 md:px-12 lg:px-24 py-4">
      <Outlet context={{ view, showSearch }} />
    </div>
  </div>
</div>
```

### [ ] Top Bar — Prevent text overlap on mobile
**File:** `src/components/layouts/PortalLayout.tsx` (Line 91-226)

**Issue:** Avatar, name, role capsule, and buttons might overlap on mobile/tablet

**Fix Approach:**
- Use `flex items-center justify-between gap-2 sm:gap-4` instead of `gap-3`
- Hide unnecessary labels on mobile (`hidden sm:block` or `hidden md:inline`)
- Test at 375px (mobile), 768px (tablet), 1024px (desktop)
- Reduce font sizes on mobile: `text-xs md:text-sm`

---

## Priority 2: Page-Level Layouts (Manager Pages)

### [ ] CurriculumManager.tsx — Fix grid overflow
**File:** `src/features/curriculum/CurriculumManager.tsx` (Line 93-110)

**Current Issue:** Two-column grid with fixed `h-[520px]` might clip content on smaller screens

**Fix:**
```tsx
// Line 93: Change fixed height to responsive
// BEFORE:
<div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-[520px] overflow-hidden">

// AFTER:
<div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-[400px] lg:h-[520px] overflow-hidden">
```

### [ ] SubjectMasterPanel & CurriculumMapPanel — Add scrollbar support
**Pattern:** These panels have fixed heights but might contain long lists

**Fix:** Ensure internal scroll containers:
```tsx
<div className="flex flex-col h-full min-h-0">
  <div className="flex-shrink-0 p-4 border-b">
    {/* Header/Filter */}
  </div>
  <div className="flex-1 min-h-0 overflow-y-auto">
    {/* Scrollable list content */}
  </div>
</div>
```

---

## Priority 3: Modals & Dialogs

### [ ] All Modal Components — Prevent button clipping
**Pattern:** Any modal with title, content, and action buttons

**Check:** In files like:
- `src/features/curriculum/components/AddSubjectModal.tsx`
- `src/features/schedule/components/ScheduleSlotModal.tsx`
- `src/features/syllabus/components/NewSyllabusModal.tsx`

**Fix Template:**
```tsx
<motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  {/* Overlay/Backdrop */}
  <motion.div className="bg-white rounded-2xl shadow-2xl max-h-[90vh] w-full max-w-2xl flex flex-col overflow-hidden">
    
    {/* Header — Does not scroll */}
    <div className="flex-shrink-0 px-6 py-4 border-b">
      <h2 className="text-lg font-bold text-slate-800">Title</h2>
    </div>

    {/* Content — Scrollable if long */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Long form fields */}
    </div>

    {/* Footer with buttons — Does not scroll */}
    <div className="flex-shrink-0 px-6 py-4 border-t flex gap-2 justify-end">
      <button onClick={onCancel} className="...">Cancel</button>
      <button onClick={onSave} className="...">Save</button>
    </div>
  </motion.div>
</motion.div>
```

---

## Priority 4: Cards & Glassmorphism

### [ ] Check all glass-styled cards for overflow
**Pattern:** Any element using `GLASS` style from PortalLayout

**Files to Check:**
- `src/features/curriculum/components/CurriculumFilterCard.tsx`
- `src/features/calendar/components/EventStrip.tsx`
- `src/features/schedule/components/ScheduleGrid.tsx`

**Fix:** Add proper truncation/wrapping:
```tsx
// BEFORE:
<div style={GLASS} className="p-4">
  <p className="text-sm">{veryLongTitle}</p>
</div>

// AFTER:
<div style={GLASS} className="p-4 min-w-0">
  <p className="text-sm truncate">{veryLongTitle}</p>
</div>
```

---

## Priority 5: Responsive Testing

### [ ] Test all pages at these breakpoints:
- **Mobile:** 375px (iPhone SE)
- **Tablet:** 768px (iPad)
- **Desktop:** 1024px+ (Desktop)
- **Large Desktop:** 1920px (4K)

**Use Firefox/Chrome DevTools:**
1. Press `F12` → Toggle Device Toolbar
2. Test at each breakpoint
3. Check for:
   - ✓ No overlapping text/buttons
   - ✓ No text overflowing container
   - ✓ All buttons clickable (not clipped)
   - ✓ Scrollbars appear when needed
   - ✓ No horizontal scroll on mobile

### [ ] Specific components to test:
1. **Login/Signup pages** — Form labels/inputs shouldn't overflow
2. **Dashboard pages** — Cards should reflow responsively
3. **Manager pages** (Curriculum, Schedule, Syllabus) — Two-column layouts should stack on tablet
4. **Teacher Portal** — Syllabus weekly planner should be readable on all sizes
5. **Mobile view** — Menu items should be accessible without zooming

---

## Priority 6: Accessibility Improvements

### [ ] Add proper focus outlines
All interactive elements need visible focus states:
```tsx
<button className="... focus:outline-2 focus:outline-offset-2 focus:outline-blue-500">
  Click me
</button>
```

### [ ] Ensure minimum touch target size
Buttons and interactive elements should be at least 44x44px on mobile:
```tsx
<button className="h-10 w-10 md:h-9 md:w-9 flex items-center justify-center">
  {/* Icon */}
</button>
```

### [ ] Add aria-labels to icon-only buttons
```tsx
<button aria-label="Search" onClick={() => setShowSearch(true)}>
  <Search size={16} />
</button>
```

---

## File-by-File Audit

| File Path | Issue Type | Status |
|-----------|-----------|--------|
| `src/components/layouts/PortalLayout.tsx` | Overlap on mobile | 📋 Needs review |
| `src/features/curriculum/CurriculumManager.tsx` | Grid height | 📋 Needs review |
| `src/features/schedule/ScheduleEditor.tsx` | Grid overflow | 📋 Needs review |
| `src/features/syllabus/SyllabusManager.tsx` | Modal clipping | 📋 Needs review |
| Modal components (*.tsx) | Button clipping | 📋 Needs review |
| All pages | Responsive testing | 📋 Needs testing |

---

## Implementation Steps

1. **Start with PortalLayout** — This is the shell, affects everything below
2. **Fix manager pages** — Apply flex/grid patterns consistently
3. **Test at 375px, 768px, 1024px** — Use DevTools device emulation
4. **Fix modals last** — They build on the above patterns
5. **Accessibility pass** — Focus states, touch targets, labels

---

## Quick Win: Common Fixes

### Fix 1: Prevent text overflow
```tsx
// Change from:
<p>{longText}</p>

// To:
<p className="truncate">{longText}</p>
// OR for wrapping:
<p className="break-words">{longText}</p>
```

### Fix 2: Prevent button clipping in forms
```tsx
// Wrap form in scrollable container:
<div className="max-h-[80vh] flex flex-col">
  <div className="flex-1 overflow-y-auto">{formFields}</div>
  <div className="flex-shrink-0 p-4 border-t">{submitButton}</div>
</div>
```

### Fix 3: Make two-column grid responsive
```tsx
// Change from:
<div className="grid grid-cols-2 gap-4">

// To:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

---

## Resources

- [Tailwind Flexbox Docs](https://tailwindcss.com/docs/display#flex)
- [Tailwind Grid Docs](https://tailwindcss.com/docs/display#grid)
- [Tailwind Gap Docs](https://tailwindcss.com/docs/gap)
- [Tailwind Overflow Docs](https://tailwindcss.com/docs/overflow)
- [Firefox DevTools Responsive Design](https://developer.mozilla.org/en-US/docs/Tools/Responsive_Design_Mode)

---

**Last Updated:** 2026-04-25
**Status:** Ready for implementation
