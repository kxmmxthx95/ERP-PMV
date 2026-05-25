import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WIDGET_GLASS } from '../widgetStyles';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student } from '@/types/student';

export default function StudentProfileWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'students', user.uid));
        if (snap.exists()) {
          setStudent({ id: snap.id, ...snap.data() } as Student);
        }
      } catch (_) {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
  }, [user]);

  return (
    <div 
      style={WIDGET_GLASS} 
      className="rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden group cursor-pointer w-full"
      onClick={() => navigate('/portal/profile')}
    >
      {/* Background Decor */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : student ? (
        <>
          {/* Avatar + Name Row */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                <img
                  src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`}
                  alt={student.firstName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[14px] text-slate-800 truncate tracking-tight">
                {student.prefix}{student.firstName} {student.lastName}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-blue-600">รหัส: {student.studentCode || '–'}</p>
                {(!student.phone || !student.email || !student.nickname) && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[9px] font-black border border-rose-100 animate-pulse">
                    ข้อมูลไม่ครบ
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
              <ChevronRight size={16} />
            </div>
          </div>

        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-black text-[14px] text-slate-700">ข้อมูลส่วนตัว</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Profile & Records</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">กรุณาติดต่อธุรการเพื่อเพิ่มข้อมูลนักเรียน</p>
        </>
      )}
    </div>
  );
}
