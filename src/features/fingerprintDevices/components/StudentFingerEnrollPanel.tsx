import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  HiCheckCircle,
  HiFingerPrint,
  HiMagnifyingGlass,
  HiUserCircle,
} from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DeviceLiveEnroll, FingerprintStudentUser } from '../types';

type Props = {
  students: FingerprintStudentUser[];
  isLoading: boolean;
  isUpdating: boolean;
  onSaveTemplate: (uid: string, templateId: number | null) => Promise<void>;
  liveEnroll?: DeviceLiveEnroll;
  isLive: boolean;
  readOnly?: boolean;
};

export default function StudentFingerEnrollPanel({
  students,
  isLoading,
  isUpdating,
  onSaveTemplate,
  liveEnroll,
  isLive,
  readOnly = false,
}: Props) {
  const [filter, setFilter] = useState('');
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const lastBoundKeyRef = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.studentCode?.toLowerCase().includes(q) ?? false) ||
        (s.gradeLevel?.toLowerCase().includes(q) ?? false),
    );
  }, [students, filter]);

  const enrolledCount = students.filter((s) => s.fingerprintTemplateId != null).length;
  const activeStudent = students.find((s) => s.uid === activeUid) ?? null;

  useEffect(() => {
    if (!isLive || !activeStudent || !liveEnroll) return;
    if (liveEnroll.phase !== 'done' || liveEnroll.slot == null) return;

    const key = `${activeStudent.uid}:${liveEnroll.slot}:${liveEnroll.detail}`;
    if (lastBoundKeyRef.current === key) return;
    lastBoundKeyRef.current = key;

    if (activeStudent.fingerprintTemplateId === liveEnroll.slot) {
      toast.success(`${activeStudent.displayName} มี Template #${liveEnroll.slot} อยู่แล้ว`);
      return;
    }

    void onSaveTemplate(activeStudent.uid, liveEnroll.slot)
      .then(() => {
        toast.success(`บันทึกลายนิ้ว #${liveEnroll.slot} ให้ ${activeStudent.displayName} แล้ว`);
      })
      .catch(() => {
        toast.error('บันทึก Template ID ไม่สำเร็จ');
        lastBoundKeyRef.current = null;
      });
  }, [activeStudent, isLive, liveEnroll, onSaveTemplate]);

  const enrollPhase = liveEnroll?.phase;
  const enrollInProgress =
    isLive &&
    !!activeStudent &&
    enrollPhase != null &&
    enrollPhase !== 'idle' &&
    enrollPhase !== 'done' &&
    enrollPhase !== 'fail';

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            ลงทะเบียนลายนิ้วนักเรียน
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            เลือกนักเรียนทีละคน แล้วสแกนนิ้วที่เครื่อง — ระบบจะผูก Template ID อัตโนมัติเมื่อ Live
          </p>
          <p className="mt-1 text-[10px] font-semibold text-sky-700">
            ลงทะเบียนแล้ว {enrolledCount} / {students.length} คน
          </p>
        </div>
        <div className="relative w-full sm:max-w-[200px]">
          <HiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="ค้นหาชื่อ / เลขประจำตัว..."
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {activeStudent ? (
        <div
          className={cn(
            'mb-3 rounded-xl border px-3 py-2.5 text-xs',
            enrollInProgress
              ? 'border-sky-200 bg-sky-50 text-sky-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900',
          )}
        >
          <p className="font-bold">กำลังลงทะเบียน</p>
          <p className="mt-0.5 font-medium">{activeStudent.displayName}</p>
          {activeStudent.studentCode ? (
            <p className="font-mono text-[10px] opacity-80">{activeStudent.studentCode}</p>
          ) : null}
          <p className="mt-1.5 text-[11px] leading-relaxed opacity-90">
            {isLive
              ? enrollInProgress
                ? 'สแกนนิ้วบนเครื่องตามขั้นตอนบนจอซ้าย'
                : liveEnroll?.phase === 'done'
                  ? 'สแกนสำเร็จ — กำลังบันทึกหรือบันทึกแล้ว'
                  : 'เปิดเมนูลงทะเบียนบนบอร์ด แล้ววางนิ้วบนเซ็นเซอร์'
              : 'เชื่อม Live (USB) แล้วเปิดเมนูลงทะเบียนบนบอร์ด'}
          </p>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setActiveUid(null)}
              className="mt-2 text-[10px] font-semibold underline opacity-80 hover:opacity-100"
            >
              ยกเลิกการเลือก
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mb-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          เลือกนักเรียนจากรายการด้านล่าง แล้วกด &quot;ลงทะเบียน&quot; — ทำทีละคนจนกว่าจะครบ
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">กำลังโหลดรายชื่อนักเรียน...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">ไม่พบนักเรียน</p>
      ) : (
        <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-xl border border-slate-100">
          <ul className="divide-y divide-slate-50">
            {filtered.map((student) => {
              const enrolled = student.fingerprintTemplateId != null;
              const isActive = activeUid === student.uid;
              return (
                <li
                  key={student.uid}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5',
                    isActive && 'bg-sky-50/80',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      enrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {enrolled ? (
                      <HiCheckCircle className="h-5 w-5" />
                    ) : (
                      <HiUserCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {student.displayName}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {[student.studentCode, student.gradeLevel].filter(Boolean).join(' · ') ||
                        '—'}
                      {enrolled ? (
                        <span className="ml-1 font-mono text-emerald-600">
                          · #{student.fingerprintTemplateId}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setActiveUid(student.uid)}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                        isActive
                          ? 'bg-sky-600 text-white'
                          : enrolled
                            ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            : 'bg-slate-900 text-white hover:bg-slate-800',
                      )}
                    >
                      <HiFingerPrint className="h-3.5 w-3.5" />
                      {isActive ? 'กำลังลง...' : enrolled ? 'ลงใหม่' : 'ลงทะเบียน'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
