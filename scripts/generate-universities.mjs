#!/usr/bin/env node
/**
 * Fetch Thai universities from Hipo Labs API and write src/data/universities.json
 * with domain metadata. Logo via Google S2 favicons; cap icon on error (see universityLogoUrls).
 *
 * Source: http://universities.hipolabs.com/search?country=Thailand
 * Run: npm run generate:universities
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = 'http://universities.hipolabs.com/search?country=Thailand';
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '../src/data/universities.json');

/** Known English → Thai display names for major institutions */
const THAI_NAME_BY_ENGLISH = {
  'Chulalongkorn University': 'จุฬาลงกรณ์มหาวิทยาลัย',
  'Mahidol University': 'มหาวิทยาลัยมหิดล',
  'Thammasat University': 'มหาวิทยาลัยธรรมศาสตร์',
  'Kasetsart University': 'มหาวิทยาลัยเกษตรศาสตร์',
  'Chiang Mai University': 'มหาวิทยาลัยเชียงใหม่',
  'Khon Kaen University': 'มหาวิทยาลัยขอนแก่น',
  'Prince of Songkla University': 'มหาวิทยาลัยสงขลานครินทร์',
  'Srinakharinwirot University': 'มหาวิทยาลัยศรีนครินทรวิโรฒ',
  'Ramkhamhaeng University': 'มหาวิทยาลัยรามคำแหง',
  'Sukhothai Thammathirat Open University': 'มหาวิทยาลัยสุโขทัยธรรมาธิราช',
  'Silpakorn University': 'มหาวิทยาลัยศิลปากร',
  'Burapha University': 'มหาวิทยาลัยบูรพา',
  'Naresuan University': 'มหาวิทยาลัยนเรศวร',
  'Ubonratchathani University': 'มหาวิทยาลัยอุบลราชธานี',
  'Maejo University': 'มหาวิทยาลัยแม่โจ้',
  "King Mongkut's University of Technology Thonburi": 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี',
  "King Mongkut's University of Technology North Bangkok": 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ',
  "King Mongkut's Institute of Technology Ladkrabang": 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง',
  'Suranaree University of Technology': 'มหาวิทยาลัยเทคโนโลยีสุรนารี',
  'Walailak University': 'มหาวิทยาลัยวลัยลักษณ์',
  'Thaksin University': 'มหาวิทยาลัยทักษิณ',
  'Mahasarakham University': 'มหาวิทยาลัยมหาสารคาม',
  'Mae Fah Luang University': 'มหาวิทยาลัยแม่ฟ้าหลวง',
  'Assumption University of Thailand': 'มหาวิทยาลัยอัสสัมชัญ',
  'Bangkok University': 'มหาวิทยาลัยกรุงเทพ',
  'Dhurakijpundit University': 'มหาวิทยาลัยธุรกิจบัณฑิตย์',
  'Payap University Chaiang Mai': 'มหาวิทยาลัยพายัพ',
  'National Institute of Development Administration': 'สถาบันบัณฑิตพัฒนบริหารศาสตร์',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Hipo API ${res.status}: ${res.statusText}`);

  const rows = await res.json();
  const seen = new Set();

  const universities = rows
    .filter((row) => row.country === 'Thailand' && row.domains?.length)
    .map((row) => {
      const domain = row.domains[0];
      const name = row.name?.trim();
      if (!domain || !name || seen.has(domain)) return null;
      seen.add(domain);

      const nameTh = THAI_NAME_BY_ENGLISH[name];
      const id = slugify(name) || domain.replace(/\./g, '-');

      return {
        id,
        name,
        ...(nameTh ? { nameTh } : {}),
        domain,
        stateProvince: row['state-province'] ?? null,
        webPage: row.web_pages?.[0] ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const labelA = a.nameTh ?? a.name;
      const labelB = b.nameTh ?? b.name;
      return labelA.localeCompare(labelB, 'th');
    });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: API_URL,
    count: universities.length,
    universities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${universities.length} universities → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
