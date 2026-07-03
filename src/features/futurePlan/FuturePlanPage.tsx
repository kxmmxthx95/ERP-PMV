import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  HiAcademicCap,
  HiOutlineArrowDownTray,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useAllFuturePlans } from '@/hooks/useFuturePlan';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { StudentFuturePlanStepper } from '@/features/futurePlan/components/StudentFuturePlanStepper';
import { FuturePlanAdminDashboard } from '@/features/futurePlan/components/FuturePlanAdminDashboard';
import { UniversityLogoSettingsModal } from '@/features/futurePlan/components/UniversityLogoSettingsModal';
import { loadMytcasCatalog } from '@/data/mytcasUniversities';
import { cn } from '@/lib/utils';
import { fp } from '@/features/futurePlan/futurePlanTheme';

function AdminAnalyticsView() {
  const { data: plans = [], isLoading } = useAllFuturePlans();
  const { canEdit } = useMyPermissions();
  const canManageLogos = canEdit('futurePlan');
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false);
  const [headerRightEl, setHeaderRightEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderRightEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  function exportCsv() {
    const rows: string[][] = [
      ['ชื่อ-นามสกุล', 'รหัสนักเรียน', 'ห้อง', 'เป้าหมายชีวิต', 'อาชีพที่ต้องการ', 'แผน', 'อันดับ1 มหาลัย', 'อันดับ1 คณะ', 'อันดับ2 มหาลัย', 'อันดับ2 คณะ', 'อันดับ3 มหาลัย', 'อันดับ3 คณะ'],
    ];
    plans.forEach((p) => {
      const byRank = (rank: number) => p.universityChoices?.find((c) => c.rank === rank);
      const c1 = byRank(1);
      const c2 = byRank(2);
      const c3 = byRank(3);
      rows.push([
        p.studentName,
        p.studentCode,
        p.className ?? '',
        p.lifeGoal,
        p.desiredCareer,
        p.planType === 'continue' ? 'ศึกษาต่อ' : 'ไม่ศึกษาต่อ',
        c1?.universityName ?? '',
        c1?.faculty ?? '',
        c2?.universityName ?? '',
        c2?.faculty ?? '',
        c3?.universityName ?? '',
        c3?.faculty ?? '',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'future_plans.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportCsvButton = (iconOnly = false) => (
    <button
      type="button"
      onClick={exportCsv}
      disabled={plans.length === 0}
      title="ส่งออก CSV"
      className={cn(
        'flex items-center justify-center transition-all disabled:opacity-40 active:scale-95 pointer-events-auto',
        iconOnly ? 'w-9 h-9 rounded-full shrink-0' : 'gap-2 px-4 py-2 rounded-full text-[11px] font-bold',
        fp.btnPrimary,
      )}
    >
      <HiOutlineArrowDownTray size={iconOnly ? 18 : 16} />
      {!iconOnly && 'ส่งออก CSV'}
    </button>
  );

  const settingsButton = () => (
    <button
      type="button"
      onClick={() => setLogoSettingsOpen(true)}
      title="ตั้งค่า Logo มหาวิทยาลัย"
      className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-slate-600 hover:bg-black/[0.04] transition-all active:scale-95 pointer-events-auto"
    >
      <HiOutlineCog6Tooth size={18} />
    </button>
  );

  const headerActionsPortal = (
    <>
      {headerRightEl && createPortal(
        <div className="hidden lg:flex items-center gap-2">
          {canManageLogos && settingsButton()}
          {exportCsvButton()}
        </div>,
        headerRightEl,
      )}
      {headerMobileActionsEl && createPortal(
        <div className="flex items-center gap-1">
          {canManageLogos && settingsButton()}
          {exportCsvButton(true)}
        </div>,
        headerMobileActionsEl,
      )}
      {canManageLogos && (
        <UniversityLogoSettingsModal
          open={logoSettingsOpen}
          onOpenChange={setLogoSettingsOpen}
        />
      )}
    </>
  );

  if (isLoading) {
    return (
      <>
        {headerActionsPortal}
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#E3E7FC] border-t-[#0056FF] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      {headerActionsPortal}
      <FuturePlanAdminDashboard plans={plans} />
    </>
  );
}

function PortalMenuHeader({ title }: { title: string }) {
  const [mobileEl, setMobileEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  if (!mobileEl) return null;

  return createPortal(
    <div className="md:hidden pointer-events-auto flex items-center gap-1.5">
      <HiAcademicCap className="w-4 h-4 text-[#000000] shrink-0" />
      <span className="text-[13px] font-black text-[#000000] tracking-tight leading-none whitespace-nowrap">
        {title}
      </span>
    </div>,
    mobileEl,
  );
}

export default function FuturePlanPage() {
  const { role } = useAuth();
  const isStudent = role === 'student';
  const menuTitle = isStudent ? 'แผนการศึกษาต่อ' : 'วิเคราะห์การศึกษาต่อ';

  useEffect(() => {
    void loadMytcasCatalog();
  }, []);

  return (
    <>
      <PortalMenuHeader title={menuTitle} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {isStudent ? <StudentFuturePlanStepper /> : <AdminAnalyticsView />}
      </motion.div>
    </>
  );
}
