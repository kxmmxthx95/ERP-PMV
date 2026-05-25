import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserCheck, Bell, Check } from 'lucide-react';
import { useDailySchedules } from '@/hooks/useDailySchedules';
import { subjectColorByName } from '../constants/colors';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';
import type { TeacherProfile } from '@/types/teacher';

interface SubstitutionModalProps {
  open: boolean;
  entry: ScheduleEntry | null;
  date: string;
  day: SchoolDay;
  period: number;
  allTeachers: TeacherProfile[];
  busyTeacherIds: string[];
  academicYearId: string;
  semester: 1 | 2;
  currentUserId: string;
  onClose: () => void;
}

export default function SubstitutionModal({
  open,
  entry,
  date,
  day,
  period,
  allTeachers,
  busyTeacherIds,
  academicYearId,
  semester,
  currentUserId,
  onClose,
}: SubstitutionModalProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendNotif, setSendNotif] = useState(true);

  const { addSubstitution } = useDailySchedules(academicYearId, semester);

  const availableTeachers = allTeachers.filter(t =>
    !busyTeacherIds.includes(t.id) && t.id !== entry?.teacherId,
  );

  const filtered = availableTeachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (!entry || !selectedId) return;
    const sub = allTeachers.find(t => t.id === selectedId);
    if (!sub) return;

    setSaving(true);
    try {
      await addSubstitution({
        date,
        dayOfWeek: day,
        period,
        classId: entry.classId,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        subjectCode: entry.subjectCode,
        originalTeacherId: entry.teacherId,
        originalTeacherName: entry.teacherName,
        substituteTeacherId: sub.id,
        substituteTeacherName: sub.name,
        reason,
        academicYearId,
        semester,
        createdBy: currentUserId,
      });

      if (sendNotif) {
        // FCM notification via Firestore trigger (Cloud Function picks up new docs in notifications collection)
        const { collection: col, addDoc: aDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await aDoc(col(db, 'notifications'), {
          title: 'แจ้งเตือนการสอนแทน',
          body: `${sub.name} สอนแทน ${entry.subjectName} คาบที่ ${period} วันที่ ${date}`,
          type: 'announcement',
          targetRoles: ['teacher', 'admin'],
          targetUIDs: [entry.teacherId, sub.id],
          createdBy: currentUserId,
          createdAt: Timestamp.now(),
          readBy: [],
        });
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSaving(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const color = entry ? subjectColorByName(entry.subjectName || '', entry.subjectGroup) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
            style={{
              maxHeight: '80vh',
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.90)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.20)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4 shrink-0"
              style={{ background: color?.bg, borderBottom: `1.5px solid ${color?.border ?? 'rgba(0,0,0,0.06)'}` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className="inline-block px-2.5 py-1 rounded-xl text-[10px] font-black mb-2"
                    style={{ background: 'rgba(255,255,255,0.70)', color: color?.text }}
                  >
                    สอนแทน
                  </span>
                  <h2 className="text-[14px] font-black text-black/80 leading-snug">
                    {entry?.subjectName}
                    <span className="ml-2 text-[11px] font-bold text-black/40">
                      คาบ {period} · {date}
                    </span>
                  </h2>
                  <p className="text-[10px] text-black/40 mt-0.5">
                    ครูเดิม: {entry?.teacherName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-black/[0.06]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <Search size={12} className="text-black/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาครูที่ว่าง..."
                  className="flex-1 bg-transparent text-[11px] text-black/70 placeholder:text-black/25 outline-none"
                />
              </div>
              <p className="text-[9px] text-black/30 mt-1.5 font-bold">
                ครูที่ว่างในคาบนี้ — {filtered.length} คน
              </p>
            </div>

            {/* Teacher list */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1.5 scrollbar-hide">
              {filtered.map(t => {
                const active = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all text-left ${
                      active
                        ? 'bg-indigo-500 border-indigo-400 shadow-md shadow-indigo-200/50'
                        : 'bg-white/70 border-black/[0.06] hover:bg-white hover:border-black/10'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0"
                      style={active
                        ? { background: 'rgba(255,255,255,0.20)', color: 'white' }
                        : { background: 'rgba(99,102,241,0.12)', color: '#4338ca' }
                      }
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${active ? 'text-white' : 'text-black/75'}`}>
                        {t.name}
                      </p>
                      {t.position && (
                        <p className={`text-[9px] ${active ? 'text-white/60' : 'text-black/35'}`}>
                          {t.position}
                        </p>
                      )}
                    </div>
                    {active && <UserCheck size={14} className="text-white/80 shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[10px] text-black/25 italic">ไม่พบครูที่ว่าง</p>
                </div>
              )}
            </div>

            {/* Reason + Notification toggle + Save */}
            <div
              className="px-4 pb-5 pt-3 space-y-2 shrink-0"
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
            >
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="เหตุผล (เช่น ลาป่วย, ธุรกิจ...)"
                className="w-full px-3 py-2 rounded-xl text-[11px] text-black/70 placeholder:text-black/25 outline-none"
                style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setSendNotif(v => !v)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${sendNotif ? 'bg-indigo-500' : 'bg-black/15'}`}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                    style={{ left: sendNotif ? '17px' : '2px' }}
                  />
                </div>
                <Bell size={11} className={sendNotif ? 'text-indigo-500' : 'text-black/25'} />
                <span className="text-[10px] font-bold text-black/45">
                  ส่ง Push Notification แจ้งครู
                </span>
              </label>

              <button
                onClick={handleSave}
                disabled={!selectedId || saving}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[12px] transition-all ${
                  saved
                    ? 'bg-emerald-500 text-white'
                    : selectedId
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-200/60'
                    : 'bg-black/[0.06] text-black/25 cursor-not-allowed'
                }`}
              >
                {saved ? (
                  <><Check size={14} /> บันทึกสำเร็จ</>
                ) : saving ? (
                  <span className="animate-pulse">กำลังบันทึก...</span>
                ) : (
                  'ยืนยันการสอนแทน'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
