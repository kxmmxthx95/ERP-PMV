import { useState, useMemo } from 'react';
import type { Subject } from '@/types/curriculum';
import {
  type SubjectGroup,
  type SubjectGroupId,
  SUBJECT_GROUP_CONFIG,
} from '@/types/curriculum';

// ── Default Groups (8 กลุ่มสาระ + อื่นๆ ตามหลักสูตรแกนกลาง) ─────────────────
const SEED_GROUPS: SubjectGroup[] = (
  Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, typeof SUBJECT_GROUP_CONFIG[SubjectGroupId]][]
).map(([key, cfg]) => ({
  id: `group-${key}`,
  groupKey: key,
  name: cfg.name,
  nameEn: cfg.nameEn,
  color: cfg.color,
  bg: cfg.bg,
  border: cfg.border,
  subjectIds: [],
  order: cfg.order,
}));

// ── Default subject → group mapping (ตามรหัสวิชา prefix) ────────────────────
// เมื่อ import subjects จาก useCurriculum ครั้งแรก hook จะ auto-map ให้
const CODE_PREFIX_TO_GROUP: Record<string, SubjectGroupId> = {
  // ปฐมวัย (E)
  E1001: 'thai',
  E1002: 'math',
  E1003: 'arts',
  E1004: 'health_pe',
  E1005: 'foreign_lang',
  // ประถมศึกษา (P)
  P1001: 'thai',
  P1002: 'math',
  P1003: 'science',
  P1004: 'social',
  P1005: 'social',       // ประวัติศาสตร์ → สังคม
  P1006: 'foreign_lang',
  P1007: 'health_pe',
  P1008: 'arts',
  P1009: 'careers',
  P2001: 'science',      // คอมพิวเตอร์ → วิทย์
  P2002: 'foreign_lang',
  P3001: 'other',
  P3002: 'other',
  // มัธยมศึกษา (M)
  M1001: 'thai',
  M1002: 'math',
  M1003: 'science',
  M1004: 'science',      // ฟิสิกส์
  M1005: 'science',      // เคมี
  M1006: 'science',      // ชีววิทยา
  M1007: 'social',
  M1008: 'social',       // ประวัติศาสตร์
  M1009: 'foreign_lang',
  M1010: 'health_pe',
  M1011: 'arts',
  M1012: 'careers',
  M2001: 'math',
  M2002: 'foreign_lang',
  M2003: 'science',      // วิทยาการคำนวณ
  M3001: 'foreign_lang',
  M3002: 'foreign_lang',
  M3003: 'social',       // เศรษฐศาสตร์
  M4001: 'other',
  M4002: 'other',
};

export type NewSubjectGroup = Omit<SubjectGroup, 'id'>;

export function useSubjectGroup(subjects: Subject[] = []) {
  const [groups, setGroups] = useState<SubjectGroup[]>(() => {
    // Auto-map subjects ที่รู้จักเข้า group ทันทีตอน init
    const initial = SEED_GROUPS.map(g => ({ ...g, subjectIds: [] as string[] }));
    for (const subject of subjects) {
      const groupKey = CODE_PREFIX_TO_GROUP[subject.code];
      if (groupKey) {
        const idx = initial.findIndex(g => g.groupKey === groupKey);
        if (idx !== -1 && !initial[idx].subjectIds.includes(subject.id)) {
          initial[idx].subjectIds.push(subject.id);
        }
      }
    }
    return initial;
  });

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const addGroup = (data: NewSubjectGroup) => {
    setGroups(prev => [...prev, { ...data, id: `group-${Date.now()}` }]);
  };

  const updateGroup = (id: string, data: Partial<Omit<SubjectGroup, 'id'>>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
  };

  const deleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  // ── Subject ↔ Group assignment ───────────────────────────────────────────────

  /** เพิ่ม subject เข้า group (ลบออกจาก group เดิมก่อนถ้ามี) */
  const assignSubjectToGroup = (subjectId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return g.subjectIds.includes(subjectId)
          ? g
          : { ...g, subjectIds: [...g.subjectIds, subjectId] };
      }
      // ลบออกจาก group อื่น (1 วิชา → 1 group เท่านั้น)
      return { ...g, subjectIds: g.subjectIds.filter(id => id !== subjectId) };
    }));
  };

  /** toggle membership โดยไม่ย้าย group (ใช้เมื่อ 1 วิชาอยู่ได้หลาย group) */
  const toggleSubjectInGroup = (subjectId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const has = g.subjectIds.includes(subjectId);
      return {
        ...g,
        subjectIds: has
          ? g.subjectIds.filter(id => id !== subjectId)
          : [...g.subjectIds, subjectId],
      };
    }));
  };

  const removeSubjectFromGroup = (subjectId: string, groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, subjectIds: g.subjectIds.filter(id => id !== subjectId) }
        : g,
    ));
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  /** subjects ที่อยู่ใน group (ต้องการ subjects array ภายนอก) */
  const getGroupSubjects = (groupId: string): Subject[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    return subjects.filter(s => group.subjectIds.includes(s.id));
  };

  /** group ที่ subject อยู่ (returns undefined ถ้ายังไม่ assign) */
  const getSubjectGroup = (subjectId: string): SubjectGroup | undefined =>
    groups.find(g => g.subjectIds.includes(subjectId));

  /** subjects ที่ยังไม่ถูก assign group ใดเลย */
  const unassignedSubjects = useMemo<Subject[]>(() => {
    const assignedIds = new Set(groups.flatMap(g => g.subjectIds));
    return subjects.filter(s => !assignedIds.has(s.id));
  }, [groups, subjects]);

  /** groups เรียงลำดับตาม order */
  const sortedGroups = useMemo<SubjectGroup[]>(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups],
  );

  /** map groupId → Subject[] สำหรับ render ทีเดียว */
  const subjectsByGroup = useMemo<Record<string, Subject[]>>(() => {
    const result: Record<string, Subject[]> = {};
    for (const group of groups) {
      result[group.id] = subjects.filter(s => group.subjectIds.includes(s.id));
    }
    return result;
  }, [groups, subjects]);

  /** สถิติรวม: จำนวนวิชาและหน่วยกิตต่อกลุ่มสาระ */
  const groupStats = useMemo(() => {
    return groups.map(g => {
      const subs = subjectsByGroup[g.id] ?? [];
      return {
        groupId: g.id,
        groupKey: g.groupKey,
        name: g.name,
        subjectCount: subs.length,
        totalCredits: subs.reduce((sum, s) => sum + s.credits, 0),
        totalHours: subs.reduce((sum, s) => sum + s.hoursPerWeek, 0),
      };
    }).sort((a, b) => {
      const orderA = SUBJECT_GROUP_CONFIG[a.groupKey]?.order ?? 99;
      const orderB = SUBJECT_GROUP_CONFIG[b.groupKey]?.order ?? 99;
      return orderA - orderB;
    });
  }, [groups, subjectsByGroup]);

  return {
    // state
    groups,
    sortedGroups,
    subjectsByGroup,
    unassignedSubjects,
    groupStats,
    // CRUD
    addGroup,
    updateGroup,
    deleteGroup,
    // assignment
    assignSubjectToGroup,
    toggleSubjectInGroup,
    removeSubjectFromGroup,
    // queries
    getGroupSubjects,
    getSubjectGroup,
  };
}
