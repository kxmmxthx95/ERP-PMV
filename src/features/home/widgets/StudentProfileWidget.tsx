import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import type { Student } from '@/types/student';

export default function StudentProfileWidget() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      if (!user?.uid) return;
      try {
        const resolved = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });
        if (resolved) setStudent(resolved);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    void fetchStudent();
  }, [user, userData?.studentCode, user?.email]);

  if (loading) return <WidgetSkeleton variant="profile" />;

  return (
    <div
      style={WIDGET_GLASS}
      className={`${WIDGET_CARD} relative overflow-hidden group cursor-pointer`}
      onClick={() => navigate('/portal/profile')}
    >
      {student ? (
        <>
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-white shadow-sm shrink-0">
              <img
                src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`}
                alt={student.firstName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-xs text-slate-800 truncate">
                {student.prefix}{student.firstName} {student.lastName}
              </p>
              <p className="text-[10px] font-bold text-blue-600 truncate">รหัส: {student.studentCode || '–'}</p>
            </div>
            <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
          </div>
          <p className="mt-auto shrink-0 text-[10px] text-slate-400 font-medium truncate">
            {(!student.phone || !student.email || !student.nickname)
              ? 'ข้อมูลไม่ครบ — แตะเพื่ออัปเดต'
              : 'ข้อมูลส่วนตัว'}
          </p>
        </>
      ) : (
        <>
          <div className="shrink-0 min-w-0">
            <span className="font-black text-sm text-slate-700 block truncate">ข้อมูลส่วนตัว</span>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Profile & Records</p>
          </div>
          <p className="flex-1 flex items-center text-[10px] text-slate-500 font-medium leading-snug">
            กรุณาติดต่อธุรการเพื่อเพิ่มข้อมูลนักเรียน
          </p>
        </>
      )}
    </div>
  );
}
