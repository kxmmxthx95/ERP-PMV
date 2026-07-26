# 🏫 Workspace Rules for Antigravity IDE (Piyamit School Management System)

This document contains compiled workspace-level rules and constraints from the `.cursor/rules/` directory, adapted for the Antigravity IDE agent workspace environment.

---

## 💬 1. Caveman & Ponytail Mode

Both modes are active to ensure high efficiency in communication and development.

### Caveman (Mouth)
- **Terse Replies**: Keep explanations brief and cut pleasantries, filler words, hedging, and unnecessary formatting. Preserve full technical accuracy.
- **Acronyms**: Use standard acronyms (e.g., DB, API, HTTP, RSC). Never invent prose abbreviations.
- **Language**: Preserve user's dominant language (Thai). Respond in Thai Caveman.

### Ponytail (Build/Code)
- **Minimum Diff**: Always seek the simplest, smallest change that works correctly.
- **7 Rungs of Minimization**:
  1. Need exist? → Skip (YAGNI).
  2. Already in codebase? → Reuse helper/util.
  3. Standard library? → Use it.
  4. Native platform? → Use it.
  5. Installed dependency? → Use it.
  6. One line? → Make it one line.
  7. Only then: write minimum code.
- **Quality boundaries**: Never cut security, data loss protection, input validation, or accessibility. Mark deliberate simplifications with a `// ponytail:` comment naming the upgrade path.

---

## 🎨 2. UI System (กฎเหล็ก)

### Primitives & Shared Components
- **Import from `@/components/ui/`**: Always import base components (Button, Input, Card, Dialog, Sheet, Drawer) from the UI library. Do not hand-roll Tailwind markup for these.
- **Consistent Radius**: All buttons must default to `rounded-2xl` (defined in `@/components/ui/button`). Avoid overriding radius in features.
- **CSS Variables**: Define colors only via CSS variables in `src/index.css` (e.g., `bg-primary`, `text-destructive`). Never use raw hex codes or Tailwind color palettes directly in the feature components for brand or status colors.

### Header Icon Buttons
- **Style & Layout**: Portal headers must use classes from `@/lib/headerIconBtn`.
  - Group: `HEADER_ICON_BTN_GROUP` (strictly `gap-1.5`)
  - Button: `HEADER_ICON_BTN`
- **Filter Button**: Always use `HEADER_ICON_BTN` + `HiOutlineFunnel` (size 16) from `react-icons/hi2`. For active states, place an absolute dot `bg-destructive` without restyling the button.

---

## 📊 3. Data Tables (กฎเหล็ก)

- **Grid Pattern**: All portal listings, rosters, and tables must use the `GradeTable` CSS grid layout instead of `@/components/ui/table` or card grids.
- **Grid Tokens & Edge-to-Edge Layout**:
  - Container Shell: `rounded-2xl border border-border bg-card overflow-hidden` (No inner nested border box or redundant outer padding gap around the table).
  - Sticky Header: `sticky top-0 z-10 border-b border-border bg-slate-50/90 backdrop-blur-md text-[12px] font-black text-slate-700 font-sukhumvit shrink-0` (Header must stay sticky at top during vertical scrolling).
  - Row: `grid gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors` (Rows sit flush against outer card borders using `px-4 py-3` internal padding).
- **Student Data Representation**:
  - Avatar: Use `<StudentAvatar />` from `@/features/students/components/StudentAvatar`.
  - Name: `text-[13px] font-bold text-foreground font-sukhumvit truncate`
- **Badges/Pills**: Use semantic tokens only (e.g. `bg-primary/10 text-primary`) rather than hex colors or hardcoded gray chips.
- **Responsiveness**: Use `md:hidden` for mobile cards and `hidden md:flex flex-col` for desktop grid tables.

---

## 🚪 4. Drawer & Form Design (กฎเหล็ก)

### Drawer Close Button
- **Close Action**: Placement must be on the top-right of `DrawerHeader`.
- **Must use**:
  - Class: `DRAWER_HEADER_ICON_BTN` from `@/lib/drawerHeaderBtn`
  - Position: `DRAWER_HEADER_RIGHT_ACTIONS`
  - Icon: `HiXMark` from `react-icons/hi2` (size 16)
- **Paired Back Button**: Place immediately to the left of the close button inside the same action cluster using `DRAWER_HEADER_ICON_BTN` + `HiArrowLeft`.

### Settings & Edit Forms
- **Shell Layout**: Rounded corners must be `rounded-2xl`. Dialog headers and footers should have matching padding (`pt-6 sm:pt-8` / `pb-6 sm:pb-8`).
- **Form Fields**:
  - Layout: `space-y-4` between fields, `space-y-6` between field groups.
  - Labels: `text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1`.
  - Required fields: Indicate with a `*` using `text-destructive`.
  - Input tags: Use `Input` from `@/components/ui/input` with styling `h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold`.
- **Action Buttons**:
  - Primary save: Place inside `DialogFooter` spanning full-width using the system `primary` button variant.
  - Secondary/helper: Muted variant, full-width inside the form body.

---

## 🕸️ 5. Graphify Knowledge Graph Context

A persistent knowledge graph is generated at `graphify-out/`.
- **Mandatory Usage**: Before starting code exploration, utilize `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` first to locate dependencies and code boundaries.
- **Wiki Navigation**: If `graphify-out/wiki/index.md` exists, explore using the wiki articles.
- **Graph Updates**: Always run `graphify update .` (AST-only check) after completing code modifications to keep the graph updated.
