import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { HiBookOpen, HiAcademicCap, HiBuildingLibrary, HiTrophy, HiSquare2Stack } from 'react-icons/hi2';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  type CurriculumVersion, type CurriculumCourse,
  CURRICULUM_TRACK_CONFIG, DEPARTMENT_CONFIG,
} from '@/types/curriculum';

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 15px 35px -5px rgba(0,0,0,0.06), 0 10px 15px -6px rgba(0,0,0,0.04)',
};

interface CurriculumDashboardProps {
  versions: CurriculumVersion[];
  coursesByVersion: Record<string, CurriculumCourse[]>;
  getCourseSummary: (versionId: string) => { count: number; totalCredit: number; basic: number; additional: number; activity: number };
  isLoading: boolean;
}

const CATEGORY_COLORS = { basic: '#0ea5e9', additional: '#f97316', activity: '#10b981' };
const DEPT_COLORS: Record<string, string> = { early: '#ec4899', primary: '#3b82f6', secondary: '#8b5cf6' };

export default function CurriculumDashboard({
  versions,
  coursesByVersion,
  getCourseSummary,
  isLoading,
}: CurriculumDashboardProps) {

  const allCourses = useMemo(() => Object.values(coursesByVersion).flat().filter(c => !c.isRetired), [coursesByVersion]);

  const totalVersions = versions.length;
  const totalCourses = allCourses.length;
  const totalCredits = useMemo(() => allCourses.reduce((s, c) => s + (c.credit || 0), 0), [allCourses]);
  const editableVersions = versions.filter(v => v.allowEdit).length;

  // Category breakdown (pie)
  const categoryData = useMemo(() => {
    const basic = allCourses.filter(c => c.category === 'basic').length;
    const additional = allCourses.filter(c => c.category === 'additional').length;
    const activity = allCourses.filter(c => c.category === 'activity').length;
    return [
      { name: 'พื้นฐาน', value: basic, color: CATEGORY_COLORS.basic },
      { name: 'เพิ่มเติม', value: additional, color: CATEGORY_COLORS.additional },
      { name: 'กิจกรรม', value: activity, color: CATEGORY_COLORS.activity },
    ].filter(d => d.value > 0);
  }, [allCourses]);

  // Credits per version (bar chart — top 8)
  const versionCreditData = useMemo(() => {
    return [...versions]
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 8)
      .map(v => {
        const s = getCourseSummary(v.id);
        return { name: v.name.length > 14 ? v.name.slice(0, 14) + '…' : v.name, credits: s.totalCredit, courses: s.count };
      });
  }, [versions, getCourseSummary]);

  // Department distribution
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    allCourses.forEach(c => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return Object.entries(counts).map(([dept, count]) => ({
      dept,
      count,
      label: DEPARTMENT_CONFIG[dept as keyof typeof DEPARTMENT_CONFIG]?.label || dept,
      color: DEPT_COLORS[dept] || '#94a3b8',
    }));
  }, [allCourses]);

  // Track breakdown (from versions that have a track)
  const trackData = useMemo(() => {
    const counts: Record<string, number> = {};
    versions.forEach(v => {
      if (v.track) counts[v.track] = (counts[v.track] || 0) + 1;
    });
    return Object.entries(counts).map(([track, count]) => ({
      track,
      count,
      label: CURRICULUM_TRACK_CONFIG[track as keyof typeof CURRICULUM_TRACK_CONFIG]?.label || track,
      color: CURRICULUM_TRACK_CONFIG[track as keyof typeof CURRICULUM_TRACK_CONFIG]?.color || '#94a3b8',
      bg: CURRICULUM_TRACK_CONFIG[track as keyof typeof CURRICULUM_TRACK_CONFIG]?.bg || 'rgba(148,163,184,0.1)',
    }));
  }, [versions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-3xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: HiBuildingLibrary, label: 'หลักสูตรทั้งหมด', value: totalVersions, sub: `${editableVersions} แก้ไขได้`, color: '#3b82f6' },
          { icon: HiBookOpen, label: 'รายวิชาทั้งหมด', value: totalCourses, sub: 'ใน catalog', color: '#10b981' },
          { icon: HiTrophy, label: 'หน่วยกิตรวม', value: totalCredits.toFixed(1), sub: 'ทุกหลักสูตร', color: '#f97316' },
          { icon: HiSquare2Stack, label: 'สายการเรียน', value: trackData.length, sub: `จาก ${totalVersions} หลักสูตร`, color: '#8b5cf6' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={glassCard}
            className="rounded-3xl p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sarabun mb-0.5">{label}</p>
              <p className="text-2xl font-black text-slate-900 font-sarabun leading-none">{value}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 font-sukhumvit">{sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── Credits Per Version (bar) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={glassCard}
          className="xl:col-span-2 rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <HiAcademicCap size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[13px] font-black text-slate-800 font-sukhumvit">หน่วยกิตต่อหลักสูตร</p>
              <p className="text-[10px] font-medium text-slate-400 font-sarabun">แสดงสูงสุด 8 หลักสูตรล่าสุด</p>
            </div>
          </div>
          {versionCreditData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold font-sukhumvit">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={versionCreditData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Sarabun', fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'Sarabun', fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 11, fontFamily: 'Sarabun' }}
                  formatter={(v) => [`${(v as number).toFixed(1)} นก.`, 'หน่วยกิต']}
                />
                <Bar dataKey="credits" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ── Category Pie ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={glassCard}
          className="rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <HiBookOpen size={18} className="text-emerald-500" />
            </div>
            <p className="text-[13px] font-black text-slate-800 font-sukhumvit">หมวดวิชา</p>
          </div>
          {categoryData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold font-sukhumvit">ยังไม่มีข้อมูล</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 11, fontFamily: 'Sarabun' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {categoryData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-[11px] font-bold text-slate-600 font-sukhumvit">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-slate-800 font-sarabun">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── Department Distribution ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={glassCard}
          className="rounded-3xl p-6"
        >
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit mb-4">รายวิชาตามแผนก</p>
          {deptData.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-300 text-sm font-bold font-sukhumvit">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3">
              {deptData.map(d => {
                const pct = totalCourses > 0 ? (d.count / totalCourses) * 100 : 0;
                return (
                  <div key={d.dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-600 font-sukhumvit">{d.label}</span>
                      <span className="text-[11px] font-black text-slate-800 font-sarabun">{d.count} วิชา</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: d.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Track Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={glassCard}
          className="rounded-3xl p-6"
        >
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit mb-4">หลักสูตรตามสายการเรียน</p>
          {trackData.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-300 text-sm text-center font-bold font-sukhumvit">
              ยังไม่มีหลักสูตรที่ระบุสาย
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {trackData.map(t => (
                <div
                  key={t.track}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl"
                  style={{ background: t.bg, border: `1px solid ${t.color}30` }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-[11px] font-bold font-sukhumvit" style={{ color: t.color }}>{t.label}</span>
                  <span className="text-[11px] font-black font-sarabun" style={{ color: t.color }}>{t.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent versions list */}
          {versions.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun mb-2">หลักสูตรล่าสุด</p>
              {[...versions].sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 4).map(v => {
                const s = getCourseSummary(v.id);
                const trackCfg = v.track ? CURRICULUM_TRACK_CONFIG[v.track] : null;
                return (
                  <div key={v.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-slate-700 font-sukhumvit truncate">{v.name}</span>
                      {trackCfg && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ background: trackCfg.bg, color: trackCfg.color }}
                        >
                          {trackCfg.label}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 font-sarabun shrink-0 ml-2">{s.count} วิชา</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
