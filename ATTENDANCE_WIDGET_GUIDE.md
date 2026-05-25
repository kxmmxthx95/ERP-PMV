# Attendance Check-In Widget - Integration Guide

## Overview

I've created a **reusable, standalone attendance check-in widget** for your school management app. It extracts the core check-in/check-out functionality into a flexible component that can be embedded anywhere in your dashboards and portals.

## What's New

### 1. **AttendanceCheckInWidget.tsx**
   - Location: `src/components/attendance/AttendanceCheckInWidget.tsx`
   - Reusable widget component with two display modes
   - Builds on existing hooks: `useStaffAttendance()`, `useAuth()`, `useAttendanceConfig()`

### 2. **Two Display Modes**

#### Compact Mode (`compact={true}`)
- Small card suitable for dashboards, sidebars, widget grids
- Shows: Name, status badge, current time, check-in/out buttons
- Size: ~350px wide
- Perfect for: Home pages, dashboard widgets, quick access panels

#### Full Mode (default)
- Large hero card with prominent clock and animation
- Shows: Live clock, check-in/out times, 7-day history (optional)
- Perfect for: Dedicated attendance pages, staff portals

### 3. **Key Features**
- ✅ Real-time live clock with seconds
- ✅ Thai locale date/time formatting
- ✅ Status badges (on-time, late, absent)
- ✅ Glassmorphism design (consistent with your app)
- ✅ Smooth animations and transitions
- ✅ Error handling with animated messages
- ✅ 7-day attendance history view
- ✅ Loading states
- ✅ Accessibility-friendly icons

## Quick Start

### 1. Use in Dashboard/Home Page
```tsx
import AttendanceCheckInWidget from '@/components/attendance/AttendanceCheckInWidget';

export function HomePage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Compact widget in dashboard grid */}
      <div>
        <h3 className="font-bold mb-3">Attendance</h3>
        <AttendanceCheckInWidget compact={true} />
      </div>
      
      {/* Other widgets */}
    </div>
  );
}
```

### 2. Use in Staff Portal
```tsx
export function StaffPortal() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Full widget with history */}
      <AttendanceCheckInWidget
        showHistory={true}
        onStatusChange={(status) => {
          console.log('Current status:', status);
        }}
      />
    </div>
  );
}
```

### 3. Use as Sidebar Widget
```tsx
// In your layout/sidebar
<div className="sticky top-4">
  <AttendanceCheckInWidget compact={true} />
</div>
```

## Props Reference

```typescript
interface AttendanceCheckInWidgetProps {
  compact?: boolean;                    // Default: false
  showHistory?: boolean;                // Default: false
  onStatusChange?: (status: AttendanceStatus) => void;
}

type AttendanceStatus = 'present' | 'late' | 'absent';
```

## Component Structure

```
AttendanceCheckInWidget
├── LiveClock (real-time clock display)
├── StatusBadge (present/late/absent indicator)
├── Check-in Button
├── Check-out Button
└── [Optional] 7-Day History
```

## Dependencies

The widget depends on existing hooks in your codebase:
- `useAuth()` — Get current user info
- `useStaffAttendance()` — Check-in/out logic & state
- `useAttendanceConfig()` — Attendance settings
- `useStaffAttendance` type exports: `AttendanceStatus`, `StaffAttendanceRecord`

**No new dependencies added** — uses your existing setup!

## Integration Points

### 1. Home/Dashboard Pages
```tsx
// In src/portals/staff/HomePage.tsx or similar
<AttendanceCheckInWidget compact={true} showHistory={false} />
```

### 2. Staff Portal
```tsx
// In src/portals/staff/AttendancePage.tsx
<AttendanceCheckInWidget compact={false} showHistory={true} />
```

### 3. Admin Dashboard
```tsx
// Optional: Show staff attendance status
<AttendanceCheckInWidget compact={true} onStatusChange={handleStatusChange} />
```

## Styling

The widget uses:
- **Tailwind CSS** for all styling
- **Glassmorphism** theme from `WIDGET_GLASS` constant
- **Thai locale** for dates and times (already configured)
- **Framer Motion** for animations

All colors and spacing are consistent with your existing design system.

## Real-World Examples

See `src/components/attendance/AttendanceWidgetExamples.tsx` for:
- Dashboard grid layout
- Staff portal full page
- Home page widget
- Sidebar integration
- Mobile responsive layout
- Role-based conditional rendering
- With state management

## Next Steps (Optional Enhancements)

1. **Export to CSV/PDF** — Add export button to history
2. **Offline Support** — Queue check-in when offline
3. **QR Code** — Scan for check-in (add qrcode-reader)
4. **Biometric** — Fingerprint check-in (platform-specific)
5. **Notifications** — Alert user/admin on late arrival
6. **Analytics** — Track attendance patterns (week/month views)

## Testing

To test the widget locally:

```bash
# 1. Start your dev server
npm run dev

# 2. Navigate to a page using the widget
# Example: http://localhost:5173/staff/dashboard

# 3. Click "เช็คอิน" (check-in) button
# 4. Time should update - verify clock updates every second
# 5. Status badge should show "มาตรงเวลา"
# 6. Click "เช็คเอาต์" (check-out) button
# 7. History should show today's record (if showHistory={true})
```

## File Summary

```
src/components/attendance/
├── AttendanceCheckInWidget.tsx      (Main widget)
├── AttendanceWidgetExamples.tsx     (Integration examples)
└── README.md                         (Usage documentation)

ATTENDANCE_WIDGET_GUIDE.md            (This file)
```

## FAQ

**Q: Can I customize the colors?**
A: Yes! Modify the `STATUS_CONFIG` object or pass a theme prop (you could extend it).

**Q: Does it work offline?**
A: Currently it requires Firebase connection. You can enhance it with offline support.

**Q: Can students/parents see their child's attendance?**
A: This widget is for staff check-in only. For student/parent attendance view, you'd need a separate component.

**Q: How do I change the language?**
A: The component uses Thai locale (`'th-TH'`). Change locale strings for other languages.

**Q: Can multiple people check in on the same device?**
A: Yes! Each user logs in separately via `useAuth()`, so different users get different records.

---

**Created:** May 4, 2026
**Framework:** React 18 + Tailwind CSS
**Backend:** Firebase (Firestore)
