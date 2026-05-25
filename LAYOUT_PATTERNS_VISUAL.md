# Visual Layout Patterns Reference

Quick visual reference for the 7 main layout patterns used in PMV-ONE.

---

## Pattern 1: Responsive Top Bar

```
MOBILE (375px)           TABLET (768px)           DESKTOP (1024px+)
┌──────────────────┐    ┌────────────────────┐    ┌──────────────────────────┐
│ 👤 🔍 ⏹ 🚪      │    │ 👤 Name Role 🔍 ⏹ 🚪│   │ 👤 Name  Role │ Time/Date  🔍 ⏹ 🚪│
└──────────────────┘    └────────────────────┘    └──────────────────────────┘
(Icons only)            (More space)               (Full layout)

KEY RULES:
• gap-2 sm:gap-3 md:gap-4 (responsive gaps)
• min-w-0 on left section (allows shrinking)
• hidden sm:block (show/hide based on screen)
• flex-shrink-0 on buttons (don't shrink)
```

---

## Pattern 2: Two-Column Manager Layout

```
MOBILE (375px)           TABLET (768px)           DESKTOP (1024px+)
┌──────────────────┐    ┌─────────┬──────────┐    ┌──────────────┬──────────┐
│ Left Panel       │    │ Left    │ Right    │    │ Left Panel   │ Right    │
│ (full width)     │    │ Panel   │ Panel    │    │ (50% width)  │ Panel    │
│                  │    │ (50%)   │ (50%)    │    │              │ (50%)    │
└──────────────────┘    └─────────┴──────────┘    └──────────────┴──────────┘

KEY STRUCTURE:
┌─ Main Container (grid grid-cols-1 lg:grid-cols-2 gap-3)
├─ Left Panel (flex flex-col h-full min-h-0)
│  ├─ Header (flex-shrink-0)
│  └─ List (flex-1 overflow-y-auto) ← Scrolls
│
└─ Right Panel (flex flex-col h-full min-h-0)
   ├─ Header (flex-shrink-0)
   └─ Content (flex-1 overflow-y-auto) ← Scrolls

HEIGHT:
• Mobile: auto (stacks naturally)
• Tablet/Desktop: h-[520px] (fixed)
```

---

## Pattern 3: Modal with Scrollable Content

```
MOBILE (375px)           TABLET (768px)           DESKTOP (1024px+)
┌──────────────────┐    ┌─────────────────────┐   ┌─────────────────────┐
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁  │    │ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  │   │ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  │
│ Dialog Title   │    │ Dialog Title        │   │ Dialog Title        │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │    │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │   │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │
│                  │    │                    │   │                    │
│ [Field 1]      │    │ [Field 1]          │   │ [Field 1]          │
│ [Field 2]      │    │ [Field 2]          │   │ [Field 2]          │
│ [Field 3] ←    │    │ [Field 3]          │   │ [Field 3]          │
│ [Field 4] ←    │ ← Scrolls if needed   │   │ [Field 4]          │
│ [Field 5] ←    │                        │   │ [Field 5]          │
│ [Field 6] ←    │                        │   │ [Field 6]          │
│ ▲▲▲▲▲▲▲▲▲▲▲▲▲▲  │    │ ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  │   │ ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  │
│ [Cancel] [Save]│    │ [Cancel] [Save]    │   │ [Cancel] [Save]    │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │    │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │   │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │
└──────────────────┘    └─────────────────────┘   └─────────────────────┘

KEY STRUCTURE:
┌─ Fixed Modal Overlay (fixed inset-0)
└─ Modal Container (max-h-[90vh] flex flex-col)
   ├─ Header (flex-shrink-0) ← Never scrolls
   ├─ Content (flex-1 overflow-y-auto) ← Scrolls if needed
   └─ Footer (flex-shrink-0) ← Always visible

SCROLLING:
✓ Content scrolls vertically if form is long
✓ Buttons always visible at bottom
✓ On mobile, modal takes 90% of viewport
✓ On desktop, modal max-width is limited
```

---

## Pattern 4: Card Grid with Responsive Columns

```
MOBILE            SMALL TABLET          TABLET/DESKTOP        LARGE DESKTOP
1 col × 4 rows    2 cols × 2 rows       3 cols × 2 rows       4 cols × 2 rows

[    Card 1    ]  [ Card 1 ] [ Card 2 ] [ Card 1 ][ Card 2 ][ Card 3 ][ Card 1 ][ Card 2 ][ Card 3 ][ Card 4 ]
[    Card 2    ]  [ Card 3 ] [ Card 4 ] [ Card 4 ][ Card 5 ][ Card 6 ][ Card 5 ][ Card 6 ][ Card 7 ][ Card 8 ]
[    Card 3    ]
[    Card 4    ]

RESPONSIVE CLASS:
grid-cols-1           → 1 column on mobile
sm:grid-cols-2        → 2 columns on 640px+
lg:grid-cols-3        → 3 columns on 1024px+
xl:grid-cols-4        → 4 columns on 1280px+

KEY RULES:
• gap-3 (consistent spacing)
• truncate on titles (prevent overflow)
• line-clamp-2 on descriptions (limit lines)
```

---

## Pattern 5: Form Layout

```
SINGLE COLUMN (mobile/tablet):
┌──────────────────────────┐
│ Label                    │
│ ┌──────────────────────┐ │
│ │ Input Field          │ │
│ └──────────────────────┘ │
│                          │
│ Label                    │
│ ┌──────────────────────┐ │
│ │ Input Field          │ │
│ └──────────────────────┘ │
└──────────────────────────┘

TWO COLUMN (desktop):
┌──────────────────────────────────────────┐
│ Label              │ Label                │
│ ┌────────────────┐ │ ┌────────────────┐  │
│ │ Input 1        │ │ │ Input 2        │  │
│ └────────────────┘ │ └────────────────┘  │
│                    │                      │
│ [Long Label]       │                      │
│ ┌──────────────────────────────────────┐ │
│ │ Full Width Input                     │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘

RESPONSIVE CLASS:
grid grid-cols-1 sm:grid-cols-2 gap-4

KEY RULES:
• space-y-4 (vertical spacing between groups)
• w-full on inputs (full width of container)
• focus:outline-2 (visible focus state)
```

---

## Pattern 6: Tab Navigation with Content

```
┌────────────────────────────────────────────────┐
│ [Tab 1] [Tab 2] [Tab 3]                        │ ← Tab bar (flex-shrink-0)
├────────────────────────────────────────────────┤
│                                                │
│  Content for active tab                        │
│  Scrolls if content is long                    │
│  Takes remaining vertical space (flex-1)       │
│                                                │
│  [Field 1]                                    │
│  [Field 2]                                    │
│  [Field 3]                                    │
│                                                │
│  ← Can scroll                                  │
│                                                │
│  [Last field]                                 │
│                                                │
└────────────────────────────────────────────────┘

STRUCTURE:
┌─ Container (flex flex-col h-full)
├─ Tabs (flex-shrink-0) ← Never scrolls
│  ├─ [Tab 1] (whitespace-nowrap)
│  ├─ [Tab 2]
│  └─ [Tab 3]
│
└─ Content (flex-1 min-h-0 overflow-y-auto) ← Scrolls

KEY RULES:
• Tab bar: flex-shrink-0 (always visible)
• Content: flex-1 min-h-0 overflow-y-auto (scrollable)
• Tab buttons: whitespace-nowrap (don't wrap)
```

---

## Pattern 7: Alert Banner

```
ALERT AT TOP (doesn't cover content):

┌──────────────────────────────────────────────────┐
│ ⚠ Warning Message                            [×] │ ← Alert (flex-shrink-0)
├──────────────────────────────────────────────────┤
│                                                  │
│  Main Content Area                               │
│  Takes remaining space                           │
│  Scrolls if needed                               │
│  (flex-1 overflow-auto)                          │
│                                                  │
└──────────────────────────────────────────────────┘

STRUCTURE:
┌─ Main Container (flex flex-col h-screen)
├─ Alert Banner (flex-shrink-0 animate)
│  ├─ Icon (flex-shrink-0)
│  ├─ Message (flex-1 min-w-0 break-words)
│  └─ Close Button (flex-shrink-0)
│
└─ Content (flex-1 overflow-auto)

KEY RULES:
• Alert: flex-shrink-0 (always visible)
• Message: min-w-0 break-words (text wraps)
• Content: flex-1 overflow-auto (takes remaining space)
```

---

## Common Flexbox Mistakes & Fixes

### ❌ WRONG: Fixed height prevents scrolling
```tsx
<div className="h-[500px]">
  <div>Content can't scroll!</div>
</div>
```

### ✅ RIGHT: Flex layout enables scrolling
```tsx
<div className="flex flex-col h-full">
  <div className="flex-1 min-h-0 overflow-y-auto">
    Content can scroll!
  </div>
</div>
```

---

### ❌ WRONG: Fixed gaps on mobile
```tsx
gap-6  ← Too big on mobile, elements overlap
```

### ✅ RIGHT: Responsive gaps
```tsx
gap-2 sm:gap-3 md:gap-4 lg:gap-6  ← Adapts to screen size
```

---

### ❌ WRONG: Two-column always
```tsx
grid grid-cols-2  ← Too narrow on mobile
```

### ✅ RIGHT: Responsive columns
```tsx
grid grid-cols-1 lg:grid-cols-2  ← Stacks on mobile, side-by-side on desktop
```

---

### ❌ WRONG: Text overflows
```tsx
<p>{veryLongTextThatExceedsWidth}</p>
```

### ✅ RIGHT: Text truncates
```tsx
<p className="truncate">{veryLongTextThatExceedsWidth}</p>
```

---

## Responsive Breakpoint Reference

```
Mobile        Tablet        Desktop       Large
┌─────────┬──────────┬──────────┬──────────┐
│ (< 640) │ 640-1023 │ 1024-1279│ 1280+    │
│         │          │          │          │
│ default │ sm:      │ lg:      │ xl:      │
│         │ md:      │          │ 2xl:     │
└─────────┴──────────┴──────────┴──────────┘

EXAMPLE:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                │                    │                    │
            mobile              tablet           desktop/large
```

---

## CSS Classes You'll Use Most

```
LAYOUT:
• flex / flex-col / flex-row
• grid / grid-cols-1 / grid-cols-2 / grid-cols-3
• gap-2 / gap-3 / gap-4
• h-full / h-screen / min-h-screen
• w-full / w-auto / max-w-2xl / min-w-0

SIZING:
• flex-1 (take remaining space)
• flex-shrink-0 (don't shrink)
• flex-grow-0 (don't grow)
• min-h-0 (CRITICAL for scrolling!)

SCROLLING:
• overflow-hidden (no scroll)
• overflow-auto (scroll if needed)
• overflow-y-auto (vertical scroll only)
• overflow-x-auto (horizontal scroll only)

RESPONSIVE:
• hidden / block (show/hide)
• sm:block / md:block / lg:block (show at breakpoint)
• sm:text-sm / md:text-base / lg:text-lg (responsive text)
• sm:gap-3 / md:gap-4 / lg:gap-6 (responsive gaps)

TEXT:
• truncate (single line ellipsis)
• line-clamp-2 / line-clamp-3 (limit lines)
• break-words (wrap long words)
• whitespace-nowrap (don't wrap)

POSITIONING:
• fixed / absolute / relative
• inset-0 (full coverage)
• p-4 / px-4 / py-4 (padding)
```

---

## Quick Pattern Selection Guide

```
Question                          → Pattern
─────────────────────────────────────────────────────
I need a header/sidebar          → Pattern 1: Responsive Top Bar
I need left list + right detail  → Pattern 2: Two-Column Manager
I need a form in a dialog        → Pattern 3: Modal with Content
I need multiple cards            → Pattern 4: Card Grid
I need a form with fields        → Pattern 5: Form Layout
I need tabs with content         → Pattern 6: Tab Navigation
I need to show a message         → Pattern 7: Alert Banner
```

---

**Last Updated:** 2026-04-25
**Ready to use!**
