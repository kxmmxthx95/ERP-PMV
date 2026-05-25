import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, BarChart2 } from 'lucide-react';
import { GLASS } from '@/components/layouts/PortalLayout';
import type { AttendanceStatus, AttendanceRecord } from '@/types/teaching';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';

interface Props {
  mySubjects: Subject[];
  classes: ClassRoom[];
  attendance: AttendanceRecord[];
  getStudentsForClass: (classId: string) => { student: { id: string; studentCode: string; prefix: string; firstName: string; lastName: string } }[];
}

const DOT: Record<AttendanceStatus, { bg: string; label: string }> = {
  present: { bg: '#10b981', label: 'มา' },
  absent:  { bg: '#e11d48', label: 'ขาด' },
  late:    { bg: '#f59e0b', label: 'สาย' },
  excused: { bg: '#3b82f6', label: 'ลากิจ' },
  leave:   { bg: '#8b5cf6', label: 'ลา' },
};

export default function SummaryTab({ mySubjects, classes, attendance, getStudentsForClass }: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(mySubjects[0]?.id ?? '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  // All sessions (unique date+period combos) for selected subject+class
  const sessions = useMemo(() => {
    const seen = new Map<string, { date: string; period: number }>();
    attendance.forEach(r => {
      if (r.subjectId === selectedSubjectId && r.classId === selectedClassId) {
        const key = `${r.date}|${r.period}`;
        if (!seen.has(key)) seen.set(key, { date: r.date, period: r.period });
      }
    });
    return [...seen.values()].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.period - b.period
    );
  }, [attendance, selectedSubjectId, selectedClassId]);

  // Students in this class
  const students = useMemo(
    () => getStudentsForClass(selectedClassId),
    [getStudentsForClass, selectedClassId],
  );

  // Build attendance map: studentId → (date|period → status)
  const attendanceMap = useMemo(() => {
    const m = new Map<string, Map<string, AttendanceStatus>>();
    attendance.forEach(r => {
      if (r.subjectId === selectedSubjectId && r.classId === selectedClassId) {
        if (!m.has(r.studentId)) m.set(r.studentId, new Map());
        m.get(r.studentId)!.set(`${r.date}|${r.period}`, r.status);
      }
    });
    return m;
  }, [attendance, selectedSubjectId, selectedClassId]);

  const totalSessions = sessions.length;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] p-5 flex flex-wrap gap-4 items-end"
        style={{ ...GLASS, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">วิชา</label>
          <div className="relative">
            <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              {mySubjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">ห้องเรียน</label>
          <div className="relative">
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
              className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {(Object.entries(DOT) as [AttendanceStatus, typeof DOT[AttendanceStatus]][]).map(([key, d]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: d.bg }} />
              <span className="text-[10px] font-bold text-slate-500 font-sukhumvit">{d.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      {students.length === 0 || totalSessions === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-sukhumvit">
              {students.length === 0 ? 'ยังไม่มีนักเรียนในห้องนี้' : 'ยังไม่มีข้อมูลเช็คชื่อสำหรับวิชานี้'}
            </p>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex-1 min-h-0 overflow-auto rounded-[2rem]"
          style={{ ...GLASS, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
          <table className="w-full text-[10px] font-sukhumvit border-collapse" style={{ minWidth: `${300 + sessions.length * 44}px` }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white/80 backdrop-blur-sm text-left px-4 py-3 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 min-w-[180px]">
                  นักเรียน
                </th>
                {sessions.map(s => (
                  <th key={`${s.date}|${s.period}`}
                    className="px-2 py-3 text-center text-[9px] font-bold text-slate-500 border-b border-slate-100 whitespace-nowrap"
                    style={{ minWidth: 40 }}>
                    <div>{s.date.slice(5)}</div>
                    <div className="text-slate-300">ค.{s.period}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-600 border-b border-slate-100 sticky right-0 bg-white/80 backdrop-blur-sm">
                  % เวลาเรียน
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map(({ student }, i) => {
                const sMap = attendanceMap.get(student.id) ?? new Map<string, AttendanceStatus>();
                const presentCount = sessions.filter(s => {
                  const st = sMap.get(`${s.date}|${s.period}`);
                  return st === 'present' || st === 'late';
                }).length;
                const pct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
                const pctColor = pct >= 80 ? '#059669' : pct >= 60 ? '#f59e0b' : '#e11d48';

                return (
                  <tr key={student.id}
                    className={i % 2 === 0 ? 'bg-white/30' : 'bg-white/10'}
                    style={{ transition: 'background 0.15s' }}>
                    <td className="sticky left-0 z-10 px-4 py-2.5 border-b border-slate-50"
                      style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)' }}>
                      <div className="font-bold text-slate-800 truncate max-w-[160px]">
                        {student.prefix}{student.firstName} {student.lastName}
                      </div>
                      <div className="text-slate-400 text-[9px]">{student.studentCode}</div>
                    </td>
                    {sessions.map(s => {
                      const key = `${s.date}|${s.period}`;
                      const status = sMap.get(key);
                      const dot = status ? DOT[status] : null;
                      return (
                        <td key={key} className="px-2 py-2.5 text-center border-b border-slate-50">
                          {dot
                            ? <div className="w-3 h-3 rounded-full mx-auto" style={{ background: dot.bg }} title={dot.label} />
                            : <div className="w-3 h-3 rounded-full mx-auto bg-slate-100" title="ไม่มีข้อมูล" />}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center border-b border-slate-50 sticky right-0"
                      style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)' }}>
                      <div className="font-black text-[12px]" style={{ color: pctColor }}>{pct}%</div>
                      <div className="text-slate-300 text-[9px]">{presentCount}/{totalSessions}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
