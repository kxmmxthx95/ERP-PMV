import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlineUserGroup,
} from 'react-icons/hi2';
import { buildTeacherIdentityKeys } from '@/lib/teachers/teacherIdentity';
import { glassStyles } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { MicroSyllabus } from '@/types/microSyllabus';
import type { TeacherProfile } from '@/types/teacher';
import { countTeachingPlanStats } from '../utils/teachingPlanCalendar';
import AdminProgressView from './AdminProgressView';
import WeeklyTopicGrid from './WeeklyTopicGrid';

interface Props {
  teachers: TeacherProfile[];
  syllabi: MicroSyllabus[];
  semesterStart: string;
  semesterEnd: string;
}

interface TeacherPlanEntry {
  id: string;
  name: string;
  syllabi: MicroSyllabus[];
  avgPct: number;
}

const AVATAR_COLORS = [
  { bg: '#eef2ff', text: '#4f46e5' },
  { bg: '#ecfdf5', text: '#059669' },
  { bg: '#fff7ed', text: '#ea580c' },
  { bg: '#fdf2f8', text: '#db2777' },
  { bg: '#f0f9ff', text: '#0284c7' },
  { bg: '#f5f3ff', text: '#7c3aed' },
];

function stripThaiHonorific(name: string): string {
  return name.replace(/^(นาย|นางสาว|นาง|ดร\.?|ผศ\.?)\s*/i, '').replace(/\s+/g, ' ').trim();
}

function normalizeTeacherName(value: string): string {
  return stripThaiHonorific(value).toLowerCase();
}

function avatarStyle(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function matchesTeacherSyllabus(syllabus: MicroSyllabus, teacher: TeacherProfile): boolean {
  const keys = buildTeacherIdentityKeys(teacher.userId ?? '', teacher);
  if (keys.has(syllabus.teacherId)) return true;
  return normalizeTeacherName(syllabus.teacherName) === normalizeTeacherName(teacher.name);
}

function computeAvgPct(items: MicroSyllabus[]): number {
  if (items.length === 0) return 0;
  const pcts = items.map((s) => {
    const { planned, completed } = countTeachingPlanStats(s.topics);
    const total = planned > 0 ? planned : s.totalWeeks;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });
  return Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length);
}

function buildTeacherEntries(
  teachers: TeacherProfile[],
  syllabi: MicroSyllabus[],
): TeacherPlanEntry[] {
  const matchedSyllabusIds = new Set<string>();
  const entries: TeacherPlanEntry[] = [];

  const activeTeachers = teachers
    .filter((t) => t.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  for (const teacher of activeTeachers) {
    const teacherSyllabi = syllabi.filter((s) => {
      if (!matchesTeacherSyllabus(s, teacher)) return false;
      matchedSyllabusIds.add(s.id);
      return true;
    });

    entries.push({
      id: teacher.id,
      name: teacher.name,
      syllabi: teacherSyllabi,
      avgPct: computeAvgPct(teacherSyllabi),
    });
  }

  const orphanGroups = new Map<string, MicroSyllabus[]>();
  for (const syllabus of syllabi) {
    if (matchedSyllabusIds.has(syllabus.id)) continue;
    const key = `${syllabus.teacherId}|${normalizeTeacherName(syllabus.teacherName)}`;
    const group = orphanGroups.get(key) ?? [];
    group.push(syllabus);
    orphanGroups.set(key, group);
  }

  for (const [key, group] of orphanGroups) {
    entries.push({
      id: `orphan:${key}`,
      name: group[0]?.teacherName || 'ครูไม่ระบุ',
      syllabi: group,
      avgPct: computeAvgPct(group),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

function TeacherPlanCard({
  entry,
  active,
  onClick,
}: {
  entry: TeacherPlanEntry;
  active: boolean;
  onClick: () => void;
}) {
  const av = avatarStyle(entry.name);
  const initial = entry.name.replace(/^(นาย|นางสาว|นาง)\s*/i, '').charAt(0) || '?';
  const hasPlans = entry.syllabi.length > 0;
  const barColor = entry.avgPct >= 80 ? '#10b981' : entry.avgPct >= 50 ? '#f59e0b' : '#6366f1';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl p-3.5 border transition-all',
        active
          ? 'bg-indigo-600 border-indigo-600 shadow-md'
          : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30',
      )}
    >
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
          style={{ background: active ? 'rgba(255,255,255,0.2)' : av.bg, color: active ? '#fff' : av.text }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-black leading-tight truncate font-sukhumvit', active ? 'text-white' : 'text-slate-800')}>
            {entry.name}
          </p>
          <p className={cn('text-[11px] mt-0.5 font-sarabun', active ? 'text-indigo-200' : 'text-slate-400')}>
            {hasPlans ? `${entry.syllabi.length} วิชา` : 'ยังไม่มีแผนการสอน'}
          </p>
        </div>
        {hasPlans && (
          <span className={cn(
            'text-[11px] font-black shrink-0 px-2 py-0.5 rounded-lg',
            active ? 'bg-white/20 text-white' : 'text-indigo-600 bg-indigo-50',
          )}
          >
            {entry.avgPct}%
          </span>
        )}
      </div>

      {hasPlans && (
        <div className={cn('h-1 rounded-full overflow-hidden', active ? 'bg-indigo-500' : 'bg-slate-100')}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${entry.avgPct}%`, background: active ? '#fff' : barColor }}
          />
        </div>
      )}
    </button>
  );
}

export default function AdminTeacherPlanBrowser({
  teachers,
  syllabi,
  semesterStart,
  semesterEnd,
}: Props) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);

  const teacherEntries = useMemo(
    () => buildTeacherEntries(teachers, syllabi),
    [teachers, syllabi],
  );

  const selectedTeacher = useMemo(
    () => teacherEntries.find((entry) => entry.id === selectedTeacherId) ?? null,
    [teacherEntries, selectedTeacherId],
  );

  const selectedSyllabus = useMemo(
    () => selectedTeacher?.syllabi.find((s) => s.id === selectedSyllabusId) ?? null,
    [selectedTeacher, selectedSyllabusId],
  );

  const selectedTeacherAvatar = useMemo(
    () => (selectedTeacher ? avatarStyle(selectedTeacher.name) : null),
    [selectedTeacher],
  );

  const handleSelectTeacher = (id: string) => {
    setSelectedTeacherId(id);
    setSelectedSyllabusId(null);
  };

  if (teacherEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl">
          👩‍🏫
        </div>
        <p className="font-black text-slate-700 font-sukhumvit">ยังไม่มีรายชื่อครูในระบบ</p>
        <p className="text-sm text-slate-400 font-sarabun">เพิ่มครูในระบบจัดการครูก่อน</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      <div
        className={cn(
          'flex-col gap-2 lg:w-72 xl:w-80 shrink-0',
          selectedTeacherId ? 'hidden lg:flex' : 'flex w-full',
        )}
      >
        <div className="flex items-center gap-2 px-1 mb-1">
          <HiOutlineUserGroup size={14} className="text-slate-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            รายชื่อครู
          </p>
          <span className="ml-auto text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
            {teacherEntries.length}
          </span>
        </div>

        {teacherEntries.map((entry) => (
          <TeacherPlanCard
            key={entry.id}
            entry={entry}
            active={selectedTeacherId === entry.id}
            onClick={() => handleSelectTeacher(entry.id)}
          />
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {selectedSyllabus ? (
          <motion.div
            key={selectedSyllabus.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex-1 min-w-0 flex flex-col gap-3"
          >
            <WeeklyTopicGrid
              topics={selectedSyllabus.topics}
              semesterStart={semesterStart}
              semesterEnd={semesterEnd}
              onSave={async () => {}}
              readOnly
            />
          </motion.div>
        ) : selectedTeacher ? (
          <motion.div
            key={selectedTeacher.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex-1 min-w-0 flex flex-col gap-4"
          >
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={glassStyles.card}>
              <button
                type="button"
                onClick={() => setSelectedTeacherId(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors lg:hidden shrink-0"
              >
                <HiOutlineArrowLeft size={18} />
              </button>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                style={{
                  background: selectedTeacherAvatar?.bg,
                  color: selectedTeacherAvatar?.text,
                }}
              >
                {selectedTeacher.name.replace(/^(นาย|นางสาว|นาง)\s*/i, '').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 font-sukhumvit leading-tight truncate">
                  {selectedTeacher.name}
                </p>
                <p className="text-[11px] text-slate-400 font-sarabun">
                  {selectedTeacher.syllabi.length > 0
                    ? `${selectedTeacher.syllabi.length} วิชา · เฉลี่ย ${selectedTeacher.avgPct}%`
                    : 'ยังไม่มีแผนการสอน'}
                </p>
              </div>
            </div>

            {selectedTeacher.syllabi.length > 0 ? (
              <AdminProgressView
                syllabi={selectedTeacher.syllabi}
                onSelect={(syllabus) => setSelectedSyllabusId(syllabus.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-sm font-bold text-slate-400 font-sukhumvit">ครูท่านนี้ยังไม่ได้กรอกแผนการสอน</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty-admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden lg:flex flex-1 items-center justify-center py-20 rounded-2xl border border-dashed border-slate-200"
          >
            <div className="text-center text-slate-300">
              <HiOutlineUserGroup size={40} className="mx-auto mb-3" />
              <p className="text-sm font-bold font-sukhumvit">เลือกครูเพื่อดูแผนการสอน</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
