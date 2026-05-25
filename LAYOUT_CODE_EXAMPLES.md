# Layout Code Examples — Copy & Paste Solutions

Quick reference for common layout patterns used in PMV-ONE portal. Copy these patterns to fix overlapping, overflow, and clipping issues.

---

## 1. Responsive Top Bar / Header

**Use this pattern when:** You have left items (avatar, name), center items (filters), right items (buttons)

```tsx
// ✓ GOOD — Mobile-friendly top bar with proper gaps
<div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-4 sm:px-6 md:px-8 py-4">
  
  {/* LEFT SECTION */}
  <div className="flex items-center gap-2 min-w-0">
    {/* Avatar */}
    <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
    
    {/* Name + Role (hidden on very small screens) */}
    <div className="hidden sm:flex items-center gap-2 min-w-0">
      <p className="text-xs md:text-sm font-semibold text-slate-800 truncate">Name</p>
      <span className="text-[9px] md:text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Role</span>
    </div>
  </div>

  {/* CENTER SECTION (optional) */}
  <div className="hidden lg:flex flex-1 justify-center px-4 max-w-xl">
    {/* Filter dropdown, search, etc. */}
  </div>

  {/* RIGHT SECTION */}
  <div className="flex items-center gap-2 flex-shrink-0">
    <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20">
      <Search size={16} />
    </button>
    <button className="w-9 h-9 md:w-auto md:px-3 text-xs md:text-sm font-semibold rounded-full">
      <span className="md:hidden">⏹</span>
      <span className="hidden md:inline">Logout</span>
    </button>
  </div>
</div>
```

**Key points:**
- `gap-2 sm:gap-3 md:gap-4` — Spacing adjusts per breakpoint
- `min-w-0` — Allows flex children to shrink below content size
- `hidden sm:block` — Show/hide based on screen size
- `flex-shrink-0` — Prevents buttons from shrinking

---

## 2. Two-Column Manager Layout (Curriculum/Schedule/Syllabus)

**Use this pattern when:** You have left panel (list) + right panel (details/editor)

```tsx
// ✓ GOOD — Responsive two-column with proper scrolling
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[400px] h-auto lg:h-[600px] overflow-hidden">
  
  {/* LEFT COLUMN — List */}
  <div className="flex flex-col h-full min-h-0 bg-white/50 rounded-xl overflow-hidden">
    {/* Header — Doesn't scroll */}
    <div className="flex-shrink-0 p-4 border-b border-white/30">
      <h3 className="font-semibold text-slate-800 text-sm">Subjects</h3>
    </div>

    {/* Content — Scrollable */}
    <div className="flex-1 min-h-0 overflow-y-auto">
      {subjects.map(subject => (
        <div key={subject.id} className="p-3 border-b border-white/20 hover:bg-white/30 cursor-pointer">
          <p className="text-xs font-semibold text-slate-800 truncate">{subject.name}</p>
          <p className="text-[10px] text-slate-600 truncate">{subject.code}</p>
        </div>
      ))}
    </div>
  </div>

  {/* RIGHT COLUMN — Details/Editor */}
  <div className="flex flex-col h-full min-h-0 bg-white/50 rounded-xl overflow-hidden">
    {/* Header */}
    <div className="flex-shrink-0 p-4 border-b border-white/30">
      <h3 className="font-semibold text-slate-800 text-sm">Curriculum Map</h3>
    </div>

    {/* Content — Scrollable */}
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
      {/* Form fields, checkboxes, etc. */}
    </div>
  </div>
</div>
```

**Key points:**
- `grid grid-cols-1 lg:grid-cols-2` — Stacks on mobile, side-by-side on lg+
- `h-full min-h-0` — Essential for flex children to enable scrolling
- `flex-shrink-0` + `flex-1` — Separates fixed (header) and scrollable (content) sections
- `overflow-y-auto` — Adds scrollbar only when needed
- `min-h-[400px] lg:h-[600px]` — Mobile-friendly height

---

## 3. Modal with Scrollable Content Area

**Use this pattern when:** Form/dialog needs to handle long content without clipping buttons

```tsx
// ✓ GOOD — Modal that scrolls content, not buttons
<motion.div 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
>
  <motion.div 
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
  >
    {/* HEADER — Never scrolls */}
    <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200">
      <h2 className="text-lg font-bold text-slate-800">Add New Subject</h2>
      <p className="text-xs text-slate-500 mt-1">Fill in the details below</p>
    </div>

    {/* CONTENT — Scrolls if needed */}
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">
          Subject Name
        </label>
        <input 
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500"
          placeholder="e.g., Mathematics"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">
          Subject Code
        </label>
        <input 
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500"
          placeholder="e.g., M101"
        />
      </div>

      {/* More form fields... */}
    </div>

    {/* FOOTER — Never scrolls, always visible */}
    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
      <button 
        onClick={onCancel}
        className="px-4 py-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Cancel
      </button>
      <button 
        onClick={onSave}
        className="px-4 py-2 text-xs font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
      >
        Save Subject
      </button>
    </div>
  </motion.div>
</motion.div>
```

**Key points:**
- `max-h-[90vh]` — Modal never bigger than 90% of viewport
- `flex flex-col` — Enables flex-based layout
- Header with `flex-shrink-0` — Always visible, never scrolls
- Content with `flex-1 overflow-y-auto` — Takes remaining space, scrolls
- Footer with `flex-shrink-0` — Always visible at bottom

---

## 4. Card Grid with Responsive Columns

**Use this pattern when:** You have multiple cards that should reflow based on screen size

```tsx
// ✓ GOOD — Cards that adjust column count responsively
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
  {items.map(item => (
    <div 
      key={item.id}
      className="p-4 rounded-lg border border-white/30 hover:shadow-lg transition-all"
      style={{
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Icon or image */}
      <div className="w-full h-24 rounded-md bg-gradient-to-br from-blue-400 to-blue-500 mb-3" />
      
      {/* Title — truncate if too long */}
      <h3 className="font-semibold text-slate-800 text-sm truncate">{item.title}</h3>
      
      {/* Subtitle */}
      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>
    </div>
  ))}
</div>
```

**Responsive breakdown:**
- `grid-cols-1` — 1 column on mobile (< 640px)
- `sm:grid-cols-2` — 2 columns on tablet (640px+)
- `lg:grid-cols-3` — 3 columns on desktop (1024px+)
- `xl:grid-cols-4` — 4 columns on large desktop (1280px+)

**Key points:**
- `gap-3` — Consistent spacing between cards
- `truncate` — Single line text truncation with ellipsis
- `line-clamp-2` — Limit to 2 lines
- `rounded-lg` — Consistent border radius

---

## 5. Form Layout with Proper Label Spacing

**Use this pattern when:** You have forms that need to be readable and not overflow

```tsx
// ✓ GOOD — Form with proper flex layout
<form className="space-y-4 p-6">
  
  {/* Single column input */}
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-2">
      Full Name
    </label>
    <input 
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500"
      type="text"
      placeholder="John Doe"
    />
  </div>

  {/* Two-column layout (auto-stacks on mobile) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2">
        Email
      </label>
      <input 
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500"
        type="email"
        placeholder="john@example.com"
      />
    </div>
    
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2">
        Phone
      </label>
      <input 
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500"
        type="tel"
        placeholder="+66 8 xxxx xxxx"
      />
    </div>
  </div>

  {/* Textarea (full width) */}
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-2">
      Description
    </label>
    <textarea 
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-500 min-h-[100px] resize-none"
      placeholder="Enter description..."
    />
  </div>

  {/* Button group */}
  <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
    <button className="px-4 py-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100">
      Cancel
    </button>
    <button className="px-4 py-2 text-xs font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600">
      Save
    </button>
  </div>
</form>
```

**Key points:**
- `space-y-4` — Consistent vertical spacing between form groups
- `grid-cols-1 sm:grid-cols-2` — Mobile stacks, desktop side-by-side
- `w-full` — All inputs take full width of their container
- `focus:outline-2 focus:outline-blue-500` — Accessible focus state
- `resize-none` — Prevent textarea from being resized by user (if desired)

---

## 6. Tab Navigation with Content Area

**Use this pattern when:** You have multiple tabs/views (like CurriculumManager)

```tsx
// ✓ GOOD — Tab navigation with scrollable content
<div className="flex flex-col h-full gap-4">
  
  {/* TAB NAVIGATION — Doesn't scroll */}
  <div className="flex-shrink-0 flex gap-2 overflow-x-auto pb-2">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
          activeTab === tab.id
            ? 'bg-white text-slate-800 shadow-md'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        <tab.icon size={16} />
        {tab.label}
      </button>
    ))}
  </div>

  {/* CONTENT AREA — Scrollable */}
  <div className="flex-1 min-h-0 overflow-y-auto">
    {activeTab === 'manage' && <ManageContent />}
    {activeTab === 'view' && <ViewContent />}
    {/* ... other tabs */}
  </div>
</div>
```

**Key points:**
- Tabs in `flex-shrink-0` — Never scrolls, always visible
- Content in `flex-1 min-h-0 overflow-y-auto` — Takes remaining space, scrolls
- `whitespace-nowrap` + `overflow-x-auto` — Tabs scroll horizontally on mobile if needed
- `flex-shrink-0` on tab buttons — Prevents shrinking below content size

---

## 7. Alert/Notification Banner

**Use this pattern when:** You need to show alerts without covering content

```tsx
// ✓ GOOD — Alert that doesn't overlap with content
<div className="flex flex-col h-screen">
  
  {/* Alert banner at top */}
  <AnimatePresence>
    {showAlert && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex-shrink-0 px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-3"
      >
        <AlertCircle size={18} className="text-yellow-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-yellow-800">Warning!</p>
          <p className="text-xs text-yellow-700 mt-0.5 break-words">{alertMessage}</p>
        </div>
        <button 
          onClick={() => setShowAlert(false)}
          className="flex-shrink-0 text-yellow-600 hover:text-yellow-800"
        >
          ✕
        </button>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Main content */}
  <div className="flex-1 overflow-auto">
    {/* Page content */}
  </div>
</div>
```

**Key points:**
- Alert uses `flex-shrink-0` — Doesn't shrink, always visible
- Main content uses `flex-1 overflow-auto` — Takes remaining space
- `min-w-0` on text — Allows text to wrap
- `flex-shrink-0` on close button — Doesn't shrink

---

## Testing These Patterns

1. **Open DevTools:** Press `F12` in Chrome/Firefox
2. **Toggle responsive mode:** `Ctrl+Shift+M` (Windows) or `Cmd+Shift+M` (Mac)
3. **Test at:**
   - 375px (mobile)
   - 768px (tablet)
   - 1024px (desktop)
   - 1920px (large desktop)

4. **Check for:**
   - ✓ No overlapping elements
   - ✓ Text doesn't overflow container
   - ✓ Scrollbars appear when needed
   - ✓ Buttons/inputs are fully visible and clickable
   - ✓ No horizontal scroll on mobile

---

## Quick Fix Commands

Replace in your components:

```tsx
// BEFORE: Fixed column layout
<div className="grid grid-cols-2 gap-4">

// AFTER: Responsive column layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

```tsx
// BEFORE: Text might overflow
<p>{longText}</p>

// AFTER: Text truncates
<p className="truncate">{longText}</p>

// OR: Text wraps
<p className="break-words">{longText}</p>
```

```tsx
// BEFORE: Fixed height blocks scrolling
<div className="h-[500px] overflow-hidden">

// AFTER: Responsive height with scrolling
<div className="h-auto lg:h-[500px] overflow-y-auto">
```

---

**Last Updated:** 2026-04-25
