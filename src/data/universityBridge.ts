import type { ThaiUniversity } from '@/data/thaiUniversities';
import { findUniversityByLabel, THAI_UNIVERSITIES, universityLabel } from '@/data/thaiUniversities';
import {
  findMytcasUniversity,
  mytcasFacultiesForUniversity,
  type MytcasUniversity,
} from '@/data/mytcasUniversities';

export function mytcasToThaiUniversity(m: MytcasUniversity): ThaiUniversity {
  return {
    id: m.universityId,
    name: m.nameEn || m.nameTh,
    nameTh: m.nameTh,
    domain: m.domain ?? '',
  };
}

function isSameUniversity(hipo: ThaiUniversity, mytcas: MytcasUniversity): boolean {
  if (hipo.id && hipo.id === mytcas.universityId) return true;
  if (hipo.domain && mytcas.domain && hipo.domain === mytcas.domain) return true;
  if (hipo.nameTh && hipo.nameTh === mytcas.nameTh) return true;
  if (
    hipo.name &&
    mytcas.nameEn &&
    hipo.name.toLowerCase() === mytcas.nameEn.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/** MyTCAS TCAS69 list (primary) + Hipo-only extras not in MyTCAS */
export function buildPickerUniversities(mytcasList: MytcasUniversity[]): ThaiUniversity[] {
  if (mytcasList.length === 0) return THAI_UNIVERSITIES;

  const fromMytcas = mytcasList.map(mytcasToThaiUniversity);
  const extras = THAI_UNIVERSITIES.filter(
    (h) => h.nameTh && !mytcasList.some((m) => isSameUniversity(h, m)),
  );

  return [...fromMytcas, ...extras].sort((a, b) =>
    universityLabel(a).localeCompare(universityLabel(b), 'th'),
  );
}

/** Match myTCAS record to a picker / Thai university entry */
export function findMytcasForThaiUniversity(
  hipo: ThaiUniversity,
  list: MytcasUniversity[],
): MytcasUniversity | undefined {
  if (hipo.id) {
    const byId = list.find((u) => u.universityId === hipo.id);
    if (byId) return byId;
  }
  if (hipo.domain) {
    const byDomain = list.find((u) => u.domain === hipo.domain);
    if (byDomain) return byDomain;
  }
  if (hipo.nameTh) {
    const byTh = findMytcasUniversity(hipo.nameTh, list);
    if (byTh) return byTh;
  }
  return list.find((u) => u.nameEn?.toLowerCase() === hipo.name.toLowerCase());
}

/** Resolve myTCAS from stored choice (domain preferred, then name) */
export function findMytcasForChoice(
  universityName: string,
  universityDomain: string | undefined,
  list: MytcasUniversity[],
): MytcasUniversity | undefined {
  if (universityDomain?.trim()) {
    const byDomain = list.find((u) => u.domain === universityDomain);
    if (byDomain) return byDomain;
  }
  const direct = findMytcasUniversity(universityName, list);
  if (direct) return direct;
  const hipo = findUniversityByLabel(universityName);
  if (hipo) return findMytcasForThaiUniversity(hipo, list);
  return undefined;
}

export function hasMytcasFacultyData(
  mytcas: MytcasUniversity | undefined,
  list: MytcasUniversity[],
): boolean {
  if (!mytcas) return false;
  return mytcasFacultiesForUniversity(mytcas.nameTh, list).length > 0;
}
