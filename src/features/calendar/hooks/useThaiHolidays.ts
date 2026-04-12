import { useState, useEffect, useRef } from 'react';
import { parseISO, subDays, format } from 'date-fns';
import type { CalendarEvent, GoogleCalendarListResponse, GoogleCalendarEvent } from '@/types/calendar';

// Google Calendar — Thai holidays (public calendar, ไม่ต้อง OAuth)
// Calendar ID: th.th#holiday@group.v.calendar.google.com
const CALENDAR_ID = 'th.th%23holiday%40group.v.calendar.google.com';
const BASE_URL = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;
const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY as string | undefined;

// In-memory cache: year → events
const cache = new Map<number, CalendarEvent[]>();

export interface UseThaiHolidaysResult {
  holidays: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  year: number;
}

/**
 * Google Calendar end.date is **exclusive** for all-day events
 * (e.g. a 1-day holiday Jan 1 has end = Jan 2)
 * → subtract 1 day to get the real last day
 */
function toInclusiveEnd(exclusiveEnd: string): string {
  return format(subDays(parseISO(exclusiveEnd), 1), 'yyyy-MM-dd');
}

function transformEvent(item: GoogleCalendarEvent): CalendarEvent {
  return {
    id: `gcal-${item.id}`,
    title: item.summary,
    startDate: item.start.date,
    endDate: toInclusiveEnd(item.end.date),
    type: 'holiday',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'],
    description: item.description,
  };
}

async function fetchAllPages(url: URL, signal: AbortSignal): Promise<GoogleCalendarEvent[]> {
  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) throw new Error(`Google Calendar API error: ${res.status} ${res.statusText}`);
    const data = await res.json() as GoogleCalendarListResponse;
    items.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export function useThaiHolidays(year: number): UseThaiHolidaysResult {
  const [holidays, setHolidays] = useState<CalendarEvent[]>(() => cache.get(year) ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      setError('ยังไม่ได้ตั้งค่า VITE_GOOGLE_CALENDAR_API_KEY');
      return;
    }

    if (cache.has(year)) {
      setHolidays(cache.get(year)!);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const url = new URL(BASE_URL);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('timeMin', `${year}-01-01T00:00:00Z`);
    url.searchParams.set('timeMax', `${year}-12-31T23:59:59Z`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '100');

    fetchAllPages(url, controller.signal)
      .then(items => {
        const events = items.map(transformEvent);
        cache.set(year, events);
        setHolidays(events);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดวันหยุดได้');
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [year]);

  return { holidays, isLoading, error, year };
}
