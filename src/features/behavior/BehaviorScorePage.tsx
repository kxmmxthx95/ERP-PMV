import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import BehaviorNavCapsule, { type BehaviorTab } from './components/BehaviorNavCapsule';

const BehaviorDashboardPanel = lazy(() => import('./components/BehaviorDashboardPanel'));
const BehaviorStudentListPanel = lazy(() => import('./components/BehaviorStudentListPanel'));
const BehaviorReportPanel = lazy(() => import('./components/BehaviorReportPanel'));
const BehaviorRulesPanel = lazy(() => import('./components/BehaviorRulesPanel'));

function PanelFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
    </div>
  );
}

export default function BehaviorScorePage() {
  const { year, isLoaded } = useActiveAcademicYear();
  const { canEdit } = useMyPermissions();
  const [activeTab, setActiveTab] = useState<BehaviorTab>('dashboard');

  const showRulesTab = canEdit('behaviorScore');

  if (!isLoaded || !year) {
    return (
      <div className="flex flex-1 flex-col min-h-0 font-sukhumvit">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
          กรุณาตั้งค่าปีการศึกษาก่อน
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col min-h-0 gap-5 pb-24 font-sukhumvit">
      <BehaviorNavCapsule
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showRulesTab={showRulesTab}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex flex-1 flex-col min-h-0"
        >
          <Suspense fallback={<PanelFallback />}>
            {activeTab === 'dashboard' && <BehaviorDashboardPanel academicYearId={year} />}
            {activeTab === 'list' && <BehaviorStudentListPanel academicYearId={year} />}
            {activeTab === 'report' && <BehaviorReportPanel academicYearId={year} />}
            {activeTab === 'rules' && showRulesTab && <BehaviorRulesPanel />}
            {activeTab === 'rules' && !showRulesTab && (
              <p className="py-16 text-center text-sm font-bold text-slate-400">
                ไม่มีสิทธิ์จัดการระเบียบโรงเรียน
              </p>
            )}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
