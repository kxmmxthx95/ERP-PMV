import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, MapPin as PinIcon } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import type { SchoolDay } from '@/types/schedule';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function TodayScheduleWidget() {
  const { user } = useAuth();
  const { entries, classes } = useSchedule();
  const { teachers } = useTeacherManager();
  const { year: activeYear, activeSemester } = useActiveAcademicYear();
  const navigate = useNavigate();

  const [autoOpenedId, setAutoOpenedId] = useState<string | null>(null);

  // 1. Find teacher profile linked to current user
  const teacherProfile = useMemo(() => {
    if (!user) return null;
    return teachers.find(t => t.userId === user.uid);
  }, [teachers, user]);

  // 2. Identify today's school day (1=Mon...5=Fri)
  const todayNum = new Date().getDay();
  const schoolDay = (todayNum >= 1 && todayNum <= 5) ? todayNum as SchoolDay : null;
  const dayLabels: Record<number, string> = {
    0: 'อาทิตย์', 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์'
  };

  // 3. Filter entries for this teacher today
  const todaysEntries = useMemo(() => {
    if (!teacherProfile || !schoolDay) return [];
    
    return entries
      .filter(e => 
        e.teacherId === teacherProfile.id && 
        e.day === schoolDay &&
        String(e.year) === String(activeYear || '2568') &&
        e.semester === (activeSemester || 1)
      )
      .sort((a, b) => a.period - b.period);
  }, [entries, teacherProfile, schoolDay, activeYear, activeSemester]);

  // Helper to get class label
  const getClassLabel = (id: string) => classes.find(c => c.id === id)?.label || id;

  // 4. Fetch settings for all involved classes to get correct times
  const [classSettings, setClassSettings] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (todaysEntries.length === 0) return;
    
    const involvedClassIds = [...new Set(todaysEntries.map(e => e.classId))];
    const unsubs = involvedClassIds.map(cid => {
      return onSnapshot(doc(db, 'class_settings', cid), (snap) => {
        if (snap.exists()) {
          setClassSettings(prev => ({ ...prev, [cid]: snap.data() }));
        }
      });
    });
    
    return () => unsubs.forEach(u => u());
  }, [todaysEntries]);

  // 5. Resolve time for a specific entry and check if it's active
  const getSessionStatus = (entry: any) => {
    const settings = classSettings[entry.classId] || DEFAULT_SETTINGS;
    const times = settings.periodTimes || {};
    const pStr = String(entry.period);
    let timeRange = times[pStr];
    
    // Fallback calculation for extended periods
    if (!timeRange && entry.period > (settings.periodCount || 8)) {
      const pCount = settings.periodCount || 8;
      let lastEndMin = 480; 
      for (let i = 1; i <= pCount; i++) {
        const t = times[String(i)];
        if (t && t.includes(' - ')) {
          const parts = t.split(' - ')[1].split(':');
          lastEndMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
      const startMin = lastEndMin + (entry.period - pCount - 1) * 50;
      const endMin = startMin + 50;
      timeRange = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')} - ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    }

    if (!timeRange) return { startTime: '--:--', isActive: false };

    const [startStr, endStr] = timeRange.split(' - ');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;

    return {
      startTime: startStr,
      endTime: endStr,
      isActive: nowMin >= startMin && nowMin < endMin
    };
  };

  // 6. Identify the most relevant session (Active > Next Upcoming)
  const relevantEntry = useMemo(() => {
    if (todaysEntries.length === 0) return null;

    // 1. Check for currently active session
    const active = todaysEntries.find(e => getSessionStatus(e).isActive);
    if (active) return active;

    // 2. Check for next upcoming session
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    return todaysEntries.find(e => {
      const { startTime } = getSessionStatus(e);
      if (startTime === '--:--') return false;
      const [h, m] = startTime.split(':').map(Number);
      return (h * 60 + m) > nowMin;
    });
  }, [todaysEntries, classSettings]);

  // 6. Auto-open attendance modal when a session becomes active
  useEffect(() => {
    if (relevantEntry) {
      const { isActive } = getSessionStatus(relevantEntry);
      // Only auto-navigate if it's active AND we haven't auto-jumped for this specific entry ID yet
      if (isActive && autoOpenedId !== relevantEntry.id) {
        setAutoOpenedId(relevantEntry.id);
        const todayStr = new Date().toISOString().slice(0, 10);
        navigate(`/portal/attendance?subjectId=${relevantEntry.subjectId}&classId=${relevantEntry.classId}&period=${relevantEntry.period}&date=${todayStr}`);
      }
    }
  }, [relevantEntry, autoOpenedId, navigate]);

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 h-full w-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-black text-[13px] text-slate-800 leading-none mb-0.5">ตารางสอนวันนี้</span>
          <span className="text-[10px] text-slate-400 font-medium">วัน{dayLabels[todayNum]}</span>
        </div>
        {todaysEntries.length > 0 && (
          <span className="text-[10px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-lg border border-rose-100">
            {todaysEntries.length} คาบ
          </span>
        )}
      </div>

      {!user ? (
         <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <p className="text-[11px] font-bold text-slate-400 italic">กรุณาเข้าสู่ระบบ</p>
         </div>
      ) : !teacherProfile ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
            <BookOpen size={16} className="text-slate-300" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 px-4">
            ไม่พบโปรไฟล์ครูที่เชื่อมโยงกับบัญชีนี้
          </p>
        </div>
      ) : !schoolDay || todaysEntries.length === 0 || !relevantEntry ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2 animate-in fade-in duration-700">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100/50">
             <Clock size={20} className="text-slate-200" />
          </div>
          <p className="text-[11px] font-black text-slate-300 uppercase tracking-wider italic">
            {!schoolDay ? 'วันนี้เป็นวันหยุด' : !relevantEntry && todaysEntries.length > 0 ? 'สิ้นสุดการสอนของวันนี้แล้ว' : 'ไม่มีตารางสอนในวันนี้'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {(() => {
            const { startTime, isActive } = getSessionStatus(relevantEntry);
            
            return (
              <div 
                onClick={() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  navigate(`/portal/attendance?subjectId=${relevantEntry.subjectId}&classId=${relevantEntry.classId}&period=${relevantEntry.period}&date=${todayStr}`);
                }}
                className={`group relative flex flex-col gap-3 p-4 rounded-2xl transition-all duration-300 cursor-pointer active:scale-[0.99] ${
                  isActive 
                    ? 'bg-white border-2 border-blue-500/20' 
                    : 'bg-white/60 border border-white/40 hover:bg-white'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-blue-500/5 animate-pulse pointer-events-none" />
                )}

                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-colors ${
                    isActive ? 'bg-blue-600 border-blue-400' : 'bg-rose-50 border-rose-200/30'
                  }`}>
                    <span className={`text-[9px] font-black leading-none mb-0.5 uppercase ${isActive ? 'text-blue-100' : 'text-rose-400'}`}>คาบ</span>
                    <span className={`text-sm font-black leading-none ${isActive ? 'text-white' : 'text-rose-600'}`}>{relevantEntry.period}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-black text-slate-800 truncate leading-none">
                        {relevantEntry.subjectName}
                      </span>
                      {isActive ? (
                        <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-full">
                           <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                           <span className="text-[8px] font-black text-blue-600 uppercase">กำลังสอน</span>
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="flex items-center gap-3 text-slate-400">
                       <div className="flex items-center gap-1 min-w-0">
                          <BookOpen size={10} className="shrink-0" />
                          <span className="text-[11px] font-bold truncate">{getClassLabel(relevantEntry.classId)}</span>
                       </div>
                       {relevantEntry.room && (
                          <div className="flex items-center gap-1 min-w-0">
                            <PinIcon size={10} className="shrink-0" />
                            <span className="text-[11px] font-bold truncate">{relevantEntry.room}</span>
                          </div>
                       )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100/50 text-slate-500'
                    }`}>
                      {startTime}
                    </span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase">Start</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    navigate(`/portal/attendance?subjectId=${relevantEntry.subjectId}&classId=${relevantEntry.classId}&period=${relevantEntry.period}&date=${todayStr}`);
                  }}
                  className={`w-full py-3 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                    isActive 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-white animate-pulse' : 'bg-slate-400'
                    }`} />
                  </div>
                  {isActive ? 'เช็กชื่อเข้าเรียนตอนนี้' : 'เตรียมความพร้อมเพื่อเช็กชื่อ'}
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
