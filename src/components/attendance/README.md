# Attendance Check-In Widget

A reusable, flexible widget for staff attendance check-in/check-out functionality.

## Features

- ✅ Real-time clock display
- ✅ Check-in and check-out buttons
- ✅ Status badge (on-time, late, absent)
- ✅ 7-day history view
- ✅ Error handling with animations
- ✅ Glassmorphism design
- ✅ Two display modes: compact and full

## Usage

### Basic (Full Version)
```tsx
import AttendanceCheckInWidget from '@/components/attendance/AttendanceCheckInWidget';

export function MyPage() {
  return <AttendanceCheckInWidget />;
}
```

### Compact Version
```tsx
<AttendanceCheckInWidget compact={true} />
```

### With History
```tsx
<AttendanceCheckInWidget showHistory={true} />
```

### With Status Change Callback
```tsx
<AttendanceCheckInWidget
  onStatusChange={(status) => {
    console.log('Current status:', status);
  }}
/>
```

### Complete Example
```tsx
<AttendanceCheckInWidget
  compact={false}
  showHistory={true}
  onStatusChange={(status) => {
    // Send notification, update parent state, etc.
  }}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `compact` | boolean | false | Show minimal compact version |
| `showHistory` | boolean | false | Display 7-day attendance history |
| `onStatusChange` | (status: AttendanceStatus) => void | undefined | Callback when status changes |

## Status Values

- `present` — On time
- `late` — Late arrival
- `absent` — Absent

## Integration Points

The widget uses existing hooks:
- `useAuth()` — Get current user info
- `useStaffAttendance()` — Handle check-in/out logic
- `useAttendanceConfig()` — Get attendance settings

## Display Sizes

### Full Version (default)
- Hero card with large clock
- Check-in/out button
- Optional 7-day history below

### Compact Version
- Small card (suitable for dashboards)
- Small clock
- Check-in/out button
- Suitable for widget grids or sidebars
