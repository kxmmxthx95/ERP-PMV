import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, BookOpen, User, Home } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DAY_LABELS,
  type SchoolDay, type ScheduleEntry,
} from '@/types/schedule';
import type { Teacher, SchoolClass } from '@/types/schedule';
import type { Subject } from '@/types/curriculum';
import type { ConflictResult } from '@/types/schedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

interface ScheduleSlotModalProps {
  open: boolean;
  day: SchoolDay | null;
  period: number | null;
  editingEntry: ScheduleEntry | null;
  classId: string;
  year: string;
  semester: 1 | 2;
  subjects: Subject[];
  teachers: Teacher[];
  classes: SchoolClass[];
  prefilledSubjectId?: string;
  prefilledTeacherId?: string;
  onClose: () => void;
  onSave: (data: Omit<ScheduleEntry, 'id'>) => ConflictResult | Promise<ConflictResult>;
  onUpdate: (id: string, data: Omit<ScheduleEntry, 'id'>) => ConflictResult | Promise<ConflictResult>;
  onDelete?: (id: string) => void | Promise<void>;
}

export default function ScheduleSlotModal({
  open,
  day,
  period,
  editingEntry,
  classId,
  year,
  semester,
  subjects,
  teachers,
  classes,
  prefilledSubjectId,
  prefilledTeacherId,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: ScheduleSlotModalProps) {
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [internalClassId, setInternalClassId] = useState('');
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal internal classroom filtering
  const [modalFilterDept, setModalFilterDept] = useState<'all' | 'early' | 'primary' | 'secondary'>('all');
  const [modalFilterGrade, setModalFilterGrade] = useState<string>('all');

  const filteredModalClasses = useMemo(() => {
    return classes.filter(c => {
      const deptMatch = modalFilterDept === 'all' || c.department === modalFilterDept;
      const gradeMatch = modalFilterGrade === 'all' || c.gradeLevel === modalFilterGrade;
      return deptMatch && gradeMatch;
    }).sort((a, b) => a.label.localeCompare(b.label, 'th', { numeric: true }));
  }, [classes, modalFilterDept, modalFilterGrade]);

  const availableModalGrades = useMemo(() => {
    const src = modalFilterDept === 'all' ? classes : classes.filter(c => c.department === modalFilterDept);
    return [...new Set(src.map(c => c.gradeLevel))].sort();
  }, [classes, modalFilterDept]);

  const effectiveClassId = classId || internalClassId;
  const { periodTimes, lunchPeriods, breakPeriods } = useScheduleSettings(effectiveClassId);

  useEffect(() => {
    if (open) {
      setSubjectId(editingEntry?.subjectId ?? prefilledSubjectId ?? '');
      setTeacherId(editingEntry?.teacherId ?? prefilledTeacherId ?? '');
      setRoom(editingEntry?.room ?? '');
      setInternalClassId('');
      setConflictResult(null);
      setSaved(false);
      setSaving(false);
    }
  }, [open, editingEntry, prefilledSubjectId, prefilledTeacherId]);

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const selectedTeacher = teachers.find(t => t.id === teacherId);

  const eligibleTeachers = subjectId
    ? teachers.filter(t =>
        !t.teachingSubjectIds ||
        t.teachingSubjectIds.length === 0 ||
        t.teachingSubjectIds.includes(subjectId),
      )
    : teachers;

  const isValid = subjectId && teacherId && day && period && effectiveClassId;

  if (!day || !period) return null;

  const isRest = lunchPeriods.includes(period) || breakPeriods.includes(period);
  const isLunch = lunchPeriods.includes(period);
  const periodTime = periodTimes[period];

  const handleSave = async () => {
    if (!isValid || !day || !period) return;
    setSaving(true);
    setConflictResult(null);

    const data: any = {
      classId: effectiveClassId,
      subjectId,
      subjectName: selectedSubject?.name ?? '',
      subjectCode: selectedSubject?.code ?? '',
      subjectGroup: selectedSubject?.subjectGroup ?? '',
      teacherId,
      teacherName: selectedTeacher?.name ?? '',
      day,
      period,
      year,
      semester,
    };

    if (room.trim()) {
      data.room = room.trim();
    }

    const result = editingEntry
      ? onUpdate(editingEntry.id, data)
      : onSave(data);

    const resolved = result instanceof Promise ? await result : result;
    setSaving(false);
    setConflictResult(resolved);
    if (!resolved.hasConflict) {
      setSaved(true);
      setTimeout(onClose, 700);
    }
  };

    const subtitle = `${DAY_LABELS[day]}${period ? ` · คาบ ${period}` : ''}${periodTime ? ` · ${periodTime}` : ''}${effectiveClassId ? ` · ${classes.find(c => c.id === effectiveClassId)?.label || effectiveClassId}` : ''}`;

    return (
      <FormModal
        open={open}
        onClose={onClose}
        title={editingEntry ? 'แก้ไขคาบเรียน' : 'เพิ่มคาบเรียน'}
        subtitle={subtitle}
        onSubmit={handleSave}
        submitLabel={saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว' : editingEntry ? 'บันทึก' : 'เพิ่มลงตาราง'}
        submitDisabled={!isValid || isRest || saved || saving}
        submitClassName="bg-[#1f1f23] text-white hover:bg-[#18181b] disabled:bg-[#3a3a40] disabled:text-white/85 disabled:opacity-100 shadow-lg shadow-black/20"
        onDelete={editingEntry && onDelete ? () => { onDelete(editingEntry.id); onClose(); } : undefined}
        deleteLabel="ลบคาบนี้"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {isRest && (
            <div
              className="flex items-center gap-2 p-3 rounded-2xl text-xs font-medium"
              style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)', color: '#92400e' }}
            >
              <AlertTriangle size={13} />
              คาบที่ {period} เป็น{isLunch ? 'คาบพักกลางวัน' : 'คาบพักเบรก'} ไม่สามารถวางวิชาได้
            </div>
          )}

          {/* Class selector with filtering */}
          {!classId && (
            <FieldGroup icon={<Home size={13} />} label="ห้องเรียน">
              <div className="space-y-2.5">
                {/* Internal Filters for Classrooms */}
                <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-black/[0.03] border border-black/[0.05]">
                  {/* Dept Filter */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {['all', 'early', 'primary', 'secondary'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setModalFilterDept(d as any);
                          setModalFilterGrade('all');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          modalFilterDept === d
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white/50 text-black/40 hover:bg-white hover:text-black/60'
                        }`}
                      >
                        {d === 'all' ? 'ทั้งหมด' : d === 'early' ? 'อนุบาล' : d === 'primary' ? 'ประถม' : 'มัธยม'}
                      </button>
                    ))}
                  </div>

                  {/* Grade Filter */}
                  {modalFilterDept !== 'all' && (
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-black/[0.03]">
                      <button
                        type="button"
                        onClick={() => setModalFilterGrade('all')}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                          modalFilterGrade === 'all'
                            ? 'text-indigo-600'
                            : 'text-black/30 hover:text-black/50'
                        }`}
                      >
                        ทุกระดับ
                      </button>
                      {availableModalGrades.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setModalFilterGrade(g)}
                          className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all whitespace-nowrap ${
                            modalFilterGrade === g
                              ? 'text-indigo-600'
                              : 'text-black/30 hover:text-black/50'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Select value={internalClassId} onValueChange={setInternalClassId}>
                  <SelectTrigger className="w-full h-10 text-xs rounded-2xl bg-white border-slate-200 focus:ring-1 focus:ring-indigo-300">
                    <SelectValue placeholder={filteredModalClasses.length > 0 ? "เลือกห้องเรียน..." : "ไม่พบห้องเรียนที่ตรงเงื่อนไข"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-60">
                    {filteredModalClasses.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldGroup>
          )}

          {/* Subject */}
          <FieldGroup icon={<BookOpen size={13} />} label="วิชา">
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setTeacherId(''); }} disabled={isRest}>
              <SelectTrigger className="w-full h-10 text-xs rounded-2xl bg-white border-slate-200 focus:ring-1 focus:ring-indigo-300">
                <SelectValue placeholder="เลือกวิชา..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl max-h-60">
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="font-mono text-slate-400 mr-1.5 text-[10px]">{s.code}</span>
                    {s.name}
                    <span className="ml-1.5 text-slate-400 text-[10px]">{s.credits} นก.</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* Teacher */}
          <FieldGroup icon={<User size={13} />} label="ครูผู้สอน">
            <Select value={teacherId} onValueChange={setTeacherId} disabled={isRest || !subjectId}>
              <SelectTrigger className="w-full h-10 text-xs rounded-2xl bg-white border-slate-200 focus:ring-1 focus:ring-indigo-300">
                <SelectValue placeholder={subjectId ? 'เลือกครู...' : 'เลือกวิชาก่อน'} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl max-h-52">
                {eligibleTeachers.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                ))}
                {eligibleTeachers.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    ไม่มีครูที่รับผิดชอบวิชานี้
                  </div>
                )}
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* Room */}
          <FieldGroup icon={<Home size={13} />} label="ห้องเรียน (ไม่บังคับ)">
            <Input
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="เช่น ห้อง 201, ห้องวิทยาศาสตร์..."
              disabled={isRest}
              className="w-full h-10 text-xs rounded-2xl bg-white border-slate-200 focus-visible:ring-1 focus-visible:ring-indigo-300 placeholder:text-slate-300"
            />
          </FieldGroup>

          {/* Conflict */}
          <AnimatePresence>
            {conflictResult?.hasConflict && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-2xl p-3 space-y-1.5"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
              >
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle size={13} />
                  <span className="text-xs font-bold">พบปัญหาตารางซ้อนทับ</span>
                </div>
                {conflictResult.conflicts.map((c, i) => (
                  <p key={i} className="text-[11px] text-red-500 pl-5 leading-relaxed">{c.message}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-3 flex items-center gap-2"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}
              >
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-emerald-600">บันทึกสำเร็จ</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FormModal>
    );
  }

function FieldGroup({ icon, label, children }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-black/30">{icon}</span>
        <Label className="text-[11px] font-bold text-black/50">{label}</Label>
      </div>
      {children}
    </div>
  );
}
