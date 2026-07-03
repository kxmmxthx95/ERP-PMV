import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, getDocs, where, query, orderBy,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type {
  CurriculumVersion, CurriculumCourse, NewCurriculumCourse,
} from '@/types/curriculum';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCurriculumVersioned() {
  const { role } = useAuth();
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [coursesByVersion, setCoursesByVersion] = useState<Record<string, CurriculumCourse[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingVersionIds, setLoadingVersionIds] = useState<Set<string>>(new Set());
  const courseCacheRef = useRef<Set<string>>(new Set()); // Track which versions have been loaded
  const courseDataCacheRef = useRef<Record<string, CurriculumCourse[]>>({});

  // ── Load curriculum versions ──────────────────────────────────────────────
  // admin/sysadmin: real-time listener
  // all other authenticated roles: one-shot getDocs (quota-friendly, read-only view)
  useEffect(() => {
    if (!role) {
      setIsLoading(false);
      return;
    }

    const isAdmin = role === 'admin' || role === 'sysadmin';

    const q = query(
      collection(db, 'curriculums'),
      where('isDeleted', '!=', true),
      orderBy('isDeleted'),
    );

    if (isAdmin) {
      const unsubVersions = onSnapshot(q,
        (snap) => {
          const vers: CurriculumVersion[] = snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<CurriculumVersion, 'id'>),
          }));
          setVersions(vers.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)));
          setIsLoading(false);
        },
        (err) => {
          console.error('curriculums listener error:', err);
          setIsLoading(false);
        }
      );
      return () => unsubVersions();
    } else {
      // non-admin roles: one-shot fetch, no real-time updates needed
      getDocs(q)
        .then((snap) => {
          const vers: CurriculumVersion[] = snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<CurriculumVersion, 'id'>),
          }));
          setVersions(vers.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)));
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('curriculums fetch error:', err);
          setIsLoading(false);
        });
    }
  }, [role]);

  // ── Lazy load courses for a specific version (on-demand) ──────────────────
  const loadCoursesForVersion = useCallback(async (versionId: string): Promise<CurriculumCourse[]> => {
    const cached = courseDataCacheRef.current[versionId] ?? coursesByVersion[versionId];
    if (cached) return cached;

    setLoadingVersionIds(prev => new Set(prev).add(versionId));

    try {
      const coursesSnap = await getDocs(
        collection(db, 'curriculums', versionId, 'courses')
      );
      const courses = coursesSnap.docs.map(cd => ({
        id: cd.id,
        ...(cd.data() as Omit<CurriculumCourse, 'id'>),
      }));

      courseDataCacheRef.current[versionId] = courses;
      setCoursesByVersion(prev => ({
        ...prev,
        [versionId]: courses,
      }));

      courseCacheRef.current.add(versionId);
      return courses;
    } catch (err) {
      console.error(`Failed to load courses for version ${versionId}:`, err);
      return [];
    } finally {
      setLoadingVersionIds(prev => {
        const next = new Set(prev);
        next.delete(versionId);
        return next;
      });
    }
  }, [coursesByVersion]);

  // ── Version CRUD ──────────────────────────────────────────────────────────

  const createVersion = useCallback(async (
    data: Omit<CurriculumVersion, 'id' | 'createdAt' | 'allowEdit'>
  ) => {
    const existing = versions.find(v => v.name === data.name);
    if (existing) throw new Error(`หลักสูตรชื่อ "${data.name}" มีอยู่แล้ว`);

    const payload: Record<string, unknown> = {
      ...data,
      allowEdit: true,
      isDeleted: false,
      assignedGrades: data.assignedGrades ?? [],
      createdAt: new Date().toISOString(),
    };
    if (data.track) payload.track = data.track;
    if (data.level) payload.level = data.level;
    if (data.department) payload.department = data.department;

    const docRef = await addDoc(collection(db, 'curriculums'), payload);
    toast.success(`สร้างหลักสูตร "${data.name}" สำเร็จ`);
    return docRef.id;
  }, [versions]);

  const updateVersion = useCallback(async (id: string, data: Partial<CurriculumVersion>) => {
    await updateDoc(doc(db, 'curriculums', id), data as any);
  }, []);

  const deleteVersion = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'curriculums', id), {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    });
    toast.success('ลบหลักสูตรแล้ว');
  }, []);

  const assignGrades = useCallback(async (id: string, grades: string[]) => {
    await updateDoc(doc(db, 'curriculums', id), { assignedGrades: grades });
    toast.success(grades.length > 0 ? `กำหนด ${grades.length} ชั้นเรียนแล้ว` : 'ยกเลิกการกำหนดชั้นเรียนแล้ว');
  }, []);

  const toggleAllowEdit = useCallback(async (id: string, allow: boolean) => {
    await updateDoc(doc(db, 'curriculums', id), { allowEdit: allow });
    toast.success(allow ? 'เปิดโหมดแก้ไขแล้ว' : 'ปิดโหมดแก้ไขแล้ว');
  }, []);

  // ── Course CRUD (sub-collection) ──────────────────────────────────────────

  const addCourse = useCallback(async (versionId: string, data: NewCurriculumCourse) => {
    const courses = coursesByVersion[versionId] || [];
    const dupe = courses.find(c => c.courseCode.toUpperCase() === data.courseCode.toUpperCase());
    if (dupe) throw new Error(`รหัสวิชา "${data.courseCode}" มีอยู่แล้วในหลักสูตรนี้`);

    const payload = {
      ...data,
      courseCode: data.courseCode.toUpperCase(),
      subjectGroup: data.subjectGroup ?? '',
      gradeLevel: data.gradeLevel ?? '',
      isRetired: false,
      createdAt: new Date().toISOString(),
    };

    const ref = await addDoc(collection(db, 'curriculums', versionId, 'courses'), payload);

    setCoursesByVersion(prev => ({
      ...prev,
      [versionId]: [
        ...(prev[versionId] || []),
        { ...payload, id: ref.id },
      ],
    }));
    toast.success(`เพิ่มวิชา "${data.courseName}" แล้ว`);
    return ref.id;
  }, [coursesByVersion]);

  const updateCourse = useCallback(async (
    versionId: string, courseId: string, data: Partial<CurriculumCourse>
  ) => {
    const cleanData = { ...data };
    if (cleanData.subjectGroup === undefined) delete cleanData.subjectGroup;
    if (cleanData.gradeLevel === undefined) delete cleanData.gradeLevel;

    await updateDoc(doc(db, 'curriculums', versionId, 'courses', courseId), {
      ...cleanData,
      updatedAt: new Date().toISOString(),
    });
    setCoursesByVersion(prev => ({
      ...prev,
      [versionId]: (prev[versionId] || []).map(c =>
        c.id === courseId ? { ...c, ...cleanData } : c
      ),
    }));
    toast.success('อัปเดตวิชาแล้ว');
  }, []);

  const retireCourse = useCallback(async (versionId: string, courseId: string) => {
    await updateDoc(doc(db, 'curriculums', versionId, 'courses', courseId), {
      isRetired: true,
      updatedAt: new Date().toISOString(),
    });
    setCoursesByVersion(prev => ({
      ...prev,
      [versionId]: (prev[versionId] || []).map(c =>
        c.id === courseId ? { ...c, isRetired: true } : c
      ),
    }));
    toast.success('ยกเลิกวิชาแล้ว (Retired)');
  }, []);

  const deleteCourse = useCallback(async (versionId: string, courseId: string) => {
    await deleteDoc(doc(db, 'curriculums', versionId, 'courses', courseId));
    setCoursesByVersion(prev => ({
      ...prev,
      [versionId]: (prev[versionId] || []).filter(c => c.id !== courseId),
    }));
    toast.success('ลบวิชาแล้ว');
  }, []);

  // ── Duplicate from another version ───────────────────────────────────────

  const duplicateVersion = useCallback(async (
    fromId: string,
    newName: string,
    newYear?: number,
    description?: string,
  ) => {
    const currentThaiYear = new Date().getFullYear() + 543;

    // Load source courses if not already cached
    if (!coursesByVersion[fromId]) {
      await loadCoursesForVersion(fromId);
    }

    const sourceCourses = coursesByVersion[fromId] || [];
    if (sourceCourses.length === 0) {
      toast.error('หลักสูตรต้นทางไม่มีรายวิชา');
      return;
    }

    const newVersionId = await createVersion({ 
      year: newYear ?? currentThaiYear, 
      name: newName, 
      assignedGrades: [],
      description: description || ''
    });
    const batch = writeBatch(db);
    sourceCourses.forEach(c => {
      const newRef = doc(collection(db, 'curriculums', newVersionId, 'courses'));
      batch.set(newRef, {
        courseCode: c.courseCode,
        courseName: c.courseName,
        credit: c.credit,
        category: c.category,
        department: c.department,
        subjectGroup: c.subjectGroup ?? '',
        isRetired: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
    toast.success(`คัดลอก ${sourceCourses.length} วิชาสำเร็จ`);
    return newVersionId;
  }, [coursesByVersion, createVersion, loadCoursesForVersion]);

  // ── Summary helpers ───────────────────────────────────────────────────────

  const getCourseSummary = useCallback((versionId: string) => {
    const courses = (coursesByVersion[versionId] || []).filter(c => !c.isRetired);
    const totalCredit = courses.reduce((s, c) => s + (c.credit || 0), 0);
    const basic = courses.filter(c => c.category === 'basic').length;
    const additional = courses.filter(c => c.category === 'additional').length;
    const activity = courses.filter(c => c.category === 'activity').length;
    return { count: courses.length, totalCredit, basic, additional, activity };
  }, [coursesByVersion]);

  const isReadOnly = role !== 'admin' && role !== 'sysadmin';

  return {
    isLoading,
    isReadOnly,
    versions,
    coursesByVersion,
    loadingVersionIds,
    loadCoursesForVersion,
    createVersion,
    updateVersion,
    deleteVersion,
    assignGrades,
    toggleAllowEdit,
    addCourse,
    updateCourse,
    retireCourse,
    deleteCourse,
    duplicateVersion,
    getCourseSummary,
  };
}
