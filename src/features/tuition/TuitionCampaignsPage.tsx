import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowRight, HiOutlineFolderOpen, HiOutlineTrash, HiPlus } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { cn } from '@/lib/utils';
import { useTuitionCampaigns } from './hooks/useTuitionCampaigns';
import CampaignSetupModal from './components/CampaignSetupModal';
import { TUITION_TERM_OPTIONS, defaultCampaignName, termsForCount, tuitionTermLabel, type TuitionCampaign, type TuitionTerm } from '@/types/tuition';

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

const STATUS_TONE: Record<TuitionCampaign['status'], string> = {
  active: 'bg-emerald-50 text-emerald-600',
  closed: 'bg-slate-100 text-slate-500',
};

function TermCard({
  campaign,
  onClick,
  onDelete,
  isDeleting,
}: {
  campaign: TuitionCampaign;
  onClick: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white/70 p-3.5 text-left transition-all hover:bg-white hover:shadow-md',
        isDeleting && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex flex-col gap-1.5 pr-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-800">{tuitionTermLabel(campaign.term)}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_TONE[campaign.status])}>
            {campaign.status === 'active' ? 'เปิดใช้งาน' : 'ปิดแล้ว'}
          </span>
        </div>
        <p className="truncate text-[11px] font-semibold text-slate-500">{campaign.name}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
      >
        ดูรายละเอียด
        <HiArrowRight size={12} />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          title={`ลบ${tuitionTermLabel(campaign.term)}`}
        >
          <HiOutlineTrash size={14} />
        </button>
      )}
    </div>
  );
}

function AddTermGhostCard({
  term,
  onClick,
  isAdding,
}: {
  term: TuitionTerm;
  onClick: () => void;
  isAdding?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isAdding}
      className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/10 p-3.5 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/30 disabled:pointer-events-none disabled:opacity-50"
    >
      {isAdding ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
      ) : (
        <HiPlus size={16} className="text-black/30" />
      )}
      <span className="text-[11px] font-bold text-black/40">เพิ่ม{tuitionTermLabel(term)}</span>
    </button>
  );
}

function AcademicYearCard({
  academicYearId,
  campaigns,
  onOpenCampaign,
  onAddTerm,
  onDeleteCampaign,
  onDelete,
  isDeleting,
  deletingCampaignId,
  addingTermKey,
}: {
  academicYearId: string;
  campaigns: TuitionCampaign[];
  onOpenCampaign: (id: string) => void;
  onAddTerm: (term: TuitionTerm) => void;
  onDeleteCampaign?: (campaign: TuitionCampaign) => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  deletingCampaignId?: string | null;
  addingTermKey?: string | null;
}) {
  const existingTerms = new Set(campaigns.map((c) => c.term));
  const missingTerms = TUITION_TERM_OPTIONS.filter((t) => !existingTerms.has(t.id));

  return (
    <div className={cn('rounded-3xl p-4 transition-opacity', isDeleting && 'pointer-events-none opacity-50')} style={GLASS_CARD}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-black text-slate-800">ปีการศึกษา {academicYearId}</p>
            <p className="text-[11px] text-black/40">{campaigns.length} ภาคเรียนที่ตั้งค่าแล้ว</p>
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
            title="ลบปีการศึกษานี้"
          >
            <HiOutlineTrash size={15} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {campaigns.map((campaign) => (
          <TermCard
            key={campaign.id}
            campaign={campaign}
            onClick={() => onOpenCampaign(campaign.id)}
            onDelete={onDeleteCampaign ? () => onDeleteCampaign(campaign) : undefined}
            isDeleting={deletingCampaignId === campaign.id}
          />
        ))}
        {missingTerms.map((t) => (
          <AddTermGhostCard
            key={t.id}
            term={t.id}
            onClick={() => onAddTerm(t.id)}
            isAdding={addingTermKey === `${academicYearId}:${t.id}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function TuitionCampaignsPage() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const { canEdit } = useMyPermissions();
  const { year } = useActiveAcademicYear();
  const { campaignsByYear, createCampaign, deleteCampaign, deleteAcademicYear, isSaving, isDeleting, isLoading } = useTuitionCampaigns();

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [deletingYearId, setDeletingYearId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [addingTermKey, setAddingTermKey] = useState<string | null>(null);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const existingYearIds = campaignsByYear.map((g) => g.academicYearId);
  const createdBy = userData?.name || user?.email || '';

  const handleAddTerm = async (academicYearId: string, term: TuitionTerm) => {
    const key = `${academicYearId}:${term}`;
    setAddingTermKey(key);
    try {
      await createCampaign({
        academicYearId,
        term,
        name: defaultCampaignName(academicYearId, term),
        defaultFeeItems: [],
        defaultDueDate: '',
        status: 'active',
        createdBy,
      });
    } finally {
      setAddingTermKey(null);
    }
  };

  const handleDeleteCampaign = async (campaign: TuitionCampaign) => {
    const confirmed = window.confirm(
      `ลบ${tuitionTermLabel(campaign.term)} ปีการศึกษา ${campaign.academicYearId}?\n\n` +
      `จะลบรอบ "${campaign.name}" ระเบียนค่าเทอมนักเรียน และประวัติการชำระเงินที่เกี่ยวข้อง\n` +
      'การกระทำนี้ไม่สามารถย้อนกลับได้',
    );
    if (!confirmed) return;

    setDeletingCampaignId(campaign.id);
    try {
      await deleteCampaign(campaign);
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const handleDeleteYear = async (academicYearId: string, campaignCount: number) => {
    const confirmed = window.confirm(
      `ลบปีการศึกษา ${academicYearId} ทั้งหมด?\n\n` +
      `จะลบรอบเก็บค่าเทอม ${campaignCount} ภาคเรียน ระเบียนค่าเทอมนักเรียน และประวัติการชำระเงินที่เกี่ยวข้อง\n` +
      'การกระทำนี้ไม่สามารถย้อนกลับได้',
    );
    if (!confirmed) return;

    setDeletingYearId(academicYearId);
    try {
      await deleteAcademicYear(academicYearId);
    } finally {
      setDeletingYearId(null);
    }
  };

  const newYearButton = canEdit('tuition') ? (
    <button
      type="button"
      onClick={() => setSetupModalOpen(true)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
      title="ปีการศึกษาใหม่"
      aria-label="ปีการศึกษาใหม่"
    >
      <HiPlus size={16} />
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-4 p-1">
      {isLgUp && headerRightActionsEl && newYearButton && createPortal(newYearButton, headerRightActionsEl)}
      {!isLgUp && headerMobileActionsEl && newYearButton && createPortal(newYearButton, headerMobileActionsEl)}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-500" />
        </div>
      )}

      {!isLoading && campaignsByYear.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-black/10 py-16 text-center">
          <HiOutlineFolderOpen size={28} className="text-black/25" />
          <p className="text-sm font-bold text-black/40">ยังไม่มีรอบเก็บค่าเทอมในระบบ</p>
          <p className="text-xs text-black/30">กด "ปีการศึกษาใหม่" เพื่อเริ่มตั้งค่าปีแรก</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {campaignsByYear.map((group, idx) => (
          <motion.div
            key={group.academicYearId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.05, 0.3) }}
          >
            <AcademicYearCard
              academicYearId={group.academicYearId}
              campaigns={group.campaigns}
              onOpenCampaign={(id) => navigate(`/portal/tuition/campaigns/${id}`)}
              onAddTerm={(term) => handleAddTerm(group.academicYearId, term)}
              onDeleteCampaign={canEdit('tuition') ? handleDeleteCampaign : undefined}
              onDelete={
                canEdit('tuition')
                  ? () => handleDeleteYear(group.academicYearId, group.campaigns.length)
                  : undefined
              }
              isDeleting={deletingYearId === group.academicYearId && isDeleting}
              deletingCampaignId={deletingCampaignId}
              addingTermKey={addingTermKey}
            />
          </motion.div>
        ))}
      </div>

      <CampaignSetupModal
        key={setupModalOpen ? 'open' : 'closed'}
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        defaultAcademicYearId={year}
        existingYearIds={existingYearIds}
        isSaving={isSaving}
        onCreate={async ({ academicYearId, termCount }) => {
          const terms = termsForCount(termCount);
          for (const term of terms) {
            await createCampaign({
              academicYearId,
              term,
              name: defaultCampaignName(academicYearId, term),
              defaultFeeItems: [],
              defaultDueDate: '',
              status: 'active',
              createdBy,
            });
          }
          setSetupModalOpen(false);
        }}
      />
    </div>
  );
}
