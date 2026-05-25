import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, UserCheck, UserX, Clock, FileCheck, CheckSquare, Save, BookOpen } from 'lucide-react';
import { GLASS } from '@/components/layouts/PortalLayout';
import type { AttendanceStatus, AttendanceRecord, NewAttendanceRecord } from '@/types/teaching';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';

interface StudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  status: AttendanceStatus;
  note: string;
}

interface Props {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  attendance: AttendanceRecord[];
  getStudentsForClass: (classId: string) => { student: { id: string; studentCode: string; prefix: string; firstName: string; lastName: string } }[];
  getAttendanceForSession: (subjectId: string, classId: string, date: string, period: number) => AttendanceRecord[];
  onSave: (records: NewAttendanceRecord[]) => Promise<void>;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: typeof UserCheck }> = {
  present:  { label: 'มาเรียน',      color: '#059669', bg: '#d1fae5', icon: UserCheck },
  absent:   { label: 'ขาดเรียน',     color: '#e11d48', bg: '#ffe4e6', icon: UserX },
  late:     { label: 'สาย',          color: '#d97706', bg: '#fef3c7', icon: Clock },
  excused:  { label: 'ลากิจ/ป่วย',  color: '#2563eb', bg: '#dbeafe', icon: FileCheck },
  leave:    { label: 'ลา (ทางการ)',  color: '#7c3aed', bg: '#f3e8ff', icon: CheckSquare },
};

const PERIODS = Array.from({ length: 9 }, (_, i) => i + 1);

export default function HistoryTab({
  teacherId, academicYearId, semester,
  mySubjects, classes, attendance,
  getStudentsForClass, getAttendanceForSession, onSave,
}: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(mySubjects[0]?.id ?? '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Collect unique past dates that have records for selected subject+class
  const pastDates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = new Set<string>();
    attendance.forEach(r => {
      if (r.subjectId === selectedSubjectId && r.classId === selectedClassId && r.date < today) {
        dates.add(r.date);
      }
    });
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [attendance, selectedSubjectId, selectedClassId]);

  const selectedSubject = mySubjects.find(s => s.id === selectedSubjectId);
  const selectedClass = classes.find(c => c.id === selectedClassId);

  const loadSession = () => {
    if (!selectedDate) return;
    const students = getStudentsForClass(selectedClassId);
    const existing = getAttendanceForSession(selectedSubjectId, selectedClassId, selectedDate, selectedPeriod);
    const existingMap = new Map(existing.map(r => [r.studentId, r]));
    setRows(students.map(({ student }) => ({
      studentId: student.id,
      studentCode: student.studentCode,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      status: existingMap.get(student.id)?.status ?? 'present',
      note: existingMap.get(student.id)?.note ?? '',
    })));
    setSaved(false);
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, status } : r));
    setSaved(false);
  };

  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    await onSave(rows.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      studentCode: r.studentCode,
      subjectId: selectedSubjectId,
      subjectName: selectedSubject?.name ?? '',
      classId: selectedClassId,
      className: selectedClass?.className ?? '',
      teacherId,
      departmentId: (selectedClass?.departmentId ?? 'secondary') as import('@/types/curriculum').Department,
      academicYearId,
      semester,
      date: selectedDate,
      period: selectedPeriod,
      status: r.status,
      note: r.note,
    })));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] p-5 flex flex-wrap gap-4 items-end"
        style={{ ...GLASS, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
      >
        {/* Subject */}
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">วิชา</label>
          <div className="relative">
            <select value={selectedSubjectId} onChange={e => { setSelectedSubjectId(e.target.value); setRows([]); setSelectedDate(''); }}
              className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              {mySubjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Class */}
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ห้องเรียน</label>
          <div className="relative">
            <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setRows([]); setSelectedDate(''); }}
              className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Date (past dates with records) */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">วันที่ย้อนหลัง</label>
          <div className="relative">
            <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setRows([]); }}
              className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              <option value="">— เลือกวันที่ —</option>
              {pastDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Period */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">คาบ</label>
          <div className="relative">
            <select value={selectedPeriod} onChange={e => { setSelectedPeriod(Number(e.target.value)); setRows([]); }}
              className="h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              {PERIODS.map(p => <option key={p} value={p}>คาบที่ {p}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={loadSession} disabled={!selectedDate}
          className="h-10 px-5 rounded-xl text-xs font-bold text-white font-sukhumvit disabled:opacity-40"
          style={{ background: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
          <BookOpen size={13} className="inline mr-1.5" />
          โหลดรายชื่อ
        </motion.button>
      </motion.div>

      {/* Student List */}
      <AnimatePresence>
        {rows.length > 0 && (
          <motion.div key="history-sheet"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold font-sukhumvit"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  <cfg.icon size={11} />
                  {cfg.label}: {rows.filter(r => r.status === key).length}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-2">
              {rows.map((row, i) => (
                <motion.div key={row.studentId}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="rounded-2xl px-3 py-2 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,1)', boxShadow: '0 3px 12px -3px rgba(0,0,0,0.04)' }}>
                  <span className="text-[10px] font-bold text-slate-400 font-sukhumvit w-5 text-center shrink-0">{i + 1}</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-[12px] font-black text-slate-800 font-sukhumvit truncate">{row.studentName}</p>
                    <p className="text-[9px] text-slate-400 font-sarabun">{row.studentCode}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([key, cfg]) => {
                      const isActive = row.status === key;
                      return (
                        <motion.button key={key}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setStatus(row.studentId, key)}
                          className="px-2 py-0.5 rounded-lg text-[9px] font-bold font-sukhumvit transition-all"
                          style={{
                            background: isActive ? cfg.color : 'rgba(241,245,249,0.8)',
                            color: isActive ? '#fff' : '#94a3b8',
                            boxShadow: isActive ? `0 3px 8px -2px ${cfg.color}55` : 'none',
                          }}>
                          {cfg.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={handleSave} disabled={saving}
              className="w-full h-12 rounded-2xl text-sm font-bold text-white font-sukhumvit flex items-center justify-center gap-2"
              style={{
                background: saved ? '#059669' : '#3b82f6',
                boxShadow: saved ? '0 4px 12px rgba(5,150,105,0.3)' : '0 4px 12px rgba(59,130,246,0.3)',
                transition: 'all 0.3s',
              }}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : saved
                  ? <><CheckSquare size={15} /> บันทึกแล้ว</>
                  : <><Save size={15} /> บันทึกการแก้ไข ({rows.length} คน)</>}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-sukhumvit">เลือกวิชา ห้องเรียน วันที่ และคาบ แล้วกด "โหลดรายชื่อ"</p>
            {pastDates.length === 0 && selectedSubjectId && (
              <p className="text-xs mt-1 text-slate-300 font-sarabun">ยังไม่มีข้อมูลเช็คชื่อย้อนหลังสำหรับวิชานี้</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
