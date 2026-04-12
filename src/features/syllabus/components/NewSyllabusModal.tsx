import { useState } from 'react';
import { X, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Subject } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';

interface NewSyllabusModalProps {
  open:       boolean;
  subjects:   Subject[];
  getTeachersForSubject: (subjectId: string) => TeacherProfile[];
  gradeLevels: string[];
  onClose:    () => void;
  onCreate:   (subject: Subject, teacher: TeacherProfile, gradeLevel: string) => void;
}

export default function NewSyllabusModal({
  open,
  subjects,
  getTeachersForSubject,
  gradeLevels,
  onClose,
  onCreate,
}: NewSyllabusModalProps) {
  const [search, setSearch]       = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');

  const filtered = subjects.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  const selectedSubject  = subjects.find(s => s.id === subjectId) ?? null;
  const eligibleTeachers = subjectId ? getTeachersForSubject(subjectId) : [];
  const selectedTeacher  = eligibleTeachers.find(t => t.id === teacherId) ?? null;

  const isValid = subjectId && teacherId && gradeLevel;

  const handleCreate = () => {
    if (!isValid || !selectedSubject || !selectedTeacher) return;
    onCreate(selectedSubject, selectedTeacher, gradeLevel);
    onClose();
    setSubjectId(''); setTeacherId(''); setGradeLevel(''); setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/05">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80">สร้างแผนการสอนใหม่</DialogTitle>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors">
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-black/40 mt-1">
            ระบบจะ auto-generate แผนรายสัปดาห์จากปฏิทินการศึกษา
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Subject search + select */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-black/60">รายวิชา <span className="text-red-400">*</span></Label>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาวิชา..."
                className="h-8 pl-8 text-xs rounded-xl bg-black/[0.03] border-transparent"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-black/[0.07] bg-black/[0.01]">
              {filtered.map(s => {
                const dept = DEPARTMENT_CONFIG[s.department];
                const isSelected = s.id === subjectId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSubjectId(s.id); setTeacherId(''); }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-black/[0.03] transition-colors border-b border-black/[0.04] last:border-0"
                    style={isSelected ? { background: 'rgba(59,130,246,0.07)' } : undefined}
                  >
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background: dept.bg, color: dept.color }}
                    >
                      {dept.label.slice(0, 2)}
                    </span>
                    <span className="font-mono text-[10px] text-black/35 shrink-0">{s.code}</span>
                    <span className="text-xs text-black/70 truncate">{s.name}</span>
                    <span className="text-[10px] text-black/30 shrink-0 ml-auto">{s.credits} นก.</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teacher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">
              ครูผู้สอน <span className="text-red-400">*</span>
              {subjectId && eligibleTeachers.length === 0 && (
                <span className="text-orange-500 font-normal ml-2">— ยังไม่มีครูรับผิดชอบวิชานี้</span>
              )}
            </Label>
            <Select
              value={teacherId}
              onValueChange={setTeacherId}
              disabled={!subjectId || eligibleTeachers.length === 0}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกครูผู้สอน..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {eligibleTeachers.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name}
                    <span className="text-black/35 ml-1.5 text-[10px]">· {t.position}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grade Level */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ระดับชั้น <span className="text-red-400">*</span></Label>
            <Select value={gradeLevel} onValueChange={setGradeLevel}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกระดับชั้น..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-52">
                {gradeLevels.map(g => (
                  <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedSubject && selectedTeacher && gradeLevel && (
            <div
              className="rounded-xl px-4 py-3 text-[11px] space-y-1"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
            >
              <p className="font-semibold text-black/60">ตัวอย่างแผนการสอนที่จะสร้าง</p>
              <p className="text-black/50">{selectedSubject.name} ({selectedSubject.code}) · {gradeLevel}</p>
              <p className="text-black/50">ครู: {selectedTeacher.name}</p>
              <p className="text-black/40 mt-1">
                ระบบจะ auto-generate แผนรายสัปดาห์ให้อัตโนมัติ จากปฏิทินการศึกษา
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8 rounded-lg border-black/10">
            ยกเลิก
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!isValid}
            className="text-xs h-8 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white disabled:opacity-40"
          >
            สร้างแผนการสอน
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
