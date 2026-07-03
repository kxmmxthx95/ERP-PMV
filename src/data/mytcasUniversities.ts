export interface MytcasField {
  fieldId: string | null;
  nameTh: string;
  nameEn: string | null;
  programCount: number;
}

export interface MytcasFaculty {
  facultyId: string;
  campusId: string | null;
  campusNameTh: string | null;
  campusNameEn: string | null;
  nameTh: string;
  nameEn: string;
  programCount: number;
  fields: MytcasField[];
}

export interface MytcasUniversity {
  universityId: string;
  nameTh: string;
  nameEn: string;
  domain: string | null;
  universityTypeId: string | null;
  universityTypeNameTh: string | null;
  faculties: MytcasFaculty[];
}

export interface MytcasMeta {
  generatedAt: string;
  source: string;
  website: string;
  academicYear: string;
  universityCount: number;
  facultyCount: number;
}

interface MytcasBundle {
  generatedAt: string;
  source: string;
  website: string;
  academicYear: string;
  courseRowCount: number;
  universityCount: number;
  facultyCount: number;
  universities: MytcasUniversity[];
}

const CATALOG_URL = '/data/mytcas-universities.json';

let cachedUniversities: MytcasUniversity[] | null = null;
let cachedMeta: MytcasMeta | null = null;
let loadPromise: Promise<MytcasUniversity[]> | null = null;

function readMeta(bundle: MytcasBundle): MytcasMeta {
  return {
    generatedAt: bundle.generatedAt,
    source: bundle.source,
    website: bundle.website,
    academicYear: bundle.academicYear,
    universityCount: bundle.universityCount,
    facultyCount: bundle.facultyCount,
  };
}

/** Fetch myTCAS catalog at runtime (kept out of JS bundle). */
export async function loadMytcasCatalog(): Promise<MytcasUniversity[]> {
  if (cachedUniversities) return cachedUniversities;
  if (!loadPromise) {
    loadPromise = fetch(CATALOG_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load myTCAS catalog (${res.status})`);
        }
        return res.json() as Promise<MytcasBundle>;
      })
      .then((bundle) => {
        cachedUniversities = bundle.universities;
        cachedMeta = readMeta(bundle);
        return cachedUniversities;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

export function getMytcasCatalogSync(): MytcasUniversity[] {
  return cachedUniversities ?? [];
}

export function getMytcasMetaSync(): MytcasMeta | null {
  return cachedMeta;
}

export function findMytcasUniversity(
  nameTh: string,
  list: MytcasUniversity[] = getMytcasCatalogSync(),
): MytcasUniversity | undefined {
  const q = nameTh.trim();
  return list.find((u) => u.nameTh === q || u.nameEn === q);
}

export function matchesMytcasUniversitySearch(u: MytcasUniversity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    u.nameTh.toLowerCase().includes(q) ||
    (u.nameEn?.toLowerCase().includes(q) ?? false) ||
    (u.domain?.toLowerCase().includes(q) ?? false)
  );
}

export function mytcasUniversityLabel(u: MytcasUniversity): string {
  return u.nameTh;
}

/** Official TCAS69 logo CDN (same as course.mytcas.com) */
export function mytcasLogoUrl(universityId: string): string {
  return `https://assets.mytcas.com/i/logo/${universityId}.png`;
}

export function findMytcasByDomain(
  domain: string,
  list: MytcasUniversity[] = getMytcasCatalogSync(),
): MytcasUniversity | undefined {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return undefined;
  return list.find((u) => u.domain?.toLowerCase() === normalized);
}

export function mytcasFacultiesForUniversity(
  nameTh: string,
  list: MytcasUniversity[] = getMytcasCatalogSync(),
): MytcasFaculty[] {
  return findMytcasUniversity(nameTh, list)?.faculties ?? [];
}

export function mytcasFieldsForFaculty(
  universityNameTh: string,
  facultyNameTh: string,
  list: MytcasUniversity[] = getMytcasCatalogSync(),
): MytcasField[] {
  const uni = findMytcasUniversity(universityNameTh, list);
  const fac = uni?.faculties.find((f) => f.nameTh === facultyNameTh);
  return fac?.fields ?? [];
}
