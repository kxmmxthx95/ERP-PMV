/** Icon button in portal header (home, filter, settings, …). Change here → all header icons follow. */
export const HEADER_ICON_BTN =
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white/40 text-slate-800 shadow-xs transition-all duration-300';

/** Inactive / unselected header icon (same size, quieter). */
export const HEADER_ICON_BTN_GHOST =
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-600 transition-all duration-300';

/**
 * Shared spacing for a row of header icon buttons (`gap-1.5` = 6px).
 * Pair with `flex` or `hidden lg:flex` / `hidden md:flex` — do not include `flex` here
 * (it would override `hidden` via tailwind-merge).
 */
export const HEADER_ICON_BTN_GROUP = 'items-center gap-1.5';
