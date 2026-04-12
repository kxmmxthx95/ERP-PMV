import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

/** Convert Date → 'yyyy-MM-dd' */
export function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Return Thai month name + Buddhist year, e.g. "เมษายน 2568" */
export function toBuddhistYear(date: Date): string {
  return format(date, 'MMMM', { locale: th }) + ' ' + (date.getFullYear() + 543);
}

/** Return full Thai date string, e.g. "วันเสาร์ 12 เมษายน 2568" */
export function toThaiFullDate(date: Date): string {
  return (
    format(date, 'EEEE', { locale: th }) +
    ' ' +
    date.getDate() +
    ' ' +
    format(date, 'MMMM', { locale: th }) +
    ' ' +
    (date.getFullYear() + 543)
  );
}

/** Format a date range label for an event */
export function formatEventDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  if (startDate === endDate) {
    return format(start, 'd MMM', { locale: th }) + ' ' + (start.getFullYear() + 543);
  }
  const end = parseISO(endDate);
  return (
    format(start, 'd MMM', { locale: th }) +
    ' – ' +
    format(end, 'd MMM', { locale: th }) +
    ' ' +
    (start.getFullYear() + 543)
  );
}
