import universitiesBundle from './universities.json';
import universityExtras from './universityExtras.json';

export interface ThaiUniversity {
  id: string;
  name: string;
  nameTh?: string;
  domain: string;
  stateProvince?: string | null;
  webPage?: string | null;
}

function normalizeUniversityDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export { normalizeUniversityDomain };

const GOOGLE_FAVICON_BLOCKLIST = new Set(['edupol.org']);

/** Skip domains where Google favicon consistently 404s (non-.ac.th / .or.th sites) */
export function shouldUseGoogleFavicon(domain: string): boolean {
  const host = normalizeUniversityDomain(domain);
  if (!host || GOOGLE_FAVICON_BLOCKLIST.has(host)) return false;
  return /\.(ac|or)\.th$/i.test(host);
}

/** Google S2 Favicon API — one lookup per domain (prefers www.{host}) */
export function universityGoogleLogoUrl(domain: string, size: 32 | 64 | 128 = 128): string {
  const host = normalizeUniversityDomain(domain);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

/** Google only; UniversityLogo shows cap icon on load error */
export function universityLogoUrls(
  domain: string,
  display: 'sm' | 'md' | 'lg' = 'sm',
): string[] {
  const googleSize: 32 | 64 | 128 = display === 'lg' ? 128 : display === 'md' ? 64 : 32;
  const host = normalizeUniversityDomain(domain);
  const lookup = host.startsWith('www.') ? host : `www.${host}`;
  return [universityGoogleLogoUrl(lookup, googleSize)];
}

interface UniversitiesBundle {
  generatedAt: string;
  source: string;
  count: number;
  universities: ThaiUniversity[];
}

const bundle = universitiesBundle as UniversitiesBundle;

function mergeUniversityLists(
  base: ThaiUniversity[],
  extras: ThaiUniversity[],
): ThaiUniversity[] {
  const seen = new Set(base.map((u) => u.domain));
  const merged = [...base];
  for (const extra of extras) {
    if (!seen.has(extra.domain)) {
      merged.push(extra);
      seen.add(extra.domain);
    }
  }
  return merged.sort((a, b) =>
    (a.nameTh ?? a.name).localeCompare(b.nameTh ?? b.name, 'th'),
  );
}

export const THAI_UNIVERSITIES: ThaiUniversity[] = mergeUniversityLists(
  bundle.universities,
  universityExtras as ThaiUniversity[],
);

export const THAI_UNIVERSITIES_META = {
  generatedAt: bundle.generatedAt,
  source: bundle.source,
  count: THAI_UNIVERSITIES.length,
};

/** Primary display label — Thai name when available */
export function universityLabel(u: ThaiUniversity): string {
  return u.nameTh ?? u.name;
}

export function matchesUniversitySearch(u: ThaiUniversity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    universityLabel(u).toLowerCase().includes(q) ||
    u.name.toLowerCase().includes(q) ||
    u.domain.toLowerCase().includes(q)
  );
}

export function findUniversityByLabel(label: string): ThaiUniversity | undefined {
  const trimmed = label.trim();
  if (!trimmed) return undefined;
  return THAI_UNIVERSITIES.find(
    (u) => universityLabel(u) === trimmed || u.name === trimmed,
  );
}
