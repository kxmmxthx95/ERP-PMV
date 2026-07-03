import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Task, CreateTaskInput, TaskStatus } from '@/types/task';

const COL = 'tasks';

function toTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    title: String(data.title ?? ''),
    description: data.description ? String(data.description) : undefined,
    priority: (data.priority as Task['priority']) ?? 'normal',
    status: (data.status as Task['status']) ?? 'pending',
    assigneeId: String(data.assigneeId ?? ''),
    assigneeName: String(data.assigneeName ?? ''),
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    dueDate: String(data.dueDate ?? ''),
    completedAt: data.completedAt ? String(data.completedAt) : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** งานที่ถูกมอบหมายให้ผู้ใช้คนนี้ (มุมมองครู/เจ้าหน้าที่) */
export function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'my', userId],
    queryFn: async () => {
      if (!userId) return [];
      const q = query(
        collection(db, COL),
        where('assigneeId', '==', userId),
        orderBy('dueDate', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** งานทั้งหมดที่ผู้บริหารคนนี้สร้าง (มุมมองผู้บริหาร) */
export function useCreatedTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'created', userId],
    queryFn: async () => {
      if (!userId) return [];
      const q = query(
        collection(db, COL),
        where('createdBy', '==', userId),
        orderBy('dueDate', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useCreateTask(createdByUid: string, createdByName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      await addDoc(collection(db, COL), {
        title: input.title.trim(),
        description: (input.description ?? '').trim(),
        priority: input.priority,
        status: 'pending',
        assigneeId: input.assigneeId,
        assigneeName: input.assigneeName,
        createdBy: createdByUid,
        createdByName,
        dueDate: input.dueDate,
        completedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', 'created', createdByUid] });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      await updateDoc(doc(db, COL, taskId), {
        status,
        completedAt: status === 'done' ? new Date().toISOString().slice(0, 10) : null,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
