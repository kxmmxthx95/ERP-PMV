import { useState, useEffect } from 'react';
import { Heart, User } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { cn } from '@/lib/utils';
import { countDays } from '@/hooks/useLeaveRequests';

export default function LeaveQuotaWidget() {
  const { user, role } = useAuth();
  const { year: activeYear } = useActiveAcademicYear();
  const [quota, setQuota] = useState<{ sick: number; personal: number }>({ sick: 0, personal: 0 });
  const [used, setUsed] = useState<{ sick: number; personal: number }>({ sick: 0, personal: 0 });
  const [loading, setLoading] = useState(true);

  const isStudent = role === 'student';

  useEffect(() => {
    async function fetchData() {
      if (!user?.uid || !activeYear) return;
      setLoading(true);
      try {
        // 1. Fetch Quota
        const qDoc = await getDoc(doc(db, 'settings', 'leave_quota'));
        if (qDoc.exists()) {
          const data = qDoc.data();
          const yrData = data.quotasByAcademicYear?.[activeYear];
          if (yrData) {
            setQuota({
              sick: isStudent ? yrData.studentSickDays : yrData.staffSickDays,
              personal: isStudent ? yrData.studentPersonalDays : yrData.staffPersonalDays,
            });
          }
        }

        // 2. Fetch Used Days
        const q = query(
          collection(db, 'leave_requests'),
          where('requesterId', '==', user.uid),
          where('status', '==', 'approved')
        );
        const snap = await getDocs(q);
        const reqs = snap.docs.map(d => d.data());
        
        let sickUsed = 0;
        let personalUsed = 0;

        reqs.forEach(r => {
          // Check if request is within academic year if needed, but for now we trust the query or year filter
          // Actually we should filter by year if we had it in the doc, but for now we calculate all approved
          const days = countDays(r.startDate, r.endDate);
          if (r.leaveType === 'sick') sickUsed += days;
          if (r.leaveType === 'personal') personalUsed += days;
        });

        setUsed({ sick: sickUsed, personal: personalUsed });
      } catch (err) {
        console.error('Error fetching quota:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.uid, activeYear, isStudent]);

  if (loading) {
    return <WidgetSkeleton />;
  }

  const items = [
    { 
      label: 'ลาป่วย', 
      used: used.sick, 
      total: quota.sick, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50/50', 
      icon: Heart,
    },
    { 
      label: 'ลากิจ', 
      used: used.personal, 
      total: quota.personal, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50/50', 
      icon: User,
    },
  ];

  return (
    <div style={WIDGET_GLASS} className={WIDGET_CARD}>
      <div className="shrink-0 min-w-0">
        <p className="text-sm font-black text-slate-800 truncate">โควต้าการลา</p>
        <p className="text-[9px] font-bold text-slate-400 truncate">ปีการศึกษา {activeYear}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        {items.map((item) => {
          const remaining = Math.max(0, item.total - item.used);

          return (
            <div
              key={item.label}
              className={cn('rounded-xl border border-slate-100 p-2 min-w-0 flex flex-col justify-center', item.bg)}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <item.icon size={12} className={item.color} strokeWidth={2.5} />
                <span className="text-[9px] font-black text-slate-400 truncate">{item.label}</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className={cn('text-base font-black tabular-nums leading-none', item.color)}>{item.used}</span>
                <span className="text-[10px] font-bold text-slate-400">/ {item.total} วัน</span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-slate-400 truncate">คงเหลือ {remaining} วัน</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
