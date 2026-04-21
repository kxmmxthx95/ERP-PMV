import { useState, useMemo, useEffect } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
  DEPARTMENT_CONFIG,
  type Subject, type CurriculumMap, type Department, type CreditSummary,
} from '@/types/curriculum';

// ── Hook ──────────────────────────────────────────────────────────────────────

export type NewSubject = Omit<Subject, 'id'>;
export type NewCurriculumMap = Omit<CurriculumMap, 'id'>;

export function useCurriculum() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [maps, setMaps] = useState<CurriculumMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── ดึงข้อมูล Real-time จาก Firebase ──────────────────────────────────────────
  useEffect(() => {
    let subjectsLoaded = false;
    let mapsLoaded = false;

    const checkLoading = () => {
      if (subjectsLoaded && mapsLoaded) {
        setIsLoading(false);
      }
    };

    const unsubSubjects = onSnapshot(
      collection(db, 'subject_repository'),
      (snap) => {
        const allSubjects: Subject[] = [];
        snap.forEach(doc => {
          const data = doc.data() as { groups: any };
          if (data.groups) {
            Object.values(data.groups).forEach((group: any) => {
              if (group.categories) {
                Object.values(group.categories).forEach((subjectMap: any) => {
                  // ตอนนี้ subjectMap คือ { [id]: subject }
                  if (typeof subjectMap === 'object' && subjectMap !== null) {
                    Object.values(subjectMap).forEach((s: any) => {
                      if (s && s.id) allSubjects.push(s as Subject);
                    });
                  }
                });
              }
            });
          }
        });
        setSubjects(allSubjects);
        subjectsLoaded = true;
        checkLoading();
      },
      (err) => {
        console.error('Subjects Repository Permission Denied:', err.message);
        setIsLoading(false);
      }
    );

    const unsubMaps = onSnapshot(
      collection(db, 'curriculum_maps'),
      (snap) => {
        setMaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as CurriculumMap)));
        mapsLoaded = true;
        checkLoading();
      },
      (err) => {
        console.error('Curriculum Maps Permission Denied:', err.message);
        setIsLoading(false);
      }
    );

    return () => {
      unsubSubjects();
      unsubMaps();
    };
  }, []);

  // ── Subject CRUD (Hierarchical) ──────────────────────────────────────────────
  const addSubject = async (data: NewSubject) => {
    try {
      const subjectId = doc(collection(db, 'id_generator')).id;
      const finalSubject: Subject = { ...data, id: subjectId };
      
      const docId = `${data.department}_${data.gradeLevel || 'general'}`;
      const docRef = doc(db, 'subject_repository', docId);

      // ใช้ dot notation เพื่ออัปเดตเฉพาะหมวดหมู่ที่เกี่ยวข้อง
      
      // เราต้องใช้ arrayUnion ในกรณีนี้ แต่เนื่องจากมันคือ Array ของ Object 
      // การใช้ arrayUnion อาจจะซับซ้อนถ้าต้องการคุมระเบียบ แนะนำดึงมาจัดการก่อนหรือใช้ dot notation กับ array
      
      // วิธีที่ชัวร์ที่สุดสำหรับ Hierarchy คือดึงมาอัปเดต (แต่ถ้าต้องการ Atomic อาจจะลำบาก)
      // หรือเก็บเป็น Map ของ ID แทน Array เพื่อให้ใช้ dot notation ได้แม่นยำ 100%
      
      // ปรับดีไซน์: เก็บเป็น Object { [id]: subject } เพื่อให้ update/delete ง่ายขึ้นมาก
      const registryPath = `groups.${data.subjectGroup}.categories.${data.category}.${subjectId}`;
      
      await updateDoc(docRef, {
        [registryPath]: finalSubject
      }).catch(async (err) => {
        if (err.code === 'not-found') {
          const batch = writeBatch(db);
          const gId = data.subjectGroup as string;
          const cId = data.category as string;
          batch.set(docRef, { 
            groups: { 
              [gId]: { 
                categories: { 
                  [cId]: { 
                    [subjectId as string]: finalSubject 
                  } 
                } 
              } 
            } 
          }, { merge: true });
          await batch.commit();
        } else {
          throw err;
        }
      });

      console.log('Subject added to repository:', subjectId);
      return subjectId;
    } catch (error) {
      console.error('Error adding subject:', error);
      throw error;
    }
  };

  const addBulkSubjects = async (items: NewSubject[]) => {
    try {
      const batch = writeBatch(db);
      // จัดกลุ่มวิชาตาม docId (department_grade)
      const groupsByDoc: Record<string, NewSubject[]> = {};
      
      items.forEach(item => {
        const docId = `${item.department}_${item.gradeLevel || 'general'}`;
        if (!groupsByDoc[docId]) groupsByDoc[docId] = [];
        groupsByDoc[docId].push(item);
      });

      for (const [docId, subjectsToadd] of Object.entries(groupsByDoc)) {
        const docRef = doc(db, 'subject_repository', docId);
        const updateData: Record<string, any> = {};
        
        subjectsToadd.forEach(s => {
          const subjectId = doc(collection(db, 'id_generator')).id;
          const finalSubject: Subject = { ...s, id: subjectId };
          const registryPath = `groups.${s.subjectGroup}.categories.${s.category}.${subjectId}`;
          updateData[registryPath] = finalSubject;
        });

        // อัปเดตรวดเดียวในเอกสารนั้น
        await updateDoc(docRef, updateData).catch(async (err) => {
          if (err.code === 'not-found') {
            const initialData: any = { groups: {} };
            subjectsToadd.forEach(s => {
              const subjectId = doc(collection(db, 'id_generator')).id;
              const finalSubject: Subject = { ...s, id: subjectId };
              const gId = s.subjectGroup as string;
              const cId = s.category as string;
              if (!initialData.groups[gId]) initialData.groups[gId] = { categories: {} };
              if (!initialData.groups[gId].categories[cId]) initialData.groups[gId].categories[cId] = {};
              initialData.groups[gId].categories[cId][subjectId] = finalSubject;
            });
            batch.set(docRef, initialData, { merge: true });
          } else {
            throw err;
          }
        });
      }
      
      await batch.commit();
      console.log('Successfully added', items.length, 'subjects in bulk');
    } catch (error) {
      console.error('Error adding bulk subjects:', error);
      throw error;
    }
  };

  const updateSubject = async (id: string, data: Partial<Subject>) => {
    // หาตำแหน่งเดิมก่อนเพื่ออัปเดตให้ถูกจุด
    const oldSubject = subjects.find(s => s.id === id);
    if (!oldSubject) return;

    const docId = `${oldSubject.department}_${oldSubject.gradeLevel || 'general'}`;
    const docRef = doc(db, 'subject_repository', docId);
    
    // ถ้ามีการเปลี่ยน แผนก/ชั้น/กลุ่ม/หมวด ต้องทำการย้ายที่ (Delete ➔ Add)
    const isMoving = (data.department && data.department !== oldSubject.department) ||
                     (data.gradeLevel && data.gradeLevel !== oldSubject.gradeLevel) ||
                     (data.subjectGroup && data.subjectGroup !== oldSubject.subjectGroup) ||
                     (data.category && data.category !== oldSubject.category);

    if (isMoving) {
      await deleteSubject(id);
      const updatedSubject = { ...oldSubject, ...data } as Subject;
      await addSubject(updatedSubject);
    } else {
      const registryPath = `groups.${oldSubject.subjectGroup}.categories.${oldSubject.category}.${id}`;
      await updateDoc(docRef, {
        [registryPath]: { ...oldSubject, ...data }
      });
    }
  };

  const deleteSubject = async (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    const docId = `${subject.department}_${subject.gradeLevel || 'general'}`;
    const docRef = doc(db, 'subject_repository', docId);
    
    const registryPath = `groups.${subject.subjectGroup}.categories.${subject.category}.${id}`;
    
    // ใช้ deleteField() หรือลบ Key ออกจาก Object
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(docRef, {
      [registryPath]: deleteField()
    });
    
    // ลบออกจาก Maps ด้วย (คงเดิมจากตรรกะเดิม)
    const affectedMaps = maps.filter(map => {
      if (!map.sections) return false;
      for (const dept in map.sections) {
        for (const grade in map.sections[dept]) {
          const s = map.sections[dept][grade];
          if (s.semester1.includes(id) || s.semester2.includes(id)) return true;
        }
      }
      return false;
    });

    if (affectedMaps.length > 0) {
      const batch = writeBatch(db);
      affectedMaps.forEach(map => {
        const newSections = { ...map.sections };
        let modified = false;
        
        for (const dept in newSections) {
          for (const grade in newSections[dept]) {
            const s = newSections[dept][grade];
            if (s.semester1.includes(id)) {
              s.semester1 = s.semester1.filter(sid => sid !== id);
              modified = true;
            }
            if (s.semester2.includes(id)) {
              s.semester2 = s.semester2.filter(sid => sid !== id);
              modified = true;
            }
          }
        }

        if (modified) {
          batch.update(doc(db, 'curriculum_maps', map.id), { sections: newSections });
        }
      });
      await batch.commit();
    }
  };

  // ── Curriculum Map CRUD ─────────────────────────────────────────────────────
  const getOrCreateMap = async (name: string, academicYear: string, description?: string) => {
    const existing = maps.find(m => m.name === name && m.academicYear === academicYear);
    if (existing) return existing;
    
    const newMap: any = {
      name,
      academicYear,
      subjectIds1: [],
      subjectIds2: [],
    };
    if (description) newMap.description = description;

    const docRef = await addDoc(collection(db, 'curriculum_maps'), newMap);
    return { id: docRef.id, ...newMap } as CurriculumMap;
  };

  const toggleSubjectInMap = async (
    mapId: string,
    department: Department,
    gradeLevel: string,
    semester: 1 | 2,
    subjectId: string,
  ) => {
    const existing = maps.find(m => m.id === mapId);
    if (!existing || !gradeLevel) {
      console.warn('[useCurriculum] toggleSubjectInMap blocked — map not found or gradeLevel empty', { mapId, gradeLevel, mapsCount: maps.length });
      return;
    }

    const semKey = semester === 1 ? 'semester1' : 'semester2';

    // Deep-copy sections to avoid mutating current state
    const sections: any = JSON.parse(JSON.stringify(existing.sections || {}));
    if (!sections[department]) sections[department] = {};
    if (!sections[department][gradeLevel]) sections[department][gradeLevel] = { semester1: [], semester2: [] };

    const currentList: string[] = sections[department][gradeLevel][semKey] || [];
    const has = currentList.includes(subjectId);
    sections[department][gradeLevel][semKey] = has
      ? currentList.filter((id: string) => id !== subjectId)
      : [...currentList, subjectId];

    const sub = subjects.find(s => s.id === subjectId);
    const action = has ? 'นำออกจากแผน' : 'เพิ่มเข้าแผน';

    // Optimistic update
    setMaps(prev => prev.map(m => m.id === existing.id ? { ...m, sections } : m));

    // Firestore write
    try {
      await updateDoc(doc(db, 'curriculum_maps', existing.id), { sections });
      toast.success(`${action} "${sub?.name || subjectId}" ใน [${gradeLevel}] เทอม ${semester} เรียบร้อยแล้ว`);
    } catch (error) {
      // Rollback optimistic update
      setMaps(prev => prev.map(m => m.id === existing.id ? existing : m));
      console.error('[useCurriculum] updateDoc failed:', error);
      toast.error(`เกิดข้อผิดพลาดในการบันทึก: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteCurriculumMap = async (id: string) => {
    await deleteDoc(doc(db, 'curriculum_maps', id));
  };

  const updateCurriculumMap = async (id: string, data: Partial<CurriculumMap>) => {
    await updateDoc(doc(db, 'curriculum_maps', id), data as any);
  };

  // สร้างหลักสูตรใหม่ (สร้าง 1 Doc พร้อมโครงสร้าง แผนก/ชั้น/เทอม ครบครัน)
  const createCurriculum = async (name: string, academicYear: string, description?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('กรุณากรอกชื่อหลักสูตร');
    
    const existing = maps.find(m => m.name === trimmedName && m.academicYear === academicYear);
    if (existing) throw new Error(`หลักสูตร "${trimmedName}" มีอยู่แล้วในปีการศึกษา ${academicYear}`);
    
    // ── สร้างโครงสร้างเริ่มต้น ──
    const sections: any = {};
    const deptKeys: Department[] = ['early', 'primary', 'secondary'];
    
    deptKeys.forEach(dept => {
      sections[dept] = {};
      const config = DEPARTMENT_CONFIG[dept];
      if (config) {
        config.grades.forEach(grade => {
          sections[dept][grade] = {
            semester1: [],
            semester2: []
          };
        });
      }
    });

    const newMap: any = {
      name: trimmedName,
      academicYear,
      sections,
    };
    if (description) newMap.description = description;

    const docRef = await addDoc(collection(db, 'curriculum_maps'), newMap);
    return { id: docRef.id, ...newMap } as CurriculumMap;
  };

  // ── Derived Queries ─────────────────────────────────────────────────────────
  const getMapSubjects = (mapId: string, department: Department, gradeLevel: string, semester: 1 | 2): Subject[] => {
    const map = maps.find(m => m.id === mapId);
    if (!map || !department || !gradeLevel) return [];
    const semKey = semester === 1 ? 'semester1' : 'semester2';
    const ids = map.sections?.[department]?.[gradeLevel]?.[semKey] || [];
    return subjects.filter(s => ids.includes(s.id));
  };

  const getCreditSummary = (mapId: string, department: Department, gradeLevel: string, semester: 1 | 2): CreditSummary => {
    const mapSubjects = getMapSubjects(mapId, department, gradeLevel, semester);
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

  const isInMap = (mapId: string, department: Department, gradeLevel: string, semester: 1 | 2, subjectId: string): boolean => {
    const map = maps.find(m => m.id === mapId);
    if (!map || !department || !gradeLevel) return false;
    const semKey = semester === 1 ? 'semester1' : 'semester2';
    const ids = map.sections?.[department]?.[gradeLevel]?.[semKey] || [];
    return ids.includes(subjectId);
  };

  // ── Clone Curriculum ─────────────────────────────────────────────────────────
  const cloneCurriculum = async (fromYear: string, toYear: string, overwrite = false) => {
    const fromMaps = maps.filter(m => m.academicYear === fromYear);
    if (fromMaps.length === 0) return { cloned: 0, skipped: 0 };

    let cloned = 0;
    let skipped = 0;
    const batch = writeBatch(db);

    for (const src of fromMaps) {
      const existing = maps.find(m => m.name === src.name && m.academicYear === toYear);
      
      if (existing) {
        if (overwrite) {
          batch.update(doc(db, 'curriculum_maps', existing.id), {
            sections: JSON.parse(JSON.stringify(src.sections)) // Deep clone
          });
          cloned++;
        } else {
          skipped++;
        }
      } else {
        const newRef = doc(collection(db, 'curriculum_maps'));
        batch.set(newRef, {
          name: src.name,
          academicYear: toYear,
          sections: JSON.parse(JSON.stringify(src.sections))
        });
        cloned++;
      }
    }

    await batch.commit();
    return { cloned, skipped };
  };

  // ── Year Stats (for registration overview) ───────────────────────────────────
  const getYearRegistrationGrid = (academicYear: string) => {
    const yearMaps = maps.filter(m => m.academicYear === academicYear);
    return yearMaps.map(map => {
      let count1 = 0;
      let credits1 = 0;
      let count2 = 0;
      let credits2 = 0;

      // วนรอบทุกแผนกและชั้นเพื่อหาผลรวม
      for (const dept in map.sections) {
        for (const grade in map.sections[dept]) {
          const s = map.sections[dept][grade];
          
          const s1 = subjects.filter(sub => s.semester1.includes(sub.id));
          count1 += s1.length;
          credits1 += s1.reduce((acc, sub) => acc + sub.credits, 0);

          const s2 = subjects.filter(sub => s.semester2.includes(sub.id));
          count2 += s2.length;
          credits2 += s2.reduce((acc, sub) => acc + sub.credits, 0);
        }
      }
      
      return {
        id: map.id,
        name: map.name,
        count1,
        credits1,
        count2,
        credits2,
      };
    });
  };

  // ── Get all unique academic years present in maps ────────────────────────────
  const getAllYears = (): string[] => {
    return [...new Set(maps.map(m => m.academicYear))].sort((a, b) => Number(b) - Number(a));
  };

  return {
    isLoading,
    subjects,
    maps,
    subjectsByDepartment,
    addSubject,
    addBulkSubjects,
    updateSubject,
    deleteSubject,
    deleteCurriculumMap,
    updateCurriculumMap,
    createCurriculum,
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
