#!/usr/bin/env node
/**
 * Download TCAS69 course catalog from myTCAS public S3 bucket and build
 * a local university → faculty index for offline use.
 *
 * Source (linked from https://www.mytcas.com/):
 *   https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas/courses.json
 *
 * Run: npm run generate:mytcas-universities
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COURSES_URL = 'https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas/courses.json';
const OUT_PATH = join(ROOT, 'public/data/mytcas-universities.json');
const HIPO_PATH = join(ROOT, 'src/data/universities.json');
const DOMAIN_OVERRIDES_PATH = join(ROOT, 'src/data/universityDomainOverrides.json');

/** @param {string} nameTh @param {string | null | undefined} nameEn */
function resolveDomain(nameTh, nameEn, hipoByTh, hipoByEn, overrides) {
  if (overrides[nameTh] !== undefined) return overrides[nameTh];
  const fromTh = hipoByTh.get(nameTh);
  if (fromTh) return fromTh;
  const fromEn = nameEn ? hipoByEn.get(nameEn.toLowerCase()) : undefined;
  return fromEn ?? null;
}

function loadDomainMaps() {
  /** @type {Record<string, string | null>} */
  const overrides = JSON.parse(readFileSync(DOMAIN_OVERRIDES_PATH, 'utf8'));
  /** @type {{ universities: { name: string, nameTh?: string, domain: string }[] }} */
  const hipo = JSON.parse(readFileSync(HIPO_PATH, 'utf8'));
  const hipoByTh = new Map(
    hipo.universities.filter((u) => u.nameTh).map((u) => [u.nameTh, u.domain]),
  );
  const hipoByEn = new Map(hipo.universities.map((u) => [u.name.toLowerCase(), u.domain]));
  return { overrides, hipoByTh, hipoByEn };
}

/** @typedef {object} CourseRow */
/** @typedef {Map<string, { facultyId: string, nameTh: string, nameEn: string, fields: Map<string, { fieldId: string, nameTh: string, nameEn: string, programCount: number }>, programCount: number }>} FacultyMap */

async function fetchCourses() {
  const res = await fetch(COURSES_URL, {
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip' },
  });
  if (!res.ok) throw new Error(`courses.json ${res.status}: ${res.statusText}`);

  const encoding = res.headers.get('content-encoding') ?? '';
  const buf = Buffer.from(await res.arrayBuffer());
  let text;
  try {
    text = buf.toString('utf8');
    JSON.parse(text);
  } catch {
    text = gunzipSync(buf).toString('utf8');
  }

  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected courses.json to be an array');
  return data;
}

function buildIndex(courses) {
  /** @type {Map<string, object>} */
  const universities = new Map();

  for (const row of courses) {
    const uniKey = row.university_id;
    if (!uniKey) continue;

    if (!universities.has(uniKey)) {
      universities.set(uniKey, {
        universityId: row.university_id,
        nameTh: row.university_name_th,
        nameEn: row.university_name_en,
        universityTypeId: row.university_type_id ?? null,
        universityTypeNameTh: row.university_type_name_th ?? null,
        faculties: new Map(),
      });
    }

    const uni = universities.get(uniKey);
    const facKey = `${row.campus_id ?? '00'}:${row.faculty_id}`;
    if (!uni.faculties.has(facKey)) {
      uni.faculties.set(facKey, {
        facultyId: row.faculty_id,
        campusId: row.campus_id ?? null,
        campusNameTh: row.campus_name_th ?? null,
        campusNameEn: row.campus_name_en ?? null,
        nameTh: row.faculty_name_th,
        nameEn: row.faculty_name_en,
        programCount: 0,
        fields: new Map(),
      });
    }

    const fac = uni.faculties.get(facKey);
    fac.programCount += 1;

    const fieldKey = row.field_id ?? row.field_name_th;
    if (fieldKey && row.field_name_th) {
      if (!fac.fields.has(fieldKey)) {
        fac.fields.set(fieldKey, {
          fieldId: row.field_id ?? null,
          nameTh: row.field_name_th,
          nameEn: row.field_name_en ?? null,
          programCount: 0,
        });
      }
      fac.fields.get(fieldKey).programCount += 1;
    }
  }

  const { overrides, hipoByTh, hipoByEn } = loadDomainMaps();

  const universitiesOut = [...universities.values()]
    .map((uni) => ({
      universityId: uni.universityId,
      nameTh: uni.nameTh,
      nameEn: uni.nameEn,
      domain: resolveDomain(uni.nameTh, uni.nameEn, hipoByTh, hipoByEn, overrides),
      universityTypeId: uni.universityTypeId,
      universityTypeNameTh: uni.universityTypeNameTh,
      faculties: [...uni.faculties.values()]
        .map((fac) => ({
          facultyId: fac.facultyId,
          campusId: fac.campusId,
          campusNameTh: fac.campusNameTh,
          campusNameEn: fac.campusNameEn,
          nameTh: fac.nameTh,
          nameEn: fac.nameEn,
          programCount: fac.programCount,
          fields: [...fac.fields.values()].sort((a, b) =>
            a.nameTh.localeCompare(b.nameTh, 'th'),
          ),
        }))
        .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th')),
    }))
    .sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'));

  return universitiesOut;
}

async function main() {
  console.log(`Fetching ${COURSES_URL} ...`);
  const courses = await fetchCourses();
  console.log(`Loaded ${courses.length} course rows`);

  const universities = buildIndex(courses);
  const facultyCount = universities.reduce((n, u) => n + u.faculties.length, 0);
  const domainCount = universities.filter((u) => u.domain).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: COURSES_URL,
    website: 'https://www.mytcas.com/',
    academicYear: '2569',
    courseRowCount: courses.length,
    universityCount: universities.length,
    facultyCount,
    universities,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote ${universities.length} universities (${domainCount} with logo domain), ${facultyCount} faculties → ${OUT_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
