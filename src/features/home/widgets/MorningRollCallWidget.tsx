import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { WIDGET_GLASS } from '../widgetStyles';
import type { MorningRollCallSession } from '@/types/morningRollCall';

function generateDocId(date: string, classId: string): string {
  return `${date}_${classId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export default function MorningRollCallWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { year } = useActiveAcademicYear();
  const classMgr = useClassroomManager();
  const [session, setSession] = useState<MorningRollCallSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodaySession = async () => {
      if (!user?.uid || !year) {
        setLoading(false);
        return;
      }

      const homeRoomClass = classMgr.classes?.find((c: any) => c.homeroomTeacherId === user.uid && String(c.academicYearId) === String(year));
      if (!homeRoomClass) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const docId = generateDocId(today, homeRoomClass.id);
      const docRef = doc(db, 'morning_rollcall', docId);

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSession(docSnap.data() as MorningRollCallSession);
        }
      } catch (err) {
        console.error('Failed to fetch morning roll call:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTodaySession();
  }, [user?.uid, year, classMgr.classes]);

  if (loading) {
    return (
      <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full h-[140px] animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/2 mt-2" />
      </div>
    );
  }

  const isCheckedIn = !!session;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={WIDGET_GLASS}
      className="rounded-3xl p-5 flex flex-col gap-3 w-full cursor-pointer hover:shadow-sm transition"
      onClick={() => navigate('/portal/morning-rollcall')}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isCheckedIn ? 'bg-green-400/20' : 'bg-orange-400/20'
          }`}>
            {isCheckedIn ? (
              <CheckCircle2 size={18} className="text-green-600" />
            ) : (
              <Clock size={18} className="text-orange-600" />
            )}
          </div>
          <div>
            <p className="font-bold text-sm text-slate-700">เช็คชื่อเข้าแถว</p>
            <p className="text-[10px] text-slate-400">assembly roll-call</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </div>

      {/* Content */}
      {isCheckedIn && session ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-baseline gap-2"
        >
          <p className="text-2xl font-black text-green-600">{session.summary.present}</p>
          <p className="text-xs text-slate-500">มาเรียน /{session.totalStudents} คน</p>
        </motion.div>
      ) : (
        <p className="text-sm text-slate-600 font-semibold">ยังไม่ได้เช็คชื่อวันนี้</p>
      )}

      {/* Details */}
      {isCheckedIn && session && (
        <div className="grid grid-cols-3 gap-2 mt-1 text-center">
          <div className="rounded-lg bg-red-500/10 py-1">
            <p className="text-sm font-bold text-red-600">{session.summary.absent}</p>
            <p className="text-[8px] text-red-500 font-semibold">ขาด</p>
          </div>
          <div className="rounded-lg bg-yellow-500/10 py-1">
            <p className="text-sm font-bold text-yellow-600">{session.summary.late}</p>
            <p className="text-[8px] text-yellow-500 font-semibold">สาย</p>
          </div>
          <div className="rounded-lg bg-violet-500/10 py-1">
            <p className="text-sm font-bold text-violet-600">{session.summary.leave}</p>
            <p className="text-[8px] text-violet-500 font-semibold">ลา</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
