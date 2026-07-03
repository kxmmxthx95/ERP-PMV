import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { MicroSyllabus, NewMicroSyllabus, WeeklyTopic } from '@/types/microSyllabus';

export function useMicroSyllabus(teacherId: string | null) {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const [syllabi, setSyllabi] = useState<MicroSyllabus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeYear || !activeSemester || !teacherId) {
      setSyllabi([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'micro_syllabi'),
      where('academicYearId', '==', activeYear.year),
      where('semester', '==', activeSemester),
      where('teacherId', '==', teacherId),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as MicroSyllabus)
          .sort((a, b) => a.className.localeCompare(b.className, 'th'));
        setSyllabi(docs);
        setLoading(false);
      },
      err => {
        console.error('useMicroSyllabus:', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [activeYear, activeSemester, teacherId]);

  const createSyllabus = async (data: NewMicroSyllabus): Promise<string> => {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, 'micro_syllabi'), {
      ...data,
      topics: [] as WeeklyTopic[],
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  };

  const updateTopics = async (id: string, topics: WeeklyTopic[]) => {
    await updateDoc(doc(db, 'micro_syllabi', id), {
      topics,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateLessonOptions = async (id: string, lessonOptions: string[]) => {
    await updateDoc(doc(db, 'micro_syllabi', id), {
      lessonOptions,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteSyllabus = async (id: string) => {
    await deleteDoc(doc(db, 'micro_syllabi', id));
  };

  return { syllabi, loading, createSyllabus, updateTopics, updateLessonOptions, deleteSyllabus };
}

export function useMicroSyllabusAll(enabled = true) {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const [syllabi, setSyllabi] = useState<MicroSyllabus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !activeYear || !activeSemester) {
      setSyllabi([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'micro_syllabi'),
      where('academicYearId', '==', activeYear.year),
      where('semester', '==', activeSemester),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as MicroSyllabus)
          .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, 'th') || a.className.localeCompare(b.className, 'th'));
        setSyllabi(docs);
        setLoading(false);
      },
      err => {
        console.error('useMicroSyllabusAll:', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [enabled, activeYear, activeSemester]);

  return { syllabi, loading };
}
