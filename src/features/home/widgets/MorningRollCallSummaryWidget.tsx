import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw } from 'lucide-react';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { WIDGET_GLASS } from '../widgetStyles';
import type { MorningRollCallSession } from '@/types/morningRollCall';

export default function MorningRollCallSummaryWidget() {
  const { year } = useActiveAcademicYear();
  const [sessions, setSessions] = useState<MorningRollCallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTodaySessions = async () => {
    if (!year) {
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'morning_rollcall'),
        where('date', '==', today),
        where('academicYearId', '==', year),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => d.data() as MorningRollCallSession);
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTodaySessions();
  }, [year]);

  const totalClasses = sessions.length;
  const presentTotal = sessions.reduce((sum, s) => sum + s.summary.present, 0);
  const totalStudents = sessions.reduce((sum, s) => sum + s.totalStudents, 0);

  if (loading) {
    return (
      <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full h-[140px] animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/2 mt-2" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={WIDGET_GLASS}
      className="rounded-3xl p-5 flex flex-col gap-3 w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-400/20 flex items-center justify-center">
            <BarChart3 size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-700">สรุปเช็คชื่อเข้าแถว</p>
            <p className="text-[10px] text-slate-400">วันนี้ทั้งโรงเรียน</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={fetchTodaySessions}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-slate-200/50 transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={`text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: 'rgba(248,250,252,0.7)' }}>
          <p className="text-xs text-slate-500 font-semibold mb-1">ห้องที่เช็คแล้ว</p>
          <p className="text-2xl font-black text-indigo-600">{totalClasses}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(248,250,252,0.7)' }}>
          <p className="text-xs text-slate-500 font-semibold mb-1">นักเรียนมาเรียน</p>
          <p className="text-2xl font-black text-green-600">
            {totalStudents > 0 ? Math.round((presentTotal / totalStudents) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Detail Row */}
      {totalStudents > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between text-xs text-slate-600 mt-1"
        >
          <span>{presentTotal} คน</span>
          <span>/</span>
          <span>{totalStudents} คน</span>
        </motion.div>
      )}

      {totalClasses === 0 && (
        <p className="text-xs text-slate-400 italic mt-2">ยังไม่มีห้องที่เช็คชื่อวันนี้</p>
      )}
    </motion.div>
  );
}
