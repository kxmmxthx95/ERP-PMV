import { getLocalDateString } from '@/lib/dateUtils';
import { sessionCache } from '@/lib/sessionCache';

export type ZodiacSignId =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type HoroscopeDay = 'today' | 'tomorrow' | 'yesterday';

export interface HoroscopeRaw {
  date_range: string;
  current_date: string;
  description: string;
  compatibility: string;
  mood: string;
  color: string;
  lucky_number: string;
  lucky_time: string;
}

export interface HoroscopeReading extends HoroscopeRaw {
  signId: ZodiacSignId;
  signNameTh: string;
  signSymbol: string;
  dateRangeTh: string;
  descriptionTh: string;
  moodTh: string;
  colorTh: string;
  compatibilityTh: string;
  luckyTimeTh: string;
}

export const ZODIAC_SIGNS: {
  id: ZodiacSignId;
  nameTh: string;
  symbol: string;
  dateRangeTh: string;
}[] = [
  { id: 'aries', nameTh: 'ราศีเมษ', symbol: '♈', dateRangeTh: '21 มี.ค. – 19 เม.ย.' },
  { id: 'taurus', nameTh: 'ราศีพฤษภ', symbol: '♉', dateRangeTh: '20 เม.ย. – 20 พ.ค.' },
  { id: 'gemini', nameTh: 'ราศีเมถุน', symbol: '♊', dateRangeTh: '21 พ.ค. – 20 มิ.ย.' },
  { id: 'cancer', nameTh: 'ราศีกรกฎ', symbol: '♋', dateRangeTh: '21 มิ.ย. – 22 ก.ค.' },
  { id: 'leo', nameTh: 'ราศีสิงห์', symbol: '♌', dateRangeTh: '23 ก.ค. – 22 ส.ค.' },
  { id: 'virgo', nameTh: 'ราศีกันย์', symbol: '♍', dateRangeTh: '23 ส.ค. – 22 ก.ย.' },
  { id: 'libra', nameTh: 'ราศีตุล', symbol: '♎', dateRangeTh: '23 ก.ย. – 22 ต.ค.' },
  { id: 'scorpio', nameTh: 'ราศีพิจิก', symbol: '♏', dateRangeTh: '23 ต.ค. – 21 พ.ย.' },
  { id: 'sagittarius', nameTh: 'ราศีธนู', symbol: '♐', dateRangeTh: '22 พ.ย. – 21 ธ.ค.' },
  { id: 'capricorn', nameTh: 'ราศีมังกร', symbol: '♑', dateRangeTh: '22 ธ.ค. – 19 ม.ค.' },
  { id: 'aquarius', nameTh: 'ราศีกุมภ', symbol: '♒', dateRangeTh: '20 ม.ค. – 18 ก.พ.' },
  { id: 'pisces', nameTh: 'ราศีมีน', symbol: '♓', dateRangeTh: '19 ก.พ. – 20 มี.ค.' },
];

const SIGN_BY_ID = Object.fromEntries(ZODIAC_SIGNS.map((s) => [s.id, s])) as Record<ZodiacSignId, (typeof ZODIAC_SIGNS)[number]>;

const MOOD_TH: Record<string, string> = {
  Happy: 'สดใส',
  Relaxed: 'ผ่อนคลาย',
  Confident: 'มั่นใจ',
  Creative: 'สร้างสรรค์',
  Optimistic: 'มองโลกในแง่ดี',
  Calm: 'สงบ',
};

const COLOR_TH: Record<string, string> = {
  Red: 'แดง',
  Blue: 'น้ำเงิน',
  Green: 'เขียว',
  Purple: 'ม่วง',
  Orange: 'ส้ม',
  Pink: 'ชมพู',
  Yellow: 'เหลือง',
  White: 'ขาว',
  Black: 'ดำ',
  Brown: 'น้ำตาล',
  Gold: 'ทอง',
  Silver: 'เงิน',
};

export const HOROSCOPE_SIGN_STORAGE_KEY = 'widget_horoscope_sign';

function ttlUntilLocalMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(60_000, midnight.getTime() - now.getTime());
}

function cacheKey(sign: ZodiacSignId, day: HoroscopeDay): string {
  return `horoscope:${sign}:${day}:${getLocalDateString()}`;
}

function translateCompatibility(value: string): string {
  const normalized = value.toLowerCase() as ZodiacSignId;
  const meta = SIGN_BY_ID[normalized];
  return meta?.nameTh ?? value;
}

function translateMood(mood: string): string {
  return MOOD_TH[mood] ?? mood;
}

function translateColor(color: string): string {
  return COLOR_TH[color] ?? color;
}

function translateLuckyTime(time: string): string {
  return time
    .replace(/\bAM\b/gi, 'น.')
    .replace(/\bPM\b/gi, 'น.')
    .replace(/(\d+):(\d+)/g, '$1:$2');
}

function splitForTranslation(text: string, maxLen = 420): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('. ', maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf(' ', maxLen);
    if (cut < 1) cut = maxLen;
    chunks.push(rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function translateChunkToThai(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|th`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation failed');
  const json = (await res.json()) as { responseData?: { translatedText?: string } };
  const translated = json.responseData?.translatedText?.trim();
  if (!translated) throw new Error('Empty translation');
  return translated;
}

async function translateDescription(text: string): Promise<string> {
  const chunks = splitForTranslation(text);
  const parts = await Promise.all(chunks.map(translateChunkToThai));
  return parts.join(' ');
}

async function fetchRawHoroscope(sign: ZodiacSignId, day: HoroscopeDay): Promise<HoroscopeRaw> {
  const params = new URLSearchParams({ sign, day });
  const res = await fetch(`/api/horoscope?${params.toString()}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `ไม่สามารถโหลดดวงได้ (${res.status})`);
  }
  return res.json() as Promise<HoroscopeRaw>;
}

function localizeReading(sign: ZodiacSignId, raw: HoroscopeRaw, descriptionTh: string): HoroscopeReading {
  const meta = SIGN_BY_ID[sign];
  return {
    ...raw,
    signId: sign,
    signNameTh: meta.nameTh,
    signSymbol: meta.symbol,
    dateRangeTh: meta.dateRangeTh,
    descriptionTh,
    moodTh: translateMood(raw.mood),
    colorTh: translateColor(raw.color),
    compatibilityTh: translateCompatibility(raw.compatibility),
    luckyTimeTh: translateLuckyTime(raw.lucky_time),
  };
}

export function getStoredHoroscopeSign(): ZodiacSignId {
  try {
    const stored = localStorage.getItem(HOROSCOPE_SIGN_STORAGE_KEY);
    if (stored && SIGN_BY_ID[stored as ZodiacSignId]) {
      return stored as ZodiacSignId;
    }
  } catch {
    // ignore
  }
  return 'aries';
}

export function setStoredHoroscopeSign(sign: ZodiacSignId): void {
  try {
    localStorage.setItem(HOROSCOPE_SIGN_STORAGE_KEY, sign);
  } catch {
    // ignore
  }
}

export async function getDailyHoroscope(
  sign: ZodiacSignId,
  day: HoroscopeDay = 'today',
): Promise<HoroscopeReading> {
  const key = cacheKey(sign, day);
  const cached = sessionCache.get<HoroscopeReading>(key);
  if (cached) return cached;

  const raw = await fetchRawHoroscope(sign, day);
  let descriptionTh: string;
  try {
    descriptionTh = await translateDescription(raw.description);
  } catch {
    descriptionTh = raw.description;
  }

  const reading = localizeReading(sign, raw, descriptionTh);
  sessionCache.set(key, reading, ttlUntilLocalMidnight());
  return reading;
}
