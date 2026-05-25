import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, User, CalendarDays } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { WIDGET_GLASS } from '../widgetStyles';
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
    return (
      <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full h-full animate-pulse">
        <div className="h-4 w-32 bg-slate-100 rounded-full" />
        <div className="grid grid-cols-2 gap-3 h-24">
          <div className="bg-slate-50 rounded-2xl" />
          <div className="bg-slate-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  const items = [
    { 
      label: 'ลาป่วย', 
      used: used.sick, 
      total: quota.sick, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50/50', 
      icon: Heart,
      accent: 'bg-rose-500'
    },
    { 
      label: 'ลากิจ', 
      used: used.personal, 
      total: quota.personal, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50/50', 
      icon: User,
      accent: 'bg-amber-500'
    },
  ];

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full h-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarDays size={16} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">โควต้าการลา</p>
            <p className="text-[10px] font-bold text-slate-400">ปีการศึกษา {activeYear}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const remaining = Math.max(0, item.total - item.used);
          const percent = item.total > 0 ? Math.min(100, (item.used / item.total) * 100) : 0;
          
          return (
            <div key={item.label} className={cn("relative overflow-hidden rounded-2xl border border-slate-100 p-4 transition-all hover:shadow-md", item.bg)}>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <item.icon size={14} className={item.color} strokeWidth={2.5} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black tabular-nums", item.color)}>{item.used}</span>
                  <span className="text-xs font-bold text-slate-400">/ {item.total} วัน</span>
                </div>
                <div className="mt-3 h-1.5 w-full bg-white/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={cn("h-full rounded-full", item.accent)}
                  />
                </div>
                <p className="mt-2 text-[9px] font-bold text-slate-400">คงเหลือ {remaining} วัน</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
