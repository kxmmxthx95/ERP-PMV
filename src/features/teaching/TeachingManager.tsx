import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, ClipboardList, GraduationCap, BookOpen, TrendingUp } from 'lucide-react';
import { GLASS } from '@/components/layouts/PortalLayout';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import AssignmentPanel from './components/AssignmentPanel';
import ExamPanel from './components/ExamPanel';

// ── Mock teacher ID — แทนด้วย useAuth().user.uid เมื่อ backend พร้อม ────────────
const MOCK_TEACHER_ID = 't03';

// ── Tab Config ─────────────────────────────────────────────────────────────────

type Tab = 'attendance' | 'assignments' | 'exams';

const TABS: { key: Tab; label: string; icon: typeof CheckSquare }[] = [
  { key: 'assignments', label: 'ภาระงาน', icon: ClipboardList },
  { key: 'exams', label: 'การสอบ', icon: GraduationCap },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeachingManager() {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0].key);

  const mgr = useTeachingManager(MOCK_TEACHER_ID);

  return (
    <div className="relative w-full bg-transparent overflow-hidden h-full">
      <div className="max-w-[1400px] mx-auto flex flex-col h-full gap-4 pb-10 pt-4 px-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-[2rem] px-6 py-4 flex items-center gap-4"
          style={{
            background: 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px 0 rgba(31,38,135,0.07)',
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-800 font-sukhumvit"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              จัดการการสอน
            </h1>
            <p className="text-[11px] text-slate-500 font-sarabun">
              {mgr.currentTeacher?.name ?? 'ครู'} · ปีการศึกษา {mgr.activeYearStr} ภาคเรียนที่ {mgr.semester}
            </p>
          </div>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <TrendingUp size={13} className="text-blue-500" />
              <span className="text-[12px] font-bold text-slate-700 font-sukhumvit">
                ภาระงาน {mgr.stats.activeAssignments} รายการ
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <GraduationCap size={13} className="text-violet-500" />
              <span className="text-[12px] font-bold text-slate-700 font-sukhumvit">
                การสอบใกล้มา {mgr.stats.upcomingExams} รายการ
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Tab Content ── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex-1 min-h-0 rounded-[2rem] p-5 mb-20"
          style={{ ...GLASS, boxShadow: '0 15px 35px -5px rgba(0,0,0,0.06)' }}
        >
          {activeTab === 'assignments' && (
            <AssignmentPanel
              teacherId={MOCK_TEACHER_ID}
              academicYearId={mgr.activeYearStr}
              semester={mgr.semester}
              mySubjects={mgr.mySubjects}
              classes={mgr.classes}
              assignments={mgr.assignments}
              getSubmissionsForAssignment={mgr.getSubmissionsForAssignment}
              onCreateAssignment={mgr.createAssignment}
              onUpdateAssignment={mgr.updateAssignment}
              onDeleteAssignment={mgr.deleteAssignment}
              onInitSubmissions={mgr.initSubmissions}
              onSaveSubmissionScore={mgr.saveSubmissionScore}
            />
          )}

          {activeTab === 'exams' && (
            <ExamPanel
              teacherId={MOCK_TEACHER_ID}
              academicYearId={mgr.activeYearStr}
              semester={mgr.semester}
              mySubjects={mgr.mySubjects}
              classes={mgr.classes}
              exams={mgr.exams}
              getScoresForExam={mgr.getScoresForExam}
              onCreateExam={mgr.createExam}
              onUpdateExam={mgr.updateExam}
              onDeleteExam={mgr.deleteExam}
              onInitExamScores={mgr.initExamScores}
              onSaveExamScore={mgr.saveExamScore}
            />
          )}
        </motion.div>
      </div>

      {/* ── Fixed Bottom Capsule Tab Switcher ── */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-full shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-[12px] font-bold font-sukhumvit transition-all ${isActive
                    ? 'bg-slate-900 text-white shadow-lg scale-105'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                  }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
