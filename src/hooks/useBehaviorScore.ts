import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { getLocalDateString } from '@/lib/dateUtils';
import type {
  BehaviorRecord,
  BehaviorTemplate,
  BehaviorTotal,
  NewBehaviorTemplate,
} from '@/types/behavior';

const CATALOG_COL = 'behavior_catalog';
const RECORDS_COL = 'behavior_records';
const TOTALS_COL = 'behavior_totals';
const BASELINE_POINTS = 100;

function totalDocId(academicYearId: string, studentId: string): string {
  return `${academicYearId}_${studentId}`;
}

function sortTemplates(rows: BehaviorTemplate[]): BehaviorTemplate[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'positive' ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function buildCatalogWriteData(input: Partial<NewBehaviorTemplate>): Record<string, unknown> {
  const { severity, type, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };

  if (type !== undefined) data.type = type;

  if (type === 'positive') {
    data.severity = deleteField();
  } else if (type === 'negative' || severity !== undefined) {
    data.severity = severity ?? 'medium';
  }

  return data;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export function useBehaviorCatalog() {
  const [templates, setTemplates] = useState<BehaviorTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getDocs(collection(db, CATALOG_COL))
      .then((snap) => {
        if (cancelled) return;
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BehaviorTemplate))
          .filter((t) => t.isActive !== false);
        setTemplates(sortTemplates(rows));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((v) => v + 1), []);

  return { templates, loading, refresh };
}

export function useBehaviorCatalogActions() {
  const createTemplate = useCallback(async (input: NewBehaviorTemplate) => {
    const ref = doc(collection(db, CATALOG_COL));
    await runTransaction(db, async (tx) => {
      tx.set(ref, {
        ...buildCatalogWriteData(input),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await logActivity({
      action: 'behavior_catalog_create',
      category: 'data',
      detail: `เพิ่มรายการพฤติกรรม: ${input.label} (${input.points > 0 ? '+' : ''}${input.points})`,
      targetId: ref.id,
    });
    return ref.id;
  }, []);

  const updateTemplate = useCallback(async (id: string, data: Partial<NewBehaviorTemplate>) => {
    const ref = doc(db, CATALOG_COL, id);
    await runTransaction(db, async (tx) => {
      tx.update(ref, {
        ...buildCatalogWriteData(data),
        updatedAt: serverTimestamp(),
      });
    });
    await logActivity({
      action: 'behavior_catalog_update',
      category: 'data',
      detail: `แก้ไขรายการพฤติกรรม: ${data.label ?? id}`,
      targetId: id,
    });
  }, []);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    const ref = doc(db, CATALOG_COL, id);
    await runTransaction(db, async (tx) => {
      tx.update(ref, { isActive, updatedAt: serverTimestamp() });
    });
    await logActivity({
      action: 'behavior_catalog_toggle',
      category: 'data',
      detail: isActive ? 'เปิดใช้งานรายการพฤติกรรม' : 'ปิดใช้งานรายการพฤติกรรม',
      targetId: id,
    });
  }, []);

  return { createTemplate, updateTemplate, toggleActive };
}

// ── Totals ───────────────────────────────────────────────────────────────────

export function useBehaviorTotals(academicYearId: string | null | undefined) {
  const [totals, setTotals] = useState<Map<string, BehaviorTotal>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!academicYearId) {
      setTotals(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = query(collection(db, TOTALS_COL), where('academicYearId', '==', academicYearId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const map = new Map<string, BehaviorTotal>();
        snap.docs.forEach((d) => {
          const row = d.data() as BehaviorTotal;
          map.set(row.studentId, row);
        });
        setTotals(map);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [academicYearId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((v) => v + 1), []);

  return { totals, loading, refresh };
}

// ── Records (for reports) ────────────────────────────────────────────────────

export function useBehaviorRecords(
  academicYearId: string | null | undefined,
  fromDate: string,
  toDate: string,
) {
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!academicYearId || !fromDate || !toDate) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = query(
      collection(db, RECORDS_COL),
      where('academicYearId', '==', academicYearId),
      where('date', '>=', fromDate),
      where('date', '<=', toDate),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BehaviorRecord))
          .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ? 1 : 0));
        setRecords(rows);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [academicYearId, fromDate, toDate, reloadKey]);

  const refresh = useCallback(() => setReloadKey((v) => v + 1), []);

  return { records, loading, refresh };
}

export function useStudentBehaviorRecords(
  academicYearId: string | null | undefined,
  studentId: string | null | undefined,
) {
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!academicYearId || !studentId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = query(
      collection(db, RECORDS_COL),
      where('academicYearId', '==', academicYearId),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BehaviorRecord)));
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [academicYearId, studentId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((v) => v + 1), []);

  return { records, loading, refresh };
}

// ── Record action ────────────────────────────────────────────────────────────

interface RecordBehaviorStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  classId: string;
  className: string;
  departmentId: string;
}

interface RecordBehaviorTemplate {
  templateId: string;
  templateLabel: string;
  points: number;
  type: 'positive' | 'negative';
  severity?: BehaviorTemplate['severity'];
}

interface RecordBehaviorActor {
  recordedBy: string;
  recordedByName: string;
}

export function useBehaviorScoreActions() {
  const recordBehavior = useCallback(async (
    student: RecordBehaviorStudent,
    template: RecordBehaviorTemplate,
    actor: RecordBehaviorActor,
    academicYearId: string,
    semester: number,
    note?: string,
  ): Promise<BehaviorTotal> => {
    const recordRef = doc(collection(db, RECORDS_COL));
    const totalRef = doc(db, TOTALS_COL, totalDocId(academicYearId, student.studentId));
    const today = getLocalDateString();

    const nextTotal = await runTransaction(db, async (tx) => {
      const totalSnap = await tx.get(totalRef);
      const existing = totalSnap.exists() ? (totalSnap.data() as BehaviorTotal) : null;

      const baselinePoints = existing?.baselinePoints ?? BASELINE_POINTS;
      const totalPoints = (existing?.totalPoints ?? baselinePoints) + template.points;
      const positiveCount = (existing?.positiveCount ?? 0) + (template.type === 'positive' ? 1 : 0);
      const negativeCount = (existing?.negativeCount ?? 0) + (template.type === 'negative' ? 1 : 0);

      const updatedTotal: BehaviorTotal = {
        studentId: student.studentId,
        studentName: student.studentName,
        studentCode: student.studentCode,
        classId: student.classId,
        className: student.className,
        departmentId: student.departmentId,
        academicYearId,
        baselinePoints,
        totalPoints,
        positiveCount,
        negativeCount,
      };

      tx.set(recordRef, {
        studentId: student.studentId,
        studentName: student.studentName,
        studentCode: student.studentCode,
        classId: student.classId,
        className: student.className,
        departmentId: student.departmentId,
        academicYearId,
        semester,
        templateId: template.templateId,
        templateLabel: template.templateLabel,
        points: template.points,
        type: template.type,
        severity: template.type === 'negative' ? (template.severity ?? 'medium') : null,
        note: note?.trim() || null,
        recordedBy: actor.recordedBy,
        recordedByName: actor.recordedByName,
        date: today,
        createdAt: serverTimestamp(),
      });

      tx.set(totalRef, { ...updatedTotal, updatedAt: serverTimestamp() });

      return updatedTotal;
    });

    await logActivity({
      action: 'behavior_record_create',
      category: 'academic',
      detail: `บันทึกพฤติกรรม ${student.studentName}: ${template.templateLabel} (${template.points > 0 ? '+' : ''}${template.points})`,
      targetId: student.studentId,
    });

    return nextTotal;
  }, []);

  const deleteBehaviorRecord = useCallback(async (
    record: BehaviorRecord,
    academicYearId: string,
  ): Promise<BehaviorTotal> => {
    const recordRef = doc(db, RECORDS_COL, record.id);
    const totalRef = doc(db, TOTALS_COL, totalDocId(academicYearId, record.studentId));

    const nextTotal = await runTransaction(db, async (tx) => {
      const recordSnap = await tx.get(recordRef);
      if (!recordSnap.exists()) {
        throw new Error('ไม่พบรายการที่ต้องการลบ');
      }

      const existing = recordSnap.data() as BehaviorRecord;
      const totalSnap = await tx.get(totalRef);
      const currentTotal = totalSnap.exists() ? (totalSnap.data() as BehaviorTotal) : null;

      const baselinePoints = currentTotal?.baselinePoints ?? BASELINE_POINTS;
      const totalPoints = (currentTotal?.totalPoints ?? baselinePoints) - existing.points;
      const positiveCount = Math.max(
        0,
        (currentTotal?.positiveCount ?? 0) - (existing.type === 'positive' ? 1 : 0),
      );
      const negativeCount = Math.max(
        0,
        (currentTotal?.negativeCount ?? 0) - (existing.type === 'negative' ? 1 : 0),
      );

      const updatedTotal: BehaviorTotal = {
        studentId: record.studentId,
        studentName: record.studentName,
        studentCode: record.studentCode,
        classId: record.classId,
        className: record.className,
        departmentId: record.departmentId,
        academicYearId,
        baselinePoints,
        totalPoints,
        positiveCount,
        negativeCount,
      };

      tx.delete(recordRef);
      tx.set(totalRef, { ...updatedTotal, updatedAt: serverTimestamp() });

      return updatedTotal;
    });

    await logActivity({
      action: 'behavior_record_delete',
      category: 'academic',
      detail: `ลบบันทึกพฤติกรรม ${record.studentName}: ${record.templateLabel} (${record.points > 0 ? '+' : ''}${record.points})`,
      targetId: record.studentId,
    });

    return nextTotal;
  }, []);

  return { recordBehavior, deleteBehaviorRecord };
}
