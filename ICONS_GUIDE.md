# Google Material Symbols Icons Guide

## Setup Complete ✅

Material Symbols icons are now fully configured in your project with 3 variants:
- **Outlined** (default)
- **Rounded** (softer edges)
- **Sharp** (crisp edges)

---

## How to Use

### 1. **Material Symbols Outlined** (Default Style)
```jsx
<span className="material-symbols-outlined">home</span>
<span className="material-symbols-outlined">mail</span>
<span className="material-symbols-outlined">settings</span>
```

### 2. **Material Symbols Rounded** (Soft & Modern)
```jsx
<span className="material-symbols-rounded">home</span>
<span className="material-symbols-rounded">mail</span>
<span className="material-symbols-rounded">settings</span>
```

### 3. **Material Symbols Sharp** (Crisp & Clean)
```jsx
<span className="material-symbols-sharp">home</span>
<span className="material-symbols-sharp">mail</span>
<span className="material-symbols-sharp">settings</span>
```

---

## Customizing Icon Size

Add inline style or Tailwind classes:

```jsx
{/* Different sizes */}
<span className="material-symbols-outlined" style={{ fontSize: '16px' }}>home</span>
<span className="material-symbols-outlined" style={{ fontSize: '24px' }}>home</span>
<span className="material-symbols-outlined" style={{ fontSize: '48px' }}>home</span>

{/* With Tailwind */}
<span className="material-symbols-outlined text-sm">home</span>
<span className="material-symbols-outlined text-2xl">home</span>
<span className="material-symbols-outlined text-4xl">home</span>
```

---

## Customizing Icon Weight

```jsx
{/* Font weight (100-700) */}
<span className="material-symbols-outlined" style={{ fontWeight: 100 }}>home</span>
<span className="material-symbols-outlined" style={{ fontWeight: 400 }}>home</span>
<span className="material-symbols-outlined" style={{ fontWeight: 700 }}>home</span>
```

---

## Customizing Icon Fill

```jsx
{/* Filled vs Outlined */}
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>home</span>
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
```

---

## Color Customization

```jsx
{/* With Tailwind */}
<span className="material-symbols-outlined text-blue-500">home</span>
<span className="material-symbols-outlined text-red-600">alert</span>
<span className="material-symbols-outlined text-green-500">check_circle</span>

{/* With inline style */}
<span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>home</span>
```

---

## Common Icons Used in This Project

### Authentication & User
- `login` - Login icon
- `logout` - Logout icon
- `person` - User profile
- `admin_panel_settings` - Admin settings

### Navigation
- `home` - Home/Dashboard
- `menu` - Menu/Hamburger
- `close` - Close/Cancel
- `arrow_back` - Back button
- `arrow_forward` - Next button

### Actions
- `add` - Add new
- `edit` - Edit
- `delete` - Delete
- `save` - Save
- `check` - Confirm/Done
- `refresh` - Refresh/Reload

### Notifications & Status
- `notifications` - Notifications
- `mail` - Email/Messages
- `check_circle` - Success
- `error` - Error
- `warning` - Warning
- `info` - Information

### Academic/School
- `school` - School
- `assignment` - Assignment/Grades
- `schedule` - Schedule/Timetable
- `person_add` - Add student
- `group` - Class/Group
- `event` - Event
- `today` - Today/Current date

### Settings & Tools
- `settings` - Settings
- `search` - Search
- `filter_list` - Filter
- `sort` - Sort
- `download` - Download
- `upload` - Upload
- `print` - Print
- `logout` - Sign out

---

## Full Icon List

Visit: **https://fonts.google.com/icons**

Search and copy any icon name to use in your project!

---

## Example: Button with Icon

```jsx
<button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
  <span className="material-symbols-outlined">add</span>
  Add Student
</button>
```

---

## Example: Navigation Item

```jsx
<a href="/dashboard" className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg">
  <span className="material-symbols-rounded text-2xl">dashboard</span>
  <span>Dashboard</span>
</a>
```

---

## Pro Tips

1. **Use Rounded variant** for modern, friendly UI
2. **Use Outlined variant** for professional, technical interfaces
3. **Use Sharp variant** for bold, minimalist designs
4. **Combine with Tailwind** for consistent sizing: `text-lg`, `text-2xl`, etc.
5. **Remember icon names are lowercase with underscores** (`check_circle`, not `checkCircle`)

---

## Troubleshooting

If icons don't appear:
1. Check browser console for font loading errors
2. Verify icon name spelling (use underscore for spaces)
3. Clear cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Check that class name is correct (`material-symbols-outlined`, `material-symbols-rounded`, or `material-symbols-sharp`)

Happy iconizing! 🎨
