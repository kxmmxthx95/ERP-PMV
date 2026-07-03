import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { ClassRoom } from '@/types/class';
import type { TeacherProfile } from '@/types/teacher';
import { logActivity } from '@/lib/activityLogger';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface TeacherTransferModalProps {
  open: boolean;
  outgoingTeacher: TeacherProfile | null;
  teachers: TeacherProfile[];
  classes: ClassRoom[];
  onClose: () => void;
  onTransferHomeroom: (params: {
    classIds: string[];
    incomingTeacherId: string;
  }) => Promise<void>;
}

function getTeacherIdSet(teacher: TeacherProfile) {
  return new Set(
    [teacher.id, teacher.userId].filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  );
}

export function getHomeroomClassesForTeacher(teacher: TeacherProfile, classes: ClassRoom[]) {
  const ids = getTeacherIdSet(teacher);
  return classes.filter((cls) => {
    const homeroomIds = cls.homeroomTeacherIds?.length
      ? cls.homeroomTeacherIds
      : cls.homeroomTeacherId
        ? [cls.homeroomTeacherId]
        : [];
    return homeroomIds.some((id) => ids.has(id));
  });
}

export function swapHomeroomTeacherIds(
  currentIds: string[],
  outgoingTeacher: TeacherProfile,
  incomingTeacher: TeacherProfile,
): string[] {
  const outgoingIds = getTeacherIdSet(outgoingTeacher);
  const swapped = currentIds.map((id) => (outgoingIds.has(id) ? incomingTeacher.id : id));
  const deduped = swapped.filter((id, index, arr) => arr.indexOf(id) === index);
  return deduped.slice(0, 2);
}

export default function TeacherTransferModal({
  open,
  outgoingTeacher,
  teachers,
  classes,
  onClose,
  onTransferHomeroom,
}: TeacherTransferModalProps) {
  const [incomingTeacherId, setIncomingTeacherId] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherResults, setShowTeacherResults] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homeroomClasses = useMemo(
    () => (outgoingTeacher ? getHomeroomClassesForTeacher(outgoingTeacher, classes) : []),
    [outgoingTeacher, classes],
  );

  useEffect(() => {
    if (!open) return;
    setIncomingTeacherId('');
    setTeacherSearch('');
    setShowTeacherResults(false);
    setSelectedClassIds(homeroomClasses.map((cls) => cls.id));
  }, [open, outgoingTeacher?.id, homeroomClasses]);

  const candidateTeachers = useMemo(() => {
    if (!outgoingTeacher) return [];
    const outgoingIds = getTeacherIdSet(outgoingTeacher);
    return teachers.filter((t) => t.status === 'active' && !outgoingIds.has(t.id));
  }, [teachers, outgoingTeacher]);

  const MIN_SEARCH_LENGTH = 5;

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (q.length < MIN_SEARCH_LENGTH) return [];
    return candidateTeachers
      .filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.position?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [candidateTeachers, teacherSearch]);

  const searchQueryLength = teacherSearch.trim().length;
  const canShowTeacherResults = showTeacherResults && searchQueryLength >= MIN_SEARCH_LENGTH;

  const incomingTeacher = candidateTeachers.find((t) => t.id === incomingTeacherId) ?? null;

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  const canSubmit =
    !!incomingTeacherId &&
    selectedClassIds.length > 0 &&
    homeroomClasses.length > 0 &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!outgoingTeacher || !incomingTeacher || selectedClassIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onTransferHomeroom({
        classIds: selectedClassIds,
        incomingTeacherId: incomingTeacher.id,
      });
      await logActivity({
        action: 'โอนสิทธิ์ครูประจำชั้น',
        category: 'academic',
        status: 'success',
        targetId: outgoingTeacher.id,
        detail: `โอนครูประจำชั้นจาก ${outgoingTeacher.name} ไป ${incomingTeacher.name} (${selectedClassIds.length} ห้อง)`,
        metadata: {
          outgoingTeacherId: outgoingTeacher.id,
          incomingTeacherId: incomingTeacher.id,
          classIds: selectedClassIds,
        },
      });
      toast.success(`โอนสิทธิ์ครูประจำชั้นให้ ${incomingTeacher.name} เรียบร้อยแล้ว`);
      onClose();
    } catch {
      toast.error('ไม่สามารถโอนสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg rounded-[2rem] border border-white/60 bg-white/95 p-0 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-bold text-slate-800">
              โอนสิทธิ์การทำงาน
            </DialogTitle>
            <p className="text-xs font-medium text-slate-500">
              ส่งต่อหน้าที่ให้ครูท่านใหม่รับช่วงต่อ
            </p>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          {outgoingTeacher && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">
                ครูที่ย้ายออก
              </p>
              <p className="text-sm font-bold text-slate-800">{outgoingTeacher.name}</p>
              <p className="text-xs font-medium text-slate-500">{outgoingTeacher.position || 'ครูผู้สอน'}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ครูผู้รับโอน <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => {
                  setTeacherSearch(e.target.value);
                  setShowTeacherResults(true);
                  if (!e.target.value.trim()) setIncomingTeacherId('');
                }}
                onFocus={() => setShowTeacherResults(true)}
                placeholder="ค้นหาชื่อครูที่จะรับโอน (อย่างน้อย 5 ตัวอักษร)..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm font-medium outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {showTeacherResults && searchQueryLength > 0 && searchQueryLength < MIN_SEARCH_LENGTH && (
              <p className="px-1 text-[11px] font-semibold text-slate-400">
                พิมพ์อย่างน้อย {MIN_SEARCH_LENGTH} ตัวอักษรเพื่อค้นหาครู
              </p>
            )}

            {canShowTeacherResults && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {filteredTeachers.length === 0 ? (
                  <p className="px-4 py-3 text-xs font-semibold text-slate-400">ไม่พบครูที่เลือกได้</p>
                ) : (
                  filteredTeachers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setIncomingTeacherId(t.id);
                        setTeacherSearch(t.name);
                        setShowTeacherResults(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-indigo-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{t.name}</p>
                        <p className="text-[11px] font-medium text-slate-400">{t.position || 'ครูผู้สอน'}</p>
                      </div>
                      {incomingTeacherId === t.id && <Check size={16} className="text-indigo-600 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {incomingTeacher && !showTeacherResults && (
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-900">{incomingTeacher.name}</p>
                  <p className="text-[11px] font-medium text-indigo-500">ครูผู้รับโอน</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ครูประจำชั้น
              </label>
              {homeroomClasses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassIds((prev) =>
                      prev.length === homeroomClasses.length ? [] : homeroomClasses.map((c) => c.id),
                    );
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {selectedClassIds.length === homeroomClasses.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              )}
            </div>

            {homeroomClasses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-400">ครูท่านนี้ไม่ได้เป็นครูประจำชั้นในห้องใด</p>
              </div>
            ) : (
              <div className="space-y-2">
                {homeroomClasses.map((cls) => {
                  const checked = selectedClassIds.includes(cls.id);
                  return (
                    <motion.button
                      key={cls.id}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => toggleClass(cls.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                        checked
                          ? 'border-indigo-200 bg-indigo-50/70 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">{cls.className || `${cls.gradeLevel}/${cls.roomNumber}`}</p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {cls.gradeLevel} · ห้อง {cls.roomNumber || '-'}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 flex-1 rounded-2xl bg-indigo-600 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'กำลังโอนสิทธิ์...' : 'ยืนยันโอนสิทธิ์'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
