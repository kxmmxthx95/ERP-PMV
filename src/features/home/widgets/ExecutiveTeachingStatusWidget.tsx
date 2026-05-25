import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Coffee, Timer } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useSchedule } from '@/hooks/useSchedule';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { DEFAULT_SETTINGS, type ScheduleSettings } from '@/hooks/useScheduleSettings';
import { db } from '@/lib/firebase';
import { WIDGET_GLASS } from '../widgetStyles';

type ClassSettingsMap = Record<string, Partial<ScheduleSettings>>;

type TeacherStatus = {
  teacherId: string;
  teacherName: string;
  detail: string;
};

function parseTimeRange(timeStr: string): { startMin: number; endMin: number } | null {
  const normalized = String(timeStr || '')
    .replace('–', '-')
    .replace(/\s*-\s*/g, '-')
    .trim();
  if (!normalized) return null;
  const [start, end] = normalized.split('-');
  if (!start || !end) return null;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;

  return {
    startMin: sh * 60 + sm,
    endMin: eh * 60 + em,
  };
}

function useNowMinute(tick = 30000) {
  const [nowMinute, setNowMinute] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowMinute(now.getHours() * 60 + now.getMinutes());
    };
    const id = setInterval(update, tick);
    return () => clearInterval(id);
  }, [tick]);

  return nowMinute;
}

export default function ExecutiveTeachingStatusWidget() {
  const { entries, classes } = useSchedule();
  const { year, activeSemester } = useActiveAcademicYear();
  const nowMinute = useNowMinute();
  const [classSettings, setClassSettings] = useState<ClassSettingsMap>({});

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'class_settings'),
      (snap) => {
        const next: ClassSettingsMap = {};
        snap.docs.forEach((docSnap) => {
          next[docSnap.id] = docSnap.data() as Partial<ScheduleSettings>;
        });
        setClassSettings(next);
      },
      () => {
        setClassSettings({});
      },
    );
    return unsub;
  }, []);

  const classNameMap = useMemo(
    () => Object.fromEntries(classes.map((cls) => [cls.id, cls.className || cls.label || cls.id])),
    [classes],
  );

  const todayDay = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  const schoolWideSettings = classSettings.school_wide;

  const getPeriodTime = (classId: string, period: number) => {
    const perClass = classSettings[classId];
    const classValue = perClass?.periodTimes?.[String(period)];
    const schoolValue = schoolWideSettings?.periodTimes?.[String(period)];
    return classValue || schoolValue || DEFAULT_SETTINGS.periodTimes[String(period)] || '';
  };

  const status = useMemo(() => {
    if (todayDay < 1 || todayDay > 5) {
      return {
        teaching: [] as TeacherStatus[],
        resting: [] as TeacherStatus[],
        totalTodayTeachers: 0,
      };
    }

    const todaysEntries = entries.filter(
      (entry) =>
        entry.day === todayDay &&
        String(entry.year) === String(year) &&
        entry.semester === activeSemester,
    );

    const byTeacher = new Map<string, typeof todaysEntries>();
    todaysEntries.forEach((entry) => {
      const list = byTeacher.get(entry.teacherId) ?? [];
      list.push(entry);
      byTeacher.set(entry.teacherId, list);
    });

    const teaching: TeacherStatus[] = [];
    const resting: TeacherStatus[] = [];

    byTeacher.forEach((teacherEntries, teacherId) => {
      const teacherName = teacherEntries[0]?.teacherName || '-';

      const enriched = teacherEntries
        .map((entry) => {
          const range = parseTimeRange(getPeriodTime(entry.classId, entry.period));
          return { entry, range };
        })
        .filter((item): item is { entry: (typeof teacherEntries)[number]; range: { startMin: number; endMin: number } } => Boolean(item.range))
        .sort((a, b) => a.range.startMin - b.range.startMin);

      if (enriched.length === 0) return;

      const current = enriched.find(({ range }) => nowMinute >= range.startMin && nowMinute < range.endMin);
      if (current) {
        teaching.push({
          teacherId,
          teacherName,
          detail: `${current.entry.subjectCode} ${current.entry.subjectName} · ห้อง ${classNameMap[current.entry.classId] || current.entry.classId}`,
        });
        return;
      }

      const firstStart = enriched[0].range.startMin;
      const lastEnd = enriched[enriched.length - 1].range.endMin;
      if (nowMinute >= firstStart && nowMinute < lastEnd) {
        const nextClass = enriched.find(({ range }) => range.startMin > nowMinute);
        resting.push({
          teacherId,
          teacherName,
          detail: nextClass
            ? `พัก/ว่าง · คาบถัดไป ${nextClass.entry.subjectCode} (${classNameMap[nextClass.entry.classId] || nextClass.entry.classId})`
            : 'พัก/ว่าง · ไม่มีคาบถัดไปวันนี้',
        });
      }
    });

    teaching.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));
    resting.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));

    return {
      teaching,
      resting,
      totalTodayTeachers: byTeacher.size,
    };
  }, [activeSemester, classNameMap, entries, nowMinute, todayDay, year]);

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full">
      <div>
        <p className="font-bold text-sm text-slate-700">สถานะครูตามตารางสอน</p>
        <p className="text-[10px] text-slate-400">
          วันนี้: สอน <span className="font-black text-emerald-600">{status.teaching.length}</span> · พัก{' '}
          <span className="font-black text-amber-600">{status.resting.length}</span> · รวม {status.totalTodayTeachers} คน
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-emerald-700">
          <BookOpen size={13} />
          <p className="text-[11px] font-black">กำลังสอน</p>
        </div>
        <div className="space-y-1.5">
          {status.teaching.length === 0 ? (
            <p className="text-[10px] font-medium text-slate-500">ไม่มีครูที่อยู่ในคาบสอนตอนนี้</p>
          ) : (
            status.teaching.slice(0, 4).map((teacher) => (
              <div key={`teach-${teacher.teacherId}`} className="rounded-xl bg-white/70 px-2.5 py-2">
                <p className="text-[11px] font-bold text-slate-700">{teacher.teacherName}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{teacher.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-amber-700">
          <Coffee size={13} />
          <p className="text-[11px] font-black">กำลังพัก/ว่าง</p>
        </div>
        <div className="space-y-1.5">
          {status.resting.length === 0 ? (
            <p className="text-[10px] font-medium text-slate-500">ไม่มีครูที่อยู่ในช่วงพักตอนนี้</p>
          ) : (
            status.resting.slice(0, 4).map((teacher) => (
              <div key={`rest-${teacher.teacherId}`} className="rounded-xl bg-white/70 px-2.5 py-2">
                <p className="text-[11px] font-bold text-slate-700">{teacher.teacherName}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{teacher.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
        <Timer size={11} />
        <span>อัปเดตทุก 30 วินาที</span>
      </div>
    </div>
  );
}
