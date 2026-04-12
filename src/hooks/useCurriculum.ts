import { useState, useMemo } from 'react';
import {
  DEPARTMENT_CONFIG,
  type Subject, type CurriculumMap, type Department, type CreditSummary,
} from '@/types/curriculum';

// ── Mock Subjects ─────────────────────────────────────────────────────────────
const SEED_SUBJECTS: Subject[] = [];

// ── Mock Curriculum Maps ──────────────────────────────────────────────────────
const SEED_MAPS: CurriculumMap[] = [];

// ── Hook ──────────────────────────────────────────────────────────────────────

export type NewSubject = Omit<Subject, 'id'>;
export type NewCurriculumMap = Omit<CurriculumMap, 'id'>;

export function useCurriculum() {
  const [subjects, setSubjects] = useState<Subject[]>(SEED_SUBJECTS);
  const [maps, setMaps] = useState<CurriculumMap[]>(SEED_MAPS);

  // ── Subject CRUD ────────────────────────────────────────────────────────────
  const addSubject = (data: NewSubject) => {
    setSubjects(prev => [...prev, { ...data, id: `s-${Date.now()}` }]);
  };

  const updateSubject = (id: string, data: NewSubject) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...data, id } : s));
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    // Also remove from all maps
    setMaps(prev => prev.map(m => ({
      ...m,
      subjectIds: m.subjectIds.filter(sid => sid !== id),
    })));
  };

  // ── Curriculum Map CRUD ─────────────────────────────────────────────────────
  const getOrCreateMap = (gradeLevel: string, department: Department, semester: 1 | 2, academicYear: string): CurriculumMap => {
    const existing = maps.find(
      m => m.gradeLevel === gradeLevel && m.semester === semester && m.academicYear === academicYear,
    );
    if (existing) return existing;
    const newMap: CurriculumMap = {
      id: `map-${gradeLevel}-s${semester}-${Date.now()}`,
      name: `หลักสูตร ${gradeLevel}`,
      gradeLevel,
      department,
      semester,
      academicYear,
      subjectIds: [],
    };
    setMaps(prev => [...prev, newMap]);
    return newMap;
  };

  const toggleSubjectInMap = (
    gradeLevel: string,
    department: Department,
    semester: 1 | 2,
    academicYear: string,
    subjectId: string,
  ) => {
    const existing = maps.find(
      m => m.gradeLevel === gradeLevel && m.semester === semester && m.academicYear === academicYear,
    );

    if (existing) {
      setMaps(prev => prev.map(m => {
        if (m.id !== existing.id) return m;
        const has = m.subjectIds.includes(subjectId);
        return { ...m, subjectIds: has ? m.subjectIds.filter(id => id !== subjectId) : [...m.subjectIds, subjectId] };
      }));
    } else {
      const newMap: CurriculumMap = {
        id: `map-${gradeLevel}-s${semester}-${Date.now()}`,
        name: `หลักสูตร ${gradeLevel}`,
        gradeLevel,
        department,
        semester,
        academicYear,
        subjectIds: [subjectId],
      };
      setMaps(prev => [...prev, newMap]);
    }
  };

  // ── Derived Queries ─────────────────────────────────────────────────────────
  const getMapSubjects = (gradeLevel: string, semester: 1 | 2, academicYear: string): Subject[] => {
    const map = maps.find(
      m => m.gradeLevel === gradeLevel && m.semester === semester && m.academicYear === academicYear,
    );
    if (!map) return [];
    return subjects.filter(s => map.subjectIds.includes(s.id));
  };

  const getCreditSummary = (gradeLevel: string, semester: 1 | 2, academicYear: string): CreditSummary => {
    const mapSubjects = getMapSubjects(gradeLevel, semester, academicYear);
    const summary: CreditSummary = { core: 0, added: 0, elective: 0, activity: 0, total: 0 };
    for (const s of mapSubjects) {
      summary[s.category] += s.credits;
      summary.total += s.credits;
    }
    return summary;
  };

  const subjectsByDepartment = useMemo(() => {
    const result: Record<string, Subject[]> = {};
    for (const s of subjects) {
      if (!result[s.department]) result[s.department] = [];
      result[s.department].push(s);
    }
    return result;
  }, [subjects]);

  const isInMap = (gradeLevel: string, semester: 1 | 2, academicYear: string, subjectId: string): boolean => {
    const map = maps.find(
      m => m.gradeLevel === gradeLevel && m.semester === semester && m.academicYear === academicYear,
    );
    return map ? map.subjectIds.includes(subjectId) : false;
  };

  // ── Clone Curriculum ─────────────────────────────────────────────────────────
  const cloneCurriculum = (fromYear: string, toYear: string, overwrite = false) => {
    const fromMaps = maps.filter(m => m.academicYear === fromYear);
    if (fromMaps.length === 0) return { cloned: 0, skipped: 0 };

    let cloned = 0;
    let skipped = 0;

    setMaps(prev => {
      let next = [...prev];
      for (const src of fromMaps) {
        const existingIdx = next.findIndex(
          m => m.gradeLevel === src.gradeLevel && m.semester === src.semester && m.academicYear === toYear,
        );
        if (existingIdx !== -1) {
          if (overwrite) {
            next[existingIdx] = {
              ...next[existingIdx],
              subjectIds: [...src.subjectIds],
              department: src.department,
            };
            cloned++;
          } else {
            skipped++;
          }
        } else {
          next = [...next, {
            ...src,
            id: `map-${src.gradeLevel}-s${src.semester}-${toYear}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            academicYear: toYear,
          }];
          cloned++;
        }
      }
      return next;
    });

    return { cloned, skipped };
  };

  // ── Year Stats (for registration overview) ───────────────────────────────────
  const getYearRegistrationGrid = (academicYear: string, department: Department) => {
    const deptSubjects = subjectsByDepartment[department] ?? [];
    return (DEPARTMENT_CONFIG[department]?.grades ?? []).map((grade: string) => {
      const gradeMaps = maps.filter(m => m.gradeLevel === grade && m.academicYear === academicYear && m.department === department);

      const curriculums = gradeMaps.map(map => {
        const subs = deptSubjects.filter(s => map.subjectIds.includes(s.id));
        const totalCredits = subs.reduce((acc, s) => acc + s.credits, 0);
        const totalHours = subs.reduce((acc, s) => acc + s.hoursPerWeek, 0);
        return {
          id: map.id,
          name: map.name,
          semester: map.semester,
          count: subs.length,
          credits: totalCredits,
          hours: totalHours,
        };
      });

      return {
        grade,
        curriculums,
      };
    });
  };

  // ── Get all unique academic years present in maps ────────────────────────────
  const getAllYears = (): string[] => {
    return [...new Set(maps.map(m => m.academicYear))].sort((a, b) => Number(b) - Number(a));
  };

  return {
    subjects,
    maps,
    subjectsByDepartment,
    addSubject,
    updateSubject,
    deleteSubject,
    toggleSubjectInMap,
    getOrCreateMap,
    getMapSubjects,
    getCreditSummary,
    isInMap,
    cloneCurriculum,
    getYearRegistrationGrid,
    getAllYears,
  };
}
