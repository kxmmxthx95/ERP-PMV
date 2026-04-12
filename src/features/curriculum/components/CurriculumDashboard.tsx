import React, { useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Library, Award } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Subject } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

interface CurriculumDashboardProps {
  subjects: Subject[];
  academicYear: string;
}

export default function CurriculumDashboard({ subjects, academicYear }: CurriculumDashboardProps) {
  const { departments, getGradesBySection } = useSchoolStructure();
  const [filterDept, setFilterDept] = useState<string>('all');

  const filteredSubjects = useMemo(() => {
    if (filterDept === 'all') return subjects;
    return subjects.filter(s => {
      const normalized = s.department === 'early' ? 'early-childhood' : s.department;
      return normalized === filterDept;
    });
  }, [subjects, filterDept]);

  const stats = useMemo(() => {
    const totalCredits = filteredSubjects.reduce((sum, s) => sum + (s.credits || 0), 0);
    const coreCount = filteredSubjects.filter(s => s.category === 'core').length;
    const electiveCount = filteredSubjects.filter(s => s.category === 'elective' || s.category === 'added').length;
    const activityCount = filteredSubjects.filter(s => s.category === 'activity').length;

    let barData = [];
    let barTitle = '';

    if (filterDept === 'all') {
      barTitle = 'สัดส่วนรายวิชาตามแผนก';
      barData = [
        { name: 'ปฐมวัย', count: subjects.filter(s => s.department === 'early').length, fill: '#ec4899' },
        { name: 'ประถมศึกษา', count: subjects.filter(s => s.department === 'primary').length, fill: '#f59e0b' },
        { name: 'มัธยมศึกษา', count: subjects.filter(s => s.department === 'secondary').length, fill: '#3b82f6' },
      ];
    } else {
      barTitle = 'สัดส่วนรายวิชาตามระดับชั้น';
      const grades = getGradesBySection(filterDept as any) || [];
      const color = filterDept === 'early-childhood' ? '#ec4899' : filterDept === 'primary' ? '#f59e0b' : '#3b82f6';
      barData = grades.map(g => ({
        name: g.shortLabel,
        count: filteredSubjects.filter(s => (s as any).gradeLevel === g.id).length,
        fill: color
      }));
    }

    const catData = [
      { name: 'พื้นฐาน', value: coreCount, fill: '#3b82f6' },
      { name: 'เพิ่มเติม', value: electiveCount, fill: '#8b5cf6' },
      { name: 'กิจกรรม', value: activityCount, fill: '#10b981' },
    ];

    return { totalCredits, coreCount, electiveCount, activityCount, barData, barTitle, catData };
  }, [subjects, filteredSubjects, filterDept, getGradesBySection]);

  return (
    <div className="space-y-4">
      {/* ── Top Bar Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-black/80 tracking-tight">สรุปภาพรวมหลักสูตร</h2>
        <div
          className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full w-fit"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.25rem',
          }}
        >
          {[{ id: 'all', label: 'ทั้งหมด' }, ...departments].map(tab => {
            const active = filterDept === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterDept(tab.id)}
                className="flex items-center justify-center px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 flex-shrink-0"
                style={{
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="รายวิชาทั้งหมด" value={filteredSubjects.length} subtitle={filterDept === 'all' ? `หลักสูตรปี ${academicYear}` : `ในแผนกที่เลือก`} icon={BookOpen} color="#3b82f6" />
        <StatCard title="หน่วยกิตรวม" value={stats.totalCredits} subtitle="จากรายวิชาในแผนก" icon={Library} color="#8b5cf6" />
        <StatCard title="วิชาพื้นฐาน" value={stats.coreCount} subtitle="วิชาแกนบังคับ" icon={GraduationCap} color="#f59e0b" />
        <StatCard title="กิจกรรมพัฒนาผู้เรียน" value={stats.activityCount} subtitle="ชมรม/แนะแนว/สังคม" icon={Award} color="#10b981" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={glassCard} className="p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-black/80 mb-6">{stats.barTitle}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgba(0,0,0,0.4)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgba(0,0,0,0.4)' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={glassCard} className="p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-black/80 mb-6">สัดส่วนหมวดวิชา</h3>
          <div className="h-64 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={stats.catData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.catData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {stats.catData.map(c => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span className="text-[11px] font-medium text-black/60">{c.name} ({c.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div style={glassCard} className="p-5 rounded-3xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs font-semibold text-black/50">{title}</p>
        <p className="text-2xl font-bold text-black/80 leading-none mt-1.5">{value}</p>
        {subtitle && <p className="text-[10px] text-black/40 mt-1.5">{subtitle}</p>}
      </div>
    </div>
  );
}