import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ScheduleSettings {
  periodCount: number;
  breakPeriods: number[];   // คาบพักเบรกสั้น
  lunchPeriods: number[];   // คาบพักกลางวัน
  periodTimes: Record<string, string>; // key เป็น string ใน Firestore
}

export const DEFAULT_SETTINGS: ScheduleSettings = {
  periodCount: 8,
  breakPeriods: [],
  lunchPeriods: [6],
  periodTimes: {
    '1': '08:00 - 08:50',
    '2': '08:50 - 09:40',
    '3': '09:40 - 10:30',
    '4': '10:30 - 11:20',
    '5': '11:20 - 12:10',
    '6': '12:10 - 13:00',
    '7': '13:00 - 13:50',
    '8': '13:50 - 14:40',
  },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseEndTime(timeStr: string): { h: number; m: number } | null {
  const parts = timeStr.split(' - ');
  if (parts.length < 2) return null;
  const [h, m] = parts[1].split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
}

export function useScheduleSettings(classId?: string) {
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ref เพื่อป้องกัน stale closure ตอน save
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    const targetId = classId || 'school_wide';
    setLoading(true);

    const ref = doc(db, 'class_settings', targetId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<ScheduleSettings> & { breakPeriods?: number[] };
        const hasLunch = Array.isArray(data.lunchPeriods);
        setSettings({
          periodCount: data.periodCount ?? DEFAULT_SETTINGS.periodCount,
          lunchPeriods: hasLunch ? data.lunchPeriods! : (data.breakPeriods ?? DEFAULT_SETTINGS.lunchPeriods),
          breakPeriods: hasLunch ? (data.breakPeriods ?? []) : [],
          periodTimes: data.periodTimes ?? DEFAULT_SETTINGS.periodTimes,
        });
        setLoading(false);
      } else if (classId) {
        // If class settings missing, try fallback to school_wide (one-time fetch)
        const schoolRef = doc(db, 'class_settings', 'school_wide');
        getDoc(schoolRef).then((schoolSnap) => {
          if (schoolSnap.exists()) {
            const data = schoolSnap.data() as Partial<ScheduleSettings> & { breakPeriods?: number[] };
            const hasLunch = Array.isArray(data.lunchPeriods);
            setSettings({
              periodCount: data.periodCount ?? DEFAULT_SETTINGS.periodCount,
              lunchPeriods: hasLunch ? data.lunchPeriods! : (data.breakPeriods ?? DEFAULT_SETTINGS.lunchPeriods),
              breakPeriods: hasLunch ? (data.breakPeriods ?? []) : [],
              periodTimes: data.periodTimes ?? DEFAULT_SETTINGS.periodTimes,
            });
          } else {
            setSettings(DEFAULT_SETTINGS);
          }
          setLoading(false);
        }).catch(() => {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    });

    return unsub;
  }, [classId]);

  // ── บันทึกลง Firestore ────────────────────────────────────────────────────
  const persist = async (patch: Partial<ScheduleSettings>) => {
    const targetId = classId || 'school_wide';
    const next = { ...settingsRef.current, ...patch };
    setSettings(next); // optimistic update
    await setDoc(doc(db, 'class_settings', targetId), next, { merge: true });
  };

  // ── เพิ่มคาบท้ายสุด ──────────────────────────────────────────────────────
  const addPeriod = () => {
    const s = settingsRef.current;
    const newIdx = s.periodCount + 1;
    const prevTime = s.periodTimes[String(s.periodCount)];
    let newTime = '';
    if (prevTime) {
      const end = parseEndTime(prevTime);
      if (end) {
        const startMin = end.h * 60 + end.m;
        const endMin = startMin + 50;
        newTime = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)} - ${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
      }
    }
    persist({
      periodCount: newIdx,
      periodTimes: { ...s.periodTimes, [String(newIdx)]: newTime },
    });
  };

  // ── ลบคาบ (re-index) ─────────────────────────────────────────────────────
  const removePeriod = (period: number) => {
    const s = settingsRef.current;
    if (s.periodCount <= 1) return;
    const newCount = s.periodCount - 1;
    const newTimes: Record<string, string> = {};
    for (let p = 1; p <= s.periodCount; p++) {
      if (p === period) continue;
      const newP = p < period ? p : p - 1;
      newTimes[String(newP)] = s.periodTimes[String(p)] ?? '';
    }
    const reindex = (arr: number[]) =>
      arr.filter(b => b !== period).map(b => (b > period ? b - 1 : b)).filter(b => b >= 1 && b <= newCount);

    persist({
      periodCount: newCount,
      breakPeriods: reindex(s.breakPeriods),
      lunchPeriods: reindex(s.lunchPeriods),
      periodTimes: newTimes,
    });
  };

  // ── แก้เวลาคาบ ────────────────────────────────────────────────────────────
  const updatePeriodTime = (period: number, time: string) => {
    const s = settingsRef.current;
    persist({ periodTimes: { ...s.periodTimes, [String(period)]: time } });
  };

  // ── toggle พักเบรกสั้น ────────────────────────────────────────────────────
  const toggleBreakPeriod = (period: number) => {
    const s = settingsRef.current;
    const already = s.breakPeriods.includes(period);
    // ถ้าเปิดเป็นเบรก ให้เอาออกจาก lunch ด้วย
    const newBreaks = already
      ? s.breakPeriods.filter(b => b !== period)
      : [...s.breakPeriods, period].sort((a, b) => a - b);
    const newLunch = already ? s.lunchPeriods : s.lunchPeriods.filter(b => b !== period);
    persist({ breakPeriods: newBreaks, lunchPeriods: newLunch });
  };

  // ── toggle พักกลางวัน ─────────────────────────────────────────────────────
  const toggleLunchPeriod = (period: number) => {
    const s = settingsRef.current;
    const already = s.lunchPeriods.includes(period);
    // ถ้าเปิดเป็น lunch ให้เอาออกจาก break ด้วย
    const newLunch = already
      ? s.lunchPeriods.filter(b => b !== period)
      : [...s.lunchPeriods, period].sort((a, b) => a - b);
    const newBreaks = already ? s.breakPeriods : s.breakPeriods.filter(b => b !== period);
    persist({ lunchPeriods: newLunch, breakPeriods: newBreaks });
  };

  // ── วนเปลี่ยนประเภท: ปกติ → พักเบรก → พักกลางวัน → ปกติ ─────────────────
  const cycleBreakType = (period: number) => {
    const s = settingsRef.current;
    if (s.breakPeriods.includes(period)) {
      // break → lunch
      persist({
        breakPeriods: s.breakPeriods.filter(b => b !== period),
        lunchPeriods: [...s.lunchPeriods, period].sort((a, b) => a - b),
      });
    } else if (s.lunchPeriods.includes(period)) {
      // lunch → normal
      persist({ lunchPeriods: s.lunchPeriods.filter(b => b !== period) });
    } else {
      // normal → break
      persist({ breakPeriods: [...s.breakPeriods, period].sort((a, b) => a - b) });
    }
  };

  // ── คัดลอกไปยังห้องอื่น ──────────────────────────────────────────────────
  const copyToClasses = async (targetClassIds: string[]) => {
    if (targetClassIds.length === 0) return;
    const current = settingsRef.current;
    const promises = targetClassIds.map(id => 
      setDoc(doc(db, 'class_settings', id), current, { merge: true })
    );
    await Promise.all(promises);
  };

  // ── helper สำหรับ ScheduleGrid (key number) ───────────────────────────────
  const periodTimesNumeric: Record<number, string> = {};
  for (const [k, v] of Object.entries(settings.periodTimes)) {
    periodTimesNumeric[Number(k)] = v;
  }

  return {
    periodCount: settings.periodCount,
    breakPeriods: settings.breakPeriods,
    lunchPeriods: settings.lunchPeriods,
    periodTimes: periodTimesNumeric,
    loading,
    addPeriod,
    removePeriod,
    updatePeriodTime,
    toggleBreakPeriod,
    toggleLunchPeriod,
    cycleBreakType,
    updateSettings: persist,
    copyToClasses,
  };
}
