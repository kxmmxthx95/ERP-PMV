import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentAvatar from '@/features/students/components/StudentAvatar';

import { Plus, GraduationCap, Pencil, Trash2, ChevronDown, Star, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { GLASS } from '@/components/layouts/PortalLayout';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui/input';
import type { Exam, NewExam, ExamScore, ExamType, ExamStatus } from '@/types/teaching';
import type { ClassRoom } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Subject } from '@/types/curriculum';

// ── Config ─────────────────────────────────────────────────────────────────────

interface ExamPanelProps {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  exams: Exam[];
  getScoresForExam: (id: string) => ExamScore[];
  onCreateExam: (data: NewExam) => Promise<string>;
  onUpdateExam: (id: string, data: Partial<Exam>) => Promise<void>;
  onDeleteExam: (id: string) => Promise<void>;
  onInitExamScores: (examId: string, classId: string) => Promise<void>;
  onSaveExamScore: (score: ExamScore) => Promise<void>;
}

const TYPE_CONFIG: Record<ExamType, { label: string; color: string; bg: string }> = {
  midterm: { label: 'สอบกลางภาค', color: '#e11d48', bg: '#ffe4e6' },
  final: { label: 'สอบปลายภาค', color: '#7c3aed', bg: '#f3e8ff' },
  quiz: { label: 'ทดสอบย่อย', color: '#d97706', bg: '#fef3c7' },
  makeup: { label: 'สอบแก้ตัว', color: '#059669', bg: '#d1fae5' },
};

const STATUS_CONFIG: Record<ExamStatus, { label: string; color: string }> = {
  scheduled: { label: 'กำหนดการ', color: '#2563eb' },
  completed: { label: 'เสร็จสิ้น', color: '#059669' },
  cancelled: { label: 'ยกเลิก', color: '#94a3b8' },
};

const EMPTY_FORM: Omit<NewExam, 'teacherId' | 'academicYearId' | 'semester' | 'departmentId'> = {
  title: '',
  type: 'quiz',
  subjectId: '',
  subjectName: '',
  classId: '',
  className: '',
  examDate: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '11:00',
  room: '',
  maxScore: 100,
  status: 'scheduled',
};

const EXAMS_PER_PAGE = 8;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExamPanel({
  teacherId, academicYearId, semester,
  mySubjects, classes, exams,
  getScoresForExam,
  onCreateExam, onUpdateExam, onDeleteExam,
  onInitExamScores, onSaveExamScore,
}: ExamPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exam | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [scoringFor, setScoringFor] = useState<Exam | null>(null);
  const [localScores, setLocalScores] = useState<Record<string, { score: number | ''; absent: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<ExamType | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM, subjectId: mySubjects[0]?.id ?? '', subjectName: mySubjects[0]?.name ?? '',
      classId: classes[0]?.id ?? '', className: classes[0]?.className ?? ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (e: Exam) => {
    setEditTarget(e);
    setForm({
      title: e.title, type: e.type, subjectId: e.subjectId, subjectName: e.subjectName,
      classId: e.classId, className: e.className, examDate: e.examDate, startTime: e.startTime,
      endTime: e.endTime, room: e.room ?? '', maxScore: e.maxScore, status: e.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const subject = mySubjects.find(s => s.id === form.subjectId);
    const cls = classes.find(c => c.id === form.classId);
    const payload: NewExam = {
      ...form,
      subjectName: subject?.name ?? form.subjectName,
      className: cls?.className ?? form.className,
      departmentId: (cls?.departmentId ?? 'secondary') as import('@/types/curriculum').Department,
      teacherId, academicYearId, semester,
    };
    if (editTarget) {
      await onUpdateExam(editTarget.id, payload);
    } else {
      await onCreateExam(payload);
    }
    setIsModalOpen(false);
  };

  const openScoring = async (exam: Exam) => {
    setScoringFor(exam);
    await onInitExamScores(exam.id, exam.classId);
    const scores = getScoresForExam(exam.id);
    const map: Record<string, { score: number | ''; absent: boolean }> = {};
    scores.forEach(s => { map[s.studentId] = { score: s.score ?? '', absent: s.absent }; });
    setLocalScores(map);
  };

  const handleSaveScores = async () => {
    if (!scoringFor) return;
    setSaving(true);
    const scores = getScoresForExam(scoringFor.id);
    await Promise.all(scores.map(s => {
      const local = localScores[s.studentId];
      return onSaveExamScore({
        ...s,
        score: local?.score === '' ? undefined : Number(local?.score),
        absent: local?.absent ?? false,
      });
    }));
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

  const filtered = filterType ? exams.filter(e => e.type === filterType) : exams;
  const filteredWithoutImages = useMemo(() => {
    return filtered.filter((exam) => {
      const examAny = exam as unknown as {
        coverImage?: string;
        imageUrl?: string;
        photoURL?: string;
        images?: string[];
      };
      const hasImage =
        Boolean(examAny.coverImage) ||
        Boolean(examAny.imageUrl) ||
        Boolean(examAny.photoURL) ||
        (Array.isArray(examAny.images) && examAny.images.length > 0);
      return !hasImage;
    });
  }, [filtered]);
  const totalPages = Math.max(1, Math.ceil(filteredWithoutImages.length / EXAMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedExams = useMemo(() => {
    const start = (safeCurrentPage - 1) * EXAMS_PER_PAGE;
    return filteredWithoutImages.slice(start, start + EXAMS_PER_PAGE);
  }, [filteredWithoutImages, safeCurrentPage]);
  const today = new Date().toISOString().slice(0, 10);

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
              onClick={() => {
                setFilterType(key as ExamType | '');
                setCurrentPage(1);
              }}
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
          <Plus size={13} /> สร้างการสอบ
        </motion.button>
      </motion.div>

      {/* ── Exam List ── */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-3">
        {filteredWithoutImages.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center text-slate-400">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-sukhumvit">ยังไม่มีการสอบ</p>
            </div>
          </div>
        )}
        {paginatedExams.map((exam, i) => {
          const typeCfg = TYPE_CONFIG[exam.type];
          const statusCfg = STATUS_CONFIG[exam.status];
          const scores = getScoresForExam(exam.id);
          const graded = scores.filter(s => s.score !== undefined).length;
          const isUpcoming = exam.examDate >= today && exam.status === 'scheduled';

          return (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-[1.5rem] p-4 flex items-start gap-3"
              style={{
                background: isUpcoming ? 'rgba(239,246,255,0.95)' : 'rgba(255,255,255,0.92)',
                border: isUpcoming ? '1px solid rgba(147,197,253,0.5)' : '1px solid rgba(255,255,255,1)',
                boxShadow: '0 4px 15px -3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: typeCfg.bg }}>
                <GraduationCap size={14} style={{ color: typeCfg.color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                    style={{ background: typeCfg.bg, color: typeCfg.color }}>{typeCfg.label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                    style={{ color: statusCfg.color }}>● {statusCfg.label}</span>
                  <span className="text-[10px] text-slate-400 font-sarabun">{exam.subjectName} · {exam.className}</span>
                </div>
                <p className="text-[13px] font-black text-slate-800 font-sukhumvit leading-tight">{exam.title}</p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                    <Clock size={10} /> {exam.examDate} · {exam.startTime}–{exam.endTime}
                  </span>
                  {exam.room && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                      <MapPin size={10} /> {exam.room}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sarabun">
                    <Star size={10} /> {exam.maxScore} คะแนน
                  </span>
                  {scores.length > 0 && (
                    <span className="text-[11px] text-slate-500 font-sarabun">
                      ให้คะแนนแล้ว {graded}/{scores.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 shrink-0">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => openScoring(exam)}
                  className="h-7 px-3 rounded-lg text-[10px] font-bold font-sukhumvit text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                  ให้คะแนน
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => openEdit(exam)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <Pencil size={12} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => onDeleteExam(exam.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors">
                  <Trash2 size={12} />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredWithoutImages.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] font-bold text-slate-500 font-sukhumvit px-2">
            หน้า {safeCurrentPage}/{totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage === totalPages}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            title="หน้าถัดไป"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editTarget ? 'แก้ไขการสอบ' : 'สร้างการสอบใหม่'}
        icon={<GraduationCap size={16} />}
        onSubmit={handleSubmit}
        submitLabel={editTarget ? 'บันทึกการแก้ไข' : 'สร้างการสอบ'}
        onDelete={editTarget ? () => { onDeleteExam(editTarget.id); setIsModalOpen(false); } : undefined}
        maxWidth="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ชื่อการสอบ <span className="text-rose-400">*</span></label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="เช่น สอบกลางภาคคณิตศาสตร์"
              className="h-10 rounded-3xl border text-xs font-medium shadow-none font-sarabun"
              style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ประเภท</label>
              <div className="relative">
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ExamType }))}
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

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">วันที่สอบ</label>
              <input type="date" value={form.examDate} onChange={e => setForm(p => ({ ...p, examDate: e.target.value }))}
                className="h-10 rounded-3xl px-3 text-xs font-medium font-sarabun outline-none border"
                style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">เริ่ม</label>
              <input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                className="h-10 rounded-3xl px-3 text-xs font-medium font-sarabun outline-none border"
                style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">สิ้นสุด</label>
              <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                className="h-10 rounded-3xl px-3 text-xs font-medium font-sarabun outline-none border"
                style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ห้องสอบ</label>
            <Input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
              placeholder="เช่น ห้อง 201"
              className="h-10 rounded-3xl border text-xs font-medium shadow-none font-sarabun"
              style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">สถานะ</label>
            <div className="relative">
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ExamStatus }))}
                className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(200,180,255,0.4)' }}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
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
                  <GraduationCap size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-[15px] font-black text-slate-800 font-sukhumvit">{scoringFor.title}</p>
                  <p className="text-[11px] text-slate-400 font-sarabun">เต็ม {scoringFor.maxScore} คะแนน · {scoringFor.className}</p>
                </div>
                <button onClick={() => setScoringFor(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-xs font-sukhumvit">ปิด</button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-2">
                {getScoresForExam(scoringFor.id).map((sc, i) => (
                  <motion.div key={sc.studentId}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-[1.5rem]"
                    style={{ background: localScores[sc.studentId]?.absent ? 'rgba(255,228,230,0.6)' : 'rgba(241,245,249,0.8)' }}
                  >
                    <span className="text-[11px] font-bold text-slate-400 font-sukhumvit w-5">{i + 1}</span>
                    
                    <StudentAvatar 
                      photoURL={sc.photoURL}
                      studentId={sc.studentId}
                      name={sc.studentName}
                      gender={sc.gender}
                      className="w-8 h-8 rounded-xl"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 font-sukhumvit truncate">{sc.studentName}</p>
                      <p className="text-[10px] text-slate-400 font-sarabun">{sc.studentCode}</p>
                    </div>
                    {/* Absent toggle */}
                    <button
                      onClick={() => setLocalScores(p => ({ ...p, [sc.studentId]: { ...p[sc.studentId], absent: !p[sc.studentId]?.absent } }))}
                      className="text-[10px] font-bold font-sukhumvit px-2 py-1 rounded-lg transition-all"
                      style={{
                        background: localScores[sc.studentId]?.absent ? '#e11d48' : 'rgba(241,245,249,0.8)',
                        color: localScores[sc.studentId]?.absent ? '#fff' : '#94a3b8',
                      }}
                    >ขาดสอบ</button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number" min={0} max={scoringFor.maxScore}
                        value={localScores[sc.studentId]?.score ?? ''}
                        disabled={localScores[sc.studentId]?.absent}
                        onChange={e => setLocalScores(p => ({ ...p, [sc.studentId]: { ...p[sc.studentId], score: e.target.value === '' ? '' : Number(e.target.value) } }))}
                        placeholder="—"
                        className="w-14 h-8 rounded-2xl text-center text-xs font-bold font-sukhumvit outline-none border disabled:opacity-40"
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
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'บันทึกคะแนนสอบ'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
