import { useNavigate } from 'react-router-dom';
import {
  HiOutlineAcademicCap,
  HiOutlinePencilSquare,
} from 'react-icons/hi2';
import { WIDGET_CARD, WIDGET_GLASS, WIDGET_STAT_CELL, WIDGET_STAT_LABEL, WIDGET_STAT_VALUE } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { useMyFuturePlan, useAllFuturePlans } from '@/hooks/useFuturePlan';
import { FuturePlanStatusBadge } from '@/features/futurePlan/components/FuturePlanStatusBadge';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import { fpGradients, fpStatus } from '@/features/futurePlan/futurePlanTheme';
import { cn } from '@/lib/utils';

// ── Student view: show their own plan status ──────────────────────────────────
function StudentView() {
  const navigate = useNavigate();
  const { data: plan, isLoading } = useMyFuturePlan();
  const topChoice = plan?.universityChoices?.find((c) => c.rank === 1);

  if (isLoading) return <WidgetSkeleton variant="list" />;

  return (
    <div
      style={WIDGET_GLASS}
      className="rounded-2xl p-3 flex flex-col gap-2 relative overflow-hidden group cursor-pointer w-full"
      onClick={() => navigate('/portal/future-plan')}
    >
      <div
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-all duration-500"
        style={{ background: fpGradients.futurewave }}
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-800 leading-tight">แผนการศึกษาต่อ</p>
          <p className="text-[11px] text-slate-500">เป้าหมายและอาชีพในอนาคต</p>
        </div>
        <HiOutlinePencilSquare size={16} className="text-sky-400 group-hover:text-[#0056FF] transition-colors flex-shrink-0" />
      </div>

      {plan ? (
        <div className="space-y-2">
          <FuturePlanStatusBadge
            variant={plan.planType === 'continue' ? 'success' : 'expired'}
            icon={<HiOutlineAcademicCap size={13} />}
          >
            {plan.planType === 'continue' ? 'ต้องการศึกษาต่อ' : 'ไม่ต้องการศึกษาต่อ'}
          </FuturePlanStatusBadge>

          {plan.desiredCareer && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">อาชีพที่ต้องการ</p>
              <FuturePlanStatusBadge variant="inReview">{plan.desiredCareer}</FuturePlanStatusBadge>
            </div>
          )}

          {plan.planType === 'continue' && topChoice?.universityName && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">อันดับ 1</p>
              <div className="flex items-center gap-2 min-w-0">
                <UniversityLogo
                  domain={topChoice.universityDomain}
                  label={topChoice.universityName}
                  size="sm"
                  className="w-7 h-7 rounded-lg shrink-0"
                />
                <FuturePlanStatusBadge variant="inReview" size="md" className="min-w-0 truncate">
                  {topChoice.universityName}
                  {topChoice.faculty ? ` · ${topChoice.faculty}` : ''}
                </FuturePlanStatusBadge>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-dashed', fpStatus.pending.bg, fpStatus.pending.border)}>
          <HiOutlinePencilSquare size={15} className={cn('flex-shrink-0', fpStatus.pending.icon)} />
          <p className={cn('text-[12px] font-semibold', fpStatus.pending.text)}>แตะเพื่อกรอกข้อมูลของคุณ</p>
        </div>
      )}
    </div>
  );
}

// ── Admin/Teacher view: quick summary stats ───────────────────────────────────
function AdminView() {
  const navigate = useNavigate();
  const { data: plans = [], isLoading } = useAllFuturePlans();

  const continueCount = plans.filter((p) => p.planType === 'continue').length;
  const notContinueCount = plans.length - continueCount;

  if (isLoading) return <WidgetSkeleton />;

  return (
    <div
      style={WIDGET_GLASS}
      className={`${WIDGET_CARD} relative cursor-pointer group`}
      onClick={() => navigate('/portal/future-plan')}
    >
      <div
        className="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-25 pointer-events-none"
        style={{ background: fpGradients.futurewave }}
      />

      <div className="shrink-0 min-w-0">
        <p className="text-sm font-black text-slate-800 leading-tight truncate">วิเคราะห์การศึกษาต่อ</p>
        <p className="text-[10px] text-slate-500 truncate">ภาพรวมแผนของนักเรียน</p>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
          <div className={WIDGET_STAT_CELL}>
            <span className={`${WIDGET_STAT_VALUE} text-slate-800`}>{plans.length}</span>
            <span className={WIDGET_STAT_LABEL}>กรอกแล้ว</span>
          </div>
          <div className={WIDGET_STAT_CELL}>
            <span className={`${WIDGET_STAT_VALUE} text-sky-600`}>{continueCount}</span>
            <span className={WIDGET_STAT_LABEL}>ศึกษาต่อ</span>
          </div>
          <div className={WIDGET_STAT_CELL}>
            <span className={`${WIDGET_STAT_VALUE} text-slate-500`}>{notContinueCount}</span>
            <span className={WIDGET_STAT_LABEL}>ไม่ศึกษาต่อ</span>
          </div>
        </div>

      <p className="mt-auto text-[10px] font-bold text-sky-600 text-center shrink-0 group-hover:text-[#0056FF] transition-colors">
        ดูรายละเอียด →
      </p>
    </div>
  );
}

// ── Main export (role-aware) ──────────────────────────────────────────────────
export default function FuturePlanWidget() {
  const { role } = useAuth();
  return role === 'student' ? <StudentView /> : <AdminView />;
}
