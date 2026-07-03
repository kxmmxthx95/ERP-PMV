/** Local calendar date as YYYY-MM-DD (browser timezone). */
export function getLocalDateString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const THAI_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'] as const;

/** e.g. วันศุกร์ 29/05/2569 */
export function formatThaiDateLabel(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearBe = date.getFullYear() + 543;
  return `วัน${THAI_DAY_NAMES[date.getDay()]} ${day}/${month}/${yearBe}`;
}

export function formatThaiDateLabelFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return formatThaiDateLabel();
  return formatThaiDateLabel(new Date(y, m - 1, d));
}

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** e.g. 1/7 */
export function formatShortDateFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d}/${m}`;
}

/** e.g. 24–30 มิ.ย. 2569 */
export function formatThaiDateRangeFromIso(from: string, to: string): string {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  const yearBe = end.getFullYear() + 543;
  const startMonth = start.toLocaleDateString('th-TH', { month: 'short' });
  const endMonth = end.toLocaleDateString('th-TH', { month: 'short' });

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${endMonth} ${yearBe}`;
  }
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${yearBe}`;
}

export function enumerateIsoDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = parseLocalDate(from);
  const end = parseLocalDate(to);
  while (cur <= end) {
    dates.push(getLocalDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
