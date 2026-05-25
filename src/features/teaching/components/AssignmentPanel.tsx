import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentAvatar from '@/features/students/components/StudentAvatar';

import { Plus, ClipboardList, Pencil, Trash2, ChevronDown, Star, Users, Calendar } from 'lucide-react';
import { GLASS } from '@/components/layouts/PortalLayout';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Assignment, NewAssignment, AssignmentSubmission, AssignmentType } from '@/types/teaching';
import type { ClassRoom } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Subject } from '@/types/curriculum';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssignmentPanelProps {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  assignments: Assignment[];
  getSubmissionsForAssignment: (id: string) => AssignmentSubmission[];
  onCreateAssignment: (data: NewAssignment) => Promise<string>;
  onUpdateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onInitSubmissions: (assignmentId: string, classId: string) => Promise<void>;
  onSaveSubmissionScore: (sub: AssignmentSubmission) => Promise<void>;
}

const TYPE_CONFIG: Record<AssignmentType, { label: string; color: string; bg: string }> = {
  homework: { label: 'การบ้าน', color: '#7c3aed', bg: '#f3e8ff' },
  project: { label: 'โครงงาน', color: '#2563eb', bg: '#dbeafe' },
  quiz: { label: 'ทดสอบย่อย', color: '#d97706', bg: '#fef3c7' },
  classwork: { label: 'งานในชั้น', color: '#059669', bg: '#d1fae5' },
};

const EMPTY_FORM: Omit<NewAssignment, 'teacherId' | 'academicYearId' | 'semester' | 'departmentId'> = {
  title: '',
  description: '',
  type: 'homework',
  subjectId: '',
  subjectName: '',
  classId: '',
  className: '',
  maxScore: 10,
  dueDate: new Date().toISOString().slice(0, 10),
  status: 'active',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignmentPanel({
  teacherId, academicYearId, semester,
  mySubjects, classes, assignments,
  getSubmissionsForAssignment,
  onCreateAssignment, onUpdateAssignment, onDeleteAssignment,
  onInitSubmissions, onSaveSubmissionScore,
}: AssignmentPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [scoringFor, setScoringFor] = useState<Assignment | null>(null);
  const [localScores, setLocalScores] = useState<Record<string, number | ''>>({});
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<AssignmentType | ''>('');

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM, subjectId: mySubjects[0]?.id ?? '', subjectName: mySubjects[0]?.name ?? '',
      classId: classes[0]?.id ?? '', className: classes[0]?.className ?? ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditTarget(a);
    setForm({
      title: a.title, description: a.description ?? '', type: a.type,
      subjectId: a.subjectId, subjectName: a.subjectName, classId: a.classId,
      className: a.className, maxScore: a.maxScore, dueDate: a.dueDate, status: a.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const subject = mySubjects.find(s => s.id === form.subjectId);
    const cls = classes.find(c => c.id === form.classId);
    const payload: NewAssignment = {
      ...form,
      subjectName: subject?.name ?? form.subjectName,
      className: cls?.className ?? form.className,
      departmentId: (cls?.departmentId ?? 'secondary') as import('@/types/curriculum').Department,
      teacherId, academicYearId, semester,
    };
    if (editTarget) {
      await onUpdateAssignment(editTarget.id, payload);
    } else {
      await onCreateAssignment(payload);
    }
    setIsModalOpen(false);
  };

  const openScoring = async (a: Assignment) => {
    setScoringFor(a);
    await onInitSubmissions(a.id, a.classId);
    const subs = getSubmissionsForAssignment(a.id);
    const scores: Record<string, number | ''> = {};
    subs.forEach(s => { scores[s.studentId] = s.score ?? ''; });
    setLocalScores(scores);
  };

  const handleSaveScores = async () => {
    if (!scoringFor) return;
    setSaving(true);
    const subs = getSubmissionsForAssignment(scoringFor.id);
    await Promise.all(subs.map(s =>
      onSaveSubmissionScore({ ...s, score: localScores[s.studentId] === '' ? undefined : Number(localScores[s.studentId]) })
    ));
    setSaving(false);
    setScoringFor(null);
  };

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const orderA = GRADE_LEVEL_ORDER[a.gradeLevel] || 999;
      const orderB = GRADE_LEVEL_ORDER[b.gradeLevel] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });
  }, [classes]);

  const filtered = filterType ? assignments.filter(a => a.type === filterType) : assignments;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] p-4 flex items-center gap-3 flex-wrap"
        style={{ ...GLASS, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
      >
        <div className="flex gap-2 flex-wrap">
          {([['', 'ทั้งหมด'], ...Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([key, label]) => (
            <button key={key}
              onClick={() => setFilterType(key as AssignmentType | '')}
              className="px-3.5 py-1.5 rounded-full text-[11px] font-bold font-sukhumvit transition-all"
              style={{
                background: filterType === key ? '#0f172a' : 'rgba(255,255,255,0.8)',
                color: filterType === key ? '#fff' : '#64748b',
              }}
            >{label}</button>
          ))}
        </div>
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={openCreate}
          className="ml-auto h-9 px-4 rounded-xl text-xs font-bold text-white font-sukhumvit flex items-center gap-1.5"
          style={{ background: '#3b82f6', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
        >
          <Plus size={13} /> สร้างภาระงาน
        </motion.button>
      </motion.div>

      {/* ── Assignment List ── */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-3">
        <AnimatePresence>
          {filtered.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center text-slate-400">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-sukhumvit">ยังไม่มีภาระงาน</p>
              </div>
            </div>
          )}
          {filtered.map((a, i) => {
            const cfg = TYPE_CONFIG[a.type];
            const subs = getSubmissionsForAssignment(a.id);
            const graded = subs.filter(s => s.score !== undefined).length;
            const isPast = a.dueDate < new Date().toISOString().slice(0, 10);

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-[1.5rem] p-4 flex items-start gap-3"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(255,255,255,1)',
                  boxShadow: '0 4px 15px -3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Type badge */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: cfg.bg }}>
                  <ClipboardList size={14} style={{ color: cfg.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400 font-sarabun">{a.subjectName} · {a.className}</span>
                  </div>
                  <p className="text-[13px] font-black text-slate-800 font-sukhumvit leading-tight">{a.title}</p>
                  {a.description && (
                    <p className="text-[10px] text-slate-500 font-sarabun mt-0.5 line-clamp-1">{a.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                      <Calendar size={10} />
                      ส่ง {a.dueDate} {isPast && <span className="text-rose-500 ml-1">เลยกำหนด</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                      <Star size={10} /> {a.maxScore} คะแนน
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                      <Users size={10} /> ให้คะแนนแล้ว {graded}/{subs.length}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => openScoring(a)}
                    className="h-7 px-3 rounded-lg text-[10px] font-bold font-sukhumvit text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                    ให้คะแนน
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => openEdit(a)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <Pencil size={12} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => onDeleteAssignment(a.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors">
                    <Trash2 size={12} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Create/Edit Modal ── */}
      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editTarget ? 'แก้ไขภาระงาน' : 'สร้างภาระงานใหม่'}
        icon={<ClipboardList size={16} />}
        onSubmit={handleSubmit}
        submitLabel={editTarget ? 'บันทึกการแก้ไข' : 'สร้างภาระงาน'}
        onDelete={editTarget ? () => { onDeleteAssignment(editTarget.id); setIsModalOpen(false); } : undefined}
        maxWidth="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ชื่อภาระงาน <span className="text-rose-400">*</span></label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="เช่น แบบฝึกหัดบทที่ 3"
              className="h-10 rounded-3xl border text-xs font-medium shadow-none font-sarabun"
              style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ประเภท</label>
              <div className="relative">
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AssignmentType }))}
                  className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(200,180,255,0.4)' }}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">คะแนนเต็ม</label>
              <Input type="number" value={form.maxScore} onChange={e => setForm(p => ({ ...p, maxScore: Number(e.target.value) }))}
                className="h-10 rounded-3xl border text-xs font-medium shadow-none font-sarabun"
                style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">วิชา</label>
              <div className="relative">
                <select value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))}
                  className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(200,180,255,0.4)' }}>
                  {mySubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ห้องเรียน</label>
              <div className="relative">
                <select value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value }))}
                  className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(200,180,255,0.4)' }}>
                  {sortedClasses.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">กำหนดส่ง</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="h-10 rounded-3xl px-3 text-xs font-medium font-sarabun outline-none border"
              style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">คำอธิบาย</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="รายละเอียดเพิ่มเติม..."
              className="rounded-3xl border text-xs font-medium shadow-none font-sarabun resize-none"
              style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
              rows={3} />
          </div>
        </div>
      </FormModal>

      {/* ── Scoring Sheet Modal ── */}
      <AnimatePresence>
        {scoringFor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setScoringFor(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-[2.5rem] p-6 flex flex-col gap-4 max-h-[80vh]"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 32px 80px rgba(0,0,0,0.12)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center">
                  <Star size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-[15px] font-black text-slate-800 font-sukhumvit">{scoringFor.title}</p>
                  <p className="text-[11px] text-slate-400 font-sarabun">เต็ม {scoringFor.maxScore} คะแนน · {scoringFor.className}</p>
                </div>
                <button onClick={() => setScoringFor(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-xs font-sukhumvit">ปิด</button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-2">
                {getSubmissionsForAssignment(scoringFor.id).map((sub, i) => (
                  <motion.div key={sub.studentId}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-[1.5rem]"
                    style={{ background: 'rgba(241,245,249,0.8)' }}
                  >
                    <span className="text-[11px] font-bold text-slate-400 font-sukhumvit w-5">{i + 1}</span>
                    
                    <StudentAvatar 
                      photoURL={sub.photoURL}
                      studentId={sub.studentId}
                      name={sub.studentName}
                      gender={sub.gender}
                      className="w-8 h-8 rounded-xl"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 font-sukhumvit truncate">{sub.studentName}</p>
                      <p className="text-[10px] text-slate-400 font-sarabun">{sub.studentCode}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number" min={0} max={scoringFor.maxScore}
                        value={localScores[sub.studentId] ?? ''}
                        onChange={e => setLocalScores(p => ({ ...p, [sub.studentId]: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder="—"
                        className="w-14 h-8 rounded-2xl text-center text-xs font-bold font-sukhumvit outline-none border"
                        style={{ background: 'rgba(255,255,255,0.8)', borderColor: 'rgba(200,180,255,0.4)' }}
                      />
                      <span className="text-[10px] text-slate-400 font-sarabun">/{scoringFor.maxScore}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleSaveScores} disabled={saving}
                className="w-full h-11 rounded-2xl text-sm font-bold text-white font-sukhumvit flex items-center justify-center gap-2"
                style={{ background: '#3b82f6', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'บันทึกคะแนน'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
