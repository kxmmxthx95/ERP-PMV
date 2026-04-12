import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  onClose: () => void;
  onSave: (data: Omit<ScheduleEntry, 'id'>) => ConflictResult;
  onUpdate: (id: string, data: Omit<ScheduleEntry, 'id'>) => ConflictResult;
  onDelete?: (id: string) => void;
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
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: ScheduleSlotModalProps) {
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [saved, setSaved] = useState(false);

  const { periodTimes, lunchPeriod } = useScheduleSettings();

  // reset เมื่อ modal เปิด
  useEffect(() => {
    if (open) {
      setSubjectId(editingEntry?.subjectId ?? '');
      setTeacherId(editingEntry?.teacherId ?? '');
      setRoom(editingEntry?.room ?? '');
      setConflictResult(null);
      setSaved(false);
    }
  }, [open, editingEntry]);

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const selectedTeacher = teachers.find(t => t.id === teacherId);

  // กรองครูเฉพาะที่ได้รับมอบหมายวิชานี้ (teachingSubjectIds)
  // ถ้าครูไม่มี teachingSubjectIds (ข้อมูลเก่า) จะแสดงทุกคน
  const eligibleTeachers = subjectId
    ? teachers.filter(t =>
        !t.teachingSubjectIds ||
        t.teachingSubjectIds.length === 0 ||
        t.teachingSubjectIds.includes(subjectId),
      )
    : teachers;

  const isValid = subjectId && teacherId && day && period;

  const handleSave = () => {
    if (!isValid || !day || !period) return;

    const data: Omit<ScheduleEntry, 'id'> = {
      classId,
      subjectId,
      subjectName: selectedSubject?.name ?? '',
      subjectCode: selectedSubject?.code ?? '',
      teacherId,
      teacherName: selectedTeacher?.name ?? '',
      day,
      period,
      room: room.trim() || undefined,
      year,
      semester,
    };

    const result = editingEntry
      ? onUpdate(editingEntry.id, data)
      : onSave(data);

    setConflictResult(result);
    if (!result.hasConflict) {
      setSaved(true);
      setTimeout(onClose, 800);
    }
  };

  if (!day || !period) return null;

  const isLunch = period === lunchPeriod;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80">
              {editingEntry ? 'แก้ไขคาบเรียน' : 'เพิ่มคาบเรียน'}
            </DialogTitle>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 hover:text-black/60 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-black/40 mt-1">
            {DAY_LABELS[day]} · คาบ {period} ({periodTimes[period] || 'ยังไม่กำหนดเวลา'}) · ห้อง {classId}
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {isLunch && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
              คาบที่ 6 เป็นคาบพักกลางวัน ไม่สามารถวางวิชาได้
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">วิชา</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={isLunch}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกวิชา..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="font-mono text-black/40 mr-1.5">{s.code}</span>
                    {s.name}
                    <span className="ml-1.5 text-black/30">({s.credits} นก.)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Teacher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ครูผู้สอน</Label>
            <Select value={teacherId} onValueChange={setTeacherId} disabled={isLunch}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกครู..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-52">
                {eligibleTeachers.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ห้องเรียน <span className="font-normal text-black/30">(ไม่บังคับ)</span></Label>
            <Input
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="เช่น ห้อง 201, ห้องวิทย์..."
              disabled={isLunch}
              className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
            />
          </div>

          {/* Conflict warnings */}
          <AnimatePresence>
            {conflictResult?.hasConflict && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2"
              >
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle size={14} />
                  <span className="text-xs font-bold">พบปัญหาตารางซ้อนทับ</span>
                </div>
                {conflictResult.conflicts.map((c, i) => (
                  <p key={i} className="text-[11px] text-red-500 pl-5">{c.message}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-emerald-600"
              >
                <CheckCircle2 size={14} />
                <span className="text-xs font-semibold">บันทึกสำเร็จ</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-2">
          <div>
            {editingEntry && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onDelete(editingEntry.id); onClose(); }}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs h-8 rounded-lg"
              >
                ลบคาบนี้
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 rounded-lg border-black/10"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isValid || isLunch || saved}
              className="text-xs h-8 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white disabled:opacity-40"
            >
              {editingEntry ? 'บันทึกการแก้ไข' : 'เพิ่มลงตาราง'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
