import type { ExamAttempt } from '@/types/exam';
import type { Student } from '@/types/student';

export type StudentIdentityFields = Pick<Student, 'id'> & {
  authUid?: string;
  userId?: string;
  studentCode?: string;
  email?: string;
};

/** Parse score from Firestore (number or numeric string). */
export function normalizeExamScore(score: unknown): number | null {
  if (typeof score === 'number' && Number.isFinite(score)) return score;
  if (typeof score === 'string') {
    const trimmed = score.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** PMV student login emails use `{studentCode}@pmv.com`. */
export function extractPmStudentCode(value: string): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const emailMatch = /^(\d+)@/i.exec(v);
  if (emailMatch) return emailMatch[1];
  if (/^\d+$/.test(v)) return v;
  return null;
}

export function normalizeExamRound(round: unknown): number {
  const n = Number(round);
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

export function studentIdentityKeys(student: StudentIdentityFields): Set<string> {
  const keys = new Set<string>();
  const add = (id?: string | null) => {
    const v = String(id ?? '').trim();
    if (v) keys.add(v);
  };
  add(student.id);
  add(student.authUid);
  add(student.userId);
  const code = String(student.studentCode ?? '').trim();
  if (code) {
    add(code);
    add(`${code}@pmv.com`);
  }
  add(student.email);
  return keys;
}

/** Map any student identity key → canonical students/{id}. */
export function buildStudentIdentityLookup(
  students: Array<{ student: StudentIdentityFields }>,
): Map<string, string> {
  const lookup = new Map<string, string>();
  students.forEach(({ student }) => {
    const canonical = student.id;
    studentIdentityKeys(student).forEach((key) => lookup.set(key, canonical));
  });
  return lookup;
}

function normalizeStudentDisplayName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function studentRosterDisplayName(
  student: Pick<Student, 'id' | 'prefix' | 'firstName' | 'lastName'> & { studentName?: string },
): string {
  const fromParts = normalizeStudentDisplayName(`${student.prefix}${student.firstName} ${student.lastName}`);
  if (fromParts) return fromParts;
  return normalizeStudentDisplayName(student.studentName ?? '');
}

/**
 * Exam attempts store studentId = Firebase Auth UID (Firestore rules require this).
 * Roster rows use students/{docId} which may differ when authUid is missing on the profile.
 * Link attempt.studentId → canonical roster id via name when identity keys are incomplete.
 */
export function enrichStudentIdentityLookupFromAttempts(
  lookup: Map<string, string>,
  classStudents: Array<{ student: Pick<Student, 'id' | 'authUid' | 'userId' | 'studentCode' | 'email' | 'prefix' | 'firstName' | 'lastName'> & { studentName?: string } }>,
  attempts: ExamAttempt[],
): Map<string, string> {
  const next = new Map(lookup);
  if (classStudents.length === 0 || attempts.length === 0) return next;

  const nameToCanonical = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  const codeToCanonical = new Map<string, string>();
  classStudents.forEach(({ student }) => {
    const name = studentRosterDisplayName(student);
    if (name) {
      if (nameToCanonical.has(name)) {
        // Duplicate display name in roster — name alone can't disambiguate, don't guess.
        ambiguousNames.add(name);
      } else {
        nameToCanonical.set(name, student.id);
      }
    }
    const code = String(student.studentCode ?? '').trim();
    if (code) codeToCanonical.set(code, student.id);
  });

  const linkAttemptKey = (rawKey: string, canonical: string) => {
    const key = String(rawKey ?? '').trim();
    if (key) next.set(key, canonical);
  };

  attempts.forEach((att) => {
    const rawId = String(att.studentId ?? '').trim();
    if (rawId && next.has(rawId)) return;

    const attName = normalizeStudentDisplayName(att.studentName ?? '');
    if (attName && !ambiguousNames.has(attName)) {
      const byName = nameToCanonical.get(attName);
      if (byName) {
        linkAttemptKey(rawId, byName);
        return;
      }
    }

    const code =
      extractPmStudentCode(attName)
      ?? extractPmStudentCode(rawId);
    if (code) {
      const byCode = codeToCanonical.get(code);
      if (byCode) linkAttemptKey(rawId, byCode);
    }
  });

  return next;
}

export function resolveCanonicalStudentId(
  rawStudentId: string,
  lookup: Map<string, string>,
): string {
  const key = String(rawStudentId ?? '').trim();
  return lookup.get(key) ?? key;
}

function pickLatestAttempt(matched: ExamAttempt[]): ExamAttempt | undefined {
  if (matched.length === 0) return undefined;
  if (matched.length === 1) return matched[0];
  return [...matched].sort((a, b) => {
    const ta = Number(a.submittedAt ?? a.lastSavedAt ?? a.startedAt ?? 0);
    const tb = Number(b.submittedAt ?? b.lastSavedAt ?? b.startedAt ?? 0);
    return tb - ta;
  })[0];
}

function attemptMatchesStudent(
  att: ExamAttempt,
  keys: Set<string>,
  studentCode: string,
): boolean {
  const sid = String(att.studentId ?? '').trim();
  if (sid && keys.has(sid)) return true;
  if (!studentCode) return false;
  const attCode =
    extractPmStudentCode(att.studentName ?? '')
    ?? extractPmStudentCode(sid);
  return attCode === studentCode;
}

export function findAttemptForStudent(
  attempts: ExamAttempt[],
  student: StudentIdentityFields,
): ExamAttempt | undefined {
  const keys = studentIdentityKeys(student);
  const studentCode = String(student.studentCode ?? '').trim();
  const matched = attempts.filter((a) => attemptMatchesStudent(a, keys, studentCode));
  return pickLatestAttempt(matched);
}

/** Prefer the active round, then fall back to the latest attempt in the room. */
export function findTakerAttemptForStudent(
  attempts: ExamAttempt[],
  student: StudentIdentityFields,
  attemptsByStudentRound: Map<string, Map<number, ExamAttempt>>,
  preferredRound: number,
): ExamAttempt | undefined {
  const round = normalizeExamRound(preferredRound);
  const fromIndex = attemptsByStudentRound.get(student.id)?.get(round);
  if (fromIndex) return fromIndex;

  const roundMatches = attempts.filter(
    (a) => normalizeExamRound(a.round) === round
      && attemptMatchesStudent(a, studentIdentityKeys(student), String(student.studentCode ?? '').trim()),
  );
  const roundAttempt = pickLatestAttempt(roundMatches);
  if (roundAttempt) return roundAttempt;

  return findAttemptForStudent(attempts, student);
}

export function indexAttemptsByStudentRound(
  attempts: ExamAttempt[],
  identityLookup: Map<string, string>,
): Map<string, Map<number, ExamAttempt>> {
  const byStudent = new Map<string, Map<number, ExamAttempt>>();

  attempts.forEach((att) => {
    const rawId = String(att.studentId || '').trim();
    if (!rawId) return;
    const studentId = identityLookup.size > 0
      ? resolveCanonicalStudentId(rawId, identityLookup)
      : rawId;
    const round = normalizeExamRound(att.round);

    const studentRounds = byStudent.get(studentId) ?? new Map<number, ExamAttempt>();
    const prev = studentRounds.get(round);
    if (!prev) {
      studentRounds.set(round, att);
      byStudent.set(studentId, studentRounds);
      return;
    }

    const prevStamp = Number(prev.submittedAt ?? prev.lastSavedAt ?? prev.startedAt ?? 0);
    const nextStamp = Number(att.submittedAt ?? att.lastSavedAt ?? att.startedAt ?? 0);
    if (nextStamp >= prevStamp) {
      studentRounds.set(round, att);
    }
    byStudent.set(studentId, studentRounds);
  });

  return byStudent;
}

/** Best score per student across all rounds (canonical student doc id). */
export function getBestScoresByStudent(
  attempts: ExamAttempt[],
  classStudents: Array<{ student: StudentIdentityFields }>,
): Map<string, number> {
  const lookup = enrichStudentIdentityLookupFromAttempts(
    buildStudentIdentityLookup(classStudents),
    classStudents as Parameters<typeof enrichStudentIdentityLookupFromAttempts>[1],
    attempts,
  );
  const bestByCanonical = new Map<string, number>();

  attempts.forEach((att) => {
    const score = normalizeExamScore(att.score);
    if (score === null) return;
    const canonicalId = resolveCanonicalStudentId(att.studentId, lookup);
    const prev = bestByCanonical.get(canonicalId);
    if (prev === undefined || score > prev) {
      bestByCanonical.set(canonicalId, score);
    }
  });

  return bestByCanonical;
}

type RosterStudentRow = {
  student: Pick<
    Student,
    'id' | 'prefix' | 'firstName' | 'lastName' | 'authUid' | 'userId' | 'studentCode' | 'email'
  > & { studentName?: string; photoURL?: string; gender?: 'male' | 'female' };
};

/** Map any student identity key (uid, email, code) → roster display name. */
export function buildStudentDisplayNameByIdentityKey(
  classStudents: RosterStudentRow[],
  attempts: ExamAttempt[] = [],
): Map<string, string> {
  const canonicalName = new Map<string, string>();
  classStudents.forEach(({ student }) => {
    const fullName = studentRosterDisplayName(student);
    if (fullName) canonicalName.set(student.id, fullName);
  });

  const identityLookup = enrichStudentIdentityLookupFromAttempts(
    buildStudentIdentityLookup(classStudents),
    classStudents,
    attempts,
  );

  const displayByKey = new Map<string, string>();
  identityLookup.forEach((canonicalId, key) => {
    const name = canonicalName.get(canonicalId);
    if (name) displayByKey.set(key, name);
  });

  classStudents.forEach(({ student }) => {
    const fullName = studentRosterDisplayName(student);
    if (!fullName) return;
    studentIdentityKeys(student).forEach((key) => displayByKey.set(key, fullName));
  });

  return displayByKey;
}

/** Resolve a human-readable name for an exam attempt (roster first, then fallbacks). */
export function resolveAttemptDisplayName(
  att: ExamAttempt,
  displayNameByKey: Map<string, string>,
): string {
  const candidateKeys = new Set<string>();
  const add = (value?: string | null) => {
    const v = String(value ?? '').trim();
    if (v) candidateKeys.add(v);
  };

  add(att.studentId);
  add(att.studentName);
  const codeFromName = extractPmStudentCode(att.studentName ?? '');
  const codeFromId = extractPmStudentCode(att.studentId ?? '');
  if (codeFromName) add(`${codeFromName}@pmv.com`);
  if (codeFromId) add(`${codeFromId}@pmv.com`);
  if (codeFromName) add(codeFromName);
  if (codeFromId) add(codeFromId);

  for (const key of candidateKeys) {
    const resolved = displayNameByKey.get(key);
    if (resolved) return resolved;
  }

  const attName = normalizeStudentDisplayName(att.studentName ?? '');
  if (attName && !attName.includes('@')) return attName;

  const code = codeFromName ?? codeFromId;
  return code ? `รหัส ${code}` : (attName || 'ไม่ทราบชื่อ');
}

/** Resolve exam_scores row by roster student (handles Auth UID vs students/{docId}). */
export function findScoreRecordForStudent<T extends { studentId: string }>(
  recordsByStudentId: Map<string, T>,
  student: StudentIdentityFields,
  lookup: Map<string, string>,
): T | undefined {
  for (const key of studentIdentityKeys(student)) {
    const hit = recordsByStudentId.get(key);
    if (hit) return hit;
  }
  for (const [rawId, record] of recordsByStudentId) {
    if (resolveCanonicalStudentId(rawId, lookup) === student.id) return record;
  }
  return undefined;
}

export function scoreCollectionTypeToGradeField(
  type?: string,
): 'classworkScore' | 'midtermScore' | 'finalScore' {
  if (type === 'midterm') return 'midtermScore';
  if (type === 'final') return 'finalScore';
  return 'classworkScore';
}
