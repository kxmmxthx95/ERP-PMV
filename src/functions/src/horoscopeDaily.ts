import * as functions from "firebase-functions/v1";

type HoroscopeDay = "today" | "tomorrow" | "yesterday";

interface HoroscopePayload {
  date_range: string;
  current_date: string;
  description: string;
  compatibility: string;
  mood: string;
  color: string;
  lucky_number: string;
  lucky_time: string;
}

const VALID_SIGNS = new Set([
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
]);

const VALID_DAYS = new Set<HoroscopeDay>(["today", "tomorrow", "yesterday"]);

const DATE_RANGES: Record<string, string> = {
  aries: "Mar 21 - Apr 19",
  taurus: "Apr 20 - May 20",
  gemini: "May 21 - Jun 20",
  cancer: "Jun 21 - Jul 22",
  leo: "Jul 23 - Aug 22",
  virgo: "Aug 23 - Sep 22",
  libra: "Sep 23 - Oct 22",
  scorpio: "Oct 23 - Nov 21",
  sagittarius: "Nov 22 - Dec 21",
  capricorn: "Dec 22 - Jan 19",
  aquarius: "Jan 20 - Feb 18",
  pisces: "Feb 19 - Mar 20",
};

const MOODS = ["Happy", "Relaxed", "Confident", "Creative", "Optimistic", "Calm"];
const COLORS = ["Red", "Blue", "Green", "Purple", "Orange", "Pink", "Yellow", "White"];
const COMPAT = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];
const LUCKY_TIMES = ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM"];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(seed: string, items: T[]): T {
  return items[hashSeed(seed) % items.length];
}

function enrichFallback(sign: string, day: HoroscopeDay, description: string): HoroscopePayload {
  const seed = `${sign}-${day}-${new Date().toISOString().slice(0, 10)}`;
  const luckyNum = (hashSeed(`${seed}n`) % 99) + 1;
  return {
    date_range: DATE_RANGES[sign] ?? "",
    current_date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    description,
    compatibility: pick(`${seed}c`, COMPAT),
    mood: pick(`${seed}m`, MOODS),
    color: pick(`${seed}col`, COLORS),
    lucky_number: String(luckyNum),
    lucky_time: pick(`${seed}t`, LUCKY_TIMES),
  };
}

async function fetchHoroscope(sign: string, day: HoroscopeDay): Promise<HoroscopePayload> {
  try {
    const aztroRes = await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=${day}`, { method: "POST" });
    if (aztroRes.ok) {
      const data = (await aztroRes.json()) as HoroscopePayload;
      if (data.description) return data;
    }
  } catch {
    // fall through
  }

  const apiSign = sign.charAt(0).toUpperCase() + sign.slice(1);
  const apiDay = day.toUpperCase();
  const fbRes = await fetch(
    `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${apiSign}&day=${apiDay}`,
    { redirect: "follow" },
  );
  if (!fbRes.ok) {
    throw new Error(`Horoscope API error (${fbRes.status})`);
  }

  const fbJson = (await fbRes.json()) as { data?: { horoscope?: string; date?: string } };
  const description = fbJson.data?.horoscope?.trim();
  if (!description) {
    throw new Error("Horoscope API returned empty data");
  }

  const payload = enrichFallback(sign, day, description);
  if (fbJson.data?.date) {
    payload.current_date = fbJson.data.date;
  }
  return payload;
}

export const horoscopeDaily = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const sign = String(req.query.sign ?? "").toLowerCase();
    const day = String(req.query.day ?? "today").toLowerCase() as HoroscopeDay;

    if (!VALID_SIGNS.has(sign) || !VALID_DAYS.has(day)) {
      res.status(400).json({ error: "Invalid sign or day" });
      return;
    }

    try {
      const data = await fetchHoroscope(sign, day);
      res.status(200).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      functions.logger.error("horoscopeDaily failed", message);
      res.status(502).json({ error: message });
    }
  });
