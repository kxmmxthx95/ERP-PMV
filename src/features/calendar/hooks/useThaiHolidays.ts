import { useState, useEffect } from 'react';
import { parseISO, subDays, format } from 'date-fns';
import type { CalendarEvent, GoogleCalendarListResponse, GoogleCalendarEvent } from '@/types/calendar';

// Google Calendar — Thai holidays (public calendar, ไม่ต้อง OAuth)
// Calendar ID: th.th#holiday@group.v.calendar.google.com
const CALENDAR_ID = 'th.th%23holiday%40group.v.calendar.google.com';
const BASE_URL = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;
const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY as string | undefined;

const cache = new Map<number, CalendarEvent[]>();
const inflight = new Map<number, Promise<CalendarEvent[]>>();

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

async function fetchAllPages(url: URL): Promise<GoogleCalendarEvent[]> {
  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google Calendar API error: ${res.status} ${res.statusText}`);
    const data = await res.json() as GoogleCalendarListResponse;
    items.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

function buildEventsUrl(year: number): URL {
  const url = new URL(BASE_URL);
  url.searchParams.set('key', API_KEY!);
  url.searchParams.set('timeMin', `${year}-01-01T00:00:00Z`);
  url.searchParams.set('timeMax', `${year}-12-31T23:59:59Z`);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '100');
  return url;
}

/** โหลดวันหyุดปีเดียวกันแค่ครั้งเดียว — แชร์ cache + in-flight ระหว่าง hook instances */
function loadThaiHolidaysForYear(year: number): Promise<CalendarEvent[]> {
  const cached = cache.get(year);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(year);
  if (existing) return existing;

  if (!API_KEY) {
    return Promise.reject(new Error('ยังไม่ได้ตั้งค่า VITE_GOOGLE_CALENDAR_API_KEY'));
  }

  const promise = fetchAllPages(buildEventsUrl(year))
    .then((items) => {
      const events = items.map(transformEvent);
      cache.set(year, events);
      inflight.delete(year);
      return events;
    })
    .catch((err) => {
      inflight.delete(year);
      throw err;
    });

  inflight.set(year, promise);
  return promise;
}

export function useThaiHolidays(year: number): UseThaiHolidaysResult {
  const [holidays, setHolidays] = useState<CalendarEvent[]>(() => cache.get(year) ?? []);
  const [isLoading, setIsLoading] = useState(() => !cache.has(year) && !!API_KEY);
  const [error, setError] = useState<string | null>(() =>
    !API_KEY ? 'ยังไม่ได้ตั้งค่า VITE_GOOGLE_CALENDAR_API_KEY' : null,
  );

  useEffect(() => {
    if (!API_KEY) {
      setError('ยังไม่ได้ตั้งค่า VITE_GOOGLE_CALENDAR_API_KEY');
      return;
    }

    if (cache.has(year)) {
      setHolidays(cache.get(year)!);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void loadThaiHolidaysForYear(year)
      .then((events) => {
        if (cancelled) return;
        setHolidays(events);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดวันหยุดได้');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  return { holidays, isLoading, error, year };
}
