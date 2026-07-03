import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineCheckCircle,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlinePaperAirplane,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { useMyFuturePlan, useSaveFuturePlan } from '@/hooks/useFuturePlan';
import type { FuturePlanFormData, UniversityChoice } from '@/types/futurePlan';
import {
  FuturePlanStepIndicator,
  type FuturePlanStepMeta,
} from '@/features/futurePlan/components/FuturePlanStepIndicator';
import { UniversityChoiceFields } from '@/features/futurePlan/components/UniversityChoiceFields';
import { FuturePlanSummaryPanel } from '@/features/futurePlan/components/FuturePlanSummaryPanel';
import { FuturePlanStudentProfilePanel } from '@/features/futurePlan/components/FuturePlanStudentProfilePanel';
import {
  FuturePlanStatusBadge,
} from '@/features/futurePlan/components/FuturePlanStatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { glassStyles } from '@/lib/designTokens';
import { fp } from '@/features/futurePlan/futurePlanTheme';
import { cn } from '@/lib/utils';

type NoticeVariant = 'error' | 'success';

interface NoticeAlert {
  open: boolean;
  variant: NoticeVariant;
  title: string;
  message: string;
}

const RANKS = [1, 2, 3] as const;

const GOALS_STEP: FuturePlanStepMeta = {
  id: 1,
  title: 'เป้าหมายและแผนการศึกษาต่อ',
  shortTitle: 'เป้าหมาย',
};

const UNIVERSITY_STEPS: FuturePlanStepMeta[] = [
  { id: 2, title: 'มหาวิทยาลัย อันดับ 3', shortTitle: 'อันดับ 3' },
  { id: 3, title: 'มหาวิทยาลัย อันดับ 2', shortTitle: 'อันดับ 2' },
  { id: 4, title: 'มหาวิทยาลัย อันดับ 1', shortTitle: 'อันดับ 1' },
];

const SUMMARY_STEP: FuturePlanStepMeta = {
  id: 0,
  title: 'สรุปข้อมูล',
  shortTitle: 'สรุป',
};

const EMPTY_CHOICE = (rank: number): UniversityChoice => ({
  rank,
  universityName: '',
  universityDomain: '',
  faculty: '',
  program: '',
  entranceMethod: '',
  country: '',
});

const EMPTY_FORM = (): FuturePlanFormData => ({
  lifeGoal: '',
  desiredCareer: '',
  planType: 'continue',
  studyLocation: 'domestic',
  notContinueReason: '',
  universityChoices: RANKS.map((rank) => EMPTY_CHOICE(rank)),
});

function normalizeChoices(existing?: UniversityChoice[]): UniversityChoice[] {
  return RANKS.map((rank) => {
    const found = existing?.find((c) => c.rank === rank);
    return found ? { ...EMPTY_CHOICE(rank), ...found, rank } : EMPTY_CHOICE(rank);
  });
}

function stepToRank(step: number): number | null {
  if (step === 2) return 3;
  if (step === 3) return 2;
  if (step === 4) return 1;
  return null;
}

const PLAN_CHOICE_BTN =
  'flex h-full w-full min-h-[3rem] items-center justify-center px-2.5 py-2 rounded-xl text-center text-xs font-semibold leading-snug transition-all duration-200';

function blueChoiceBtnClasses(active: boolean) {
  return active
    ? 'bg-[#0056FF] text-white shadow-sm shadow-[#0056FF]/25'
    : 'bg-[#E3E7FC]/50 text-black/45 hover:bg-[#E3E7FC]/80';
}

function getSummaryStepId(planType: FuturePlanFormData['planType']) {
  return planType === 'continue' ? 5 : 2;
}

const TH_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function formatFuturePlanUpdatedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('th-TH', TH_DATE_OPTS);
}

export function StudentFuturePlanStepper() {
  const { data: existing, isLoading } = useMyFuturePlan();
  const { mutateAsync: save, isPending } = useSaveFuturePlan();
  const [form, setForm] = useState<FuturePlanFormData>(EMPTY_FORM());
  const [step, setStep] = useState(1);
  const [completedThrough, setCompletedThrough] = useState(0);
  const [saved, setSaved] = useState(false);
  const [notContinueModalOpen, setNotContinueModalOpen] = useState(false);
  const [notContinueReasonDraft, setNotContinueReasonDraft] = useState('');
  const [notContinueReasonError, setNotContinueReasonError] = useState('');
  const [notice, setNotice] = useState<NoticeAlert>({
    open: false,
    variant: 'error',
    title: '',
    message: '',
  });

  function showNotice(variant: NoticeVariant, title: string, message: string) {
    setNotice({ open: true, variant, title, message });
  }

  useEffect(() => {
    if (!existing) return;
    const planType = existing.planType;
    const summaryStep = getSummaryStepId(planType);
    setForm({
      lifeGoal: existing.lifeGoal,
      desiredCareer: existing.desiredCareer,
      planType,
      studyLocation: existing.studyLocation ?? 'domestic',
      notContinueReason: existing.notContinueReason ?? '',
      universityChoices: normalizeChoices(existing.universityChoices),
    });
    setStep(summaryStep);
    setCompletedThrough(summaryStep);
  }, [existing]);

  const activeSteps = useMemo(() => {
    const steps =
      form.planType === 'continue'
        ? [GOALS_STEP, ...UNIVERSITY_STEPS]
        : [GOALS_STEP];
    return [...steps, { ...SUMMARY_STEP, id: steps.length + 1 }];
  }, [form.planType]);

  const maxStep = activeSteps.length;

  useEffect(() => {
    if (step > maxStep) setStep(maxStep);
  }, [maxStep, step]);

  function handleChoiceChange(
    rank: number,
    field: keyof UniversityChoice,
    value: string,
  ) {
    setForm((prev) => {
      const idx = prev.universityChoices.findIndex((c) => c.rank === rank);
      if (idx < 0) return prev;
      const updated = [...prev.universityChoices];
      const next = { ...updated[idx], [field]: value };
      if (field === 'universityName') {
        next.faculty = '';
        next.program = '';
        if (!value.trim()) next.universityDomain = '';
      } else if (field === 'faculty') {
        next.program = '';
      }
      updated[idx] = next;
      return { ...prev, universityChoices: updated };
    });
  }

  function validateStepOneBasics(): boolean {
    if (!form.lifeGoal.trim()) {
      showNotice('error', 'ข้อมูลไม่ครบ', 'กรุณากรอกเป้าหมายในชีวิต');
      return false;
    }
    if (!form.desiredCareer.trim()) {
      showNotice('error', 'ข้อมูลไม่ครบ', 'กรุณากรอกอาชีพในฝัน');
      return false;
    }
    return true;
  }

  function openNotContinueModal() {
    if (!validateStepOneBasics()) return;
    setForm((p) => ({
      ...p,
      planType: 'not_continue',
      universityChoices: RANKS.map((rank) => EMPTY_CHOICE(rank)),
    }));
    setNotContinueReasonDraft(form.notContinueReason);
    setNotContinueReasonError('');
    setNotContinueModalOpen(true);
  }

  function handleNotContinueModalClose(open: boolean) {
    if (open) {
      setNotContinueModalOpen(true);
      return;
    }
    setNotContinueModalOpen(false);
    setNotContinueReasonError('');
    setForm((p) =>
      p.planType === 'not_continue' && !p.notContinueReason.trim()
        ? { ...p, planType: 'continue' }
        : p,
    );
  }

  async function handleNotContinueSubmit() {
    const reason = notContinueReasonDraft.trim();
    if (!reason) {
      setNotContinueReasonError('กรุณากรอกสาเหตุ');
      return;
    }
    if (!validateStepOneBasics()) return;

    const nextForm: FuturePlanFormData = {
      ...form,
      planType: 'not_continue',
      notContinueReason: reason,
      universityChoices: RANKS.map((rank) => EMPTY_CHOICE(rank)),
    };

    setForm(nextForm);
    setNotContinueReasonError('');

    try {
      await save({ form: nextForm });
      setSaved(true);
      setNotContinueModalOpen(false);
      const summaryStep = getSummaryStepId('not_continue');
      setStep(summaryStep);
      setCompletedThrough(summaryStep);
      showNotice('success', 'ส่งข้อมูลสำเร็จ', '');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      showNotice('error', 'เกิดข้อผิดพลาด', message);
    }
  }

  function validateForSubmit(): boolean {
    if (!validateStepOneBasics()) return false;

    if (form.planType === 'not_continue') {
      if (!form.notContinueReason.trim()) {
        showNotice('error', 'ข้อมูลไม่ครบ', 'กรุณากรอกสาเหตุที่ไม่ศึกษาต่อ');
        return false;
      }
      return true;
    }

    const rank1 = form.universityChoices.find((c) => c.rank === 1);
    if (!rank1?.universityName.trim()) {
      showNotice('error', 'ข้อมูลไม่ครบ', 'กรุณาเลือกมหาวิทยาลัยอันดับ 1');
      return false;
    }
    return true;
  }

  function validateCurrentStep(): boolean {
    switch (step) {
      case 1:
        return validateStepOneBasics();
      case 4: {
        const rank1 = form.universityChoices.find((c) => c.rank === 1);
        if (!rank1?.universityName.trim()) {
          showNotice('error', 'ข้อมูลไม่ครบ', 'กรุณาเลือกมหาวิทยาลัยอันดับ 1');
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }

  async function handleSubmit() {
    if (!validateForSubmit()) return;
    try {
      await save({ form });
      setSaved(true);
      setStep(maxStep);
      setCompletedThrough(maxStep);
      showNotice('success', 'ส่งข้อมูลสำเร็จ', '');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      showNotice('error', 'เกิดข้อผิดพลาด', message);
    }
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (step === 1 && form.planType === 'not_continue') {
      openNotContinueModal();
      return;
    }
    setCompletedThrough((prev) => Math.max(prev, step));
    if (step >= maxStep) {
      void handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#E3E7FC] border-t-[#0056FF] rounded-full animate-spin" />
      </div>
    );
  }

  const rankForStep = stepToRank(step);
  const choiceForStep =
    rankForStep !== null
      ? form.universityChoices.find((c) => c.rank === rankForStep)
      : undefined;
  const isLastStep = step === maxStep;
  const hideOuterCard = isLastStep || rankForStep !== null;

  const formattedUpdatedAt = formatFuturePlanUpdatedAt(existing?.updatedAt);
  const lastUpdatedLabel = formattedUpdatedAt ? `บันทึกล่าสุด ${formattedUpdatedAt}` : undefined;

  return (
    <div className={cn('mx-auto pb-28 lg:pb-32 space-y-5', isLastStep ? 'max-w-lg' : 'max-w-2xl')}>
      <FuturePlanStudentProfilePanel variant={isLastStep ? 'profile' : 'card'} />

      {existing && !isLastStep && (
        <FuturePlanStatusBadge
          variant="submitted"
          size="md"
          icon={<HiOutlinePaperAirplane size={14} />}
          className="w-full justify-center py-2"
        >
          บันทึกล่าสุด:{' '}
          {formattedUpdatedAt ?? '–'}
        </FuturePlanStatusBadge>
      )}

      {!isLastStep && (
        <div className="rounded-3xl p-5 sm:p-6" style={glassStyles.card}>
          <FuturePlanStepIndicator
            steps={activeSteps}
            currentStep={step}
            completedThrough={completedThrough}
          />
        </div>
      )}

      <div
        className={cn(
          'space-y-5',
          !hideOuterCard && 'rounded-3xl p-5 sm:p-6',
        )}
        style={hideOuterCard ? undefined : glassStyles.card}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className={fp.label}>
                      เป้าหมายในชีวิต
                    </label>
                    <span className="text-[11px] font-semibold text-black/40 tabular-nums">
                      {form.lifeGoal.length}/50
                    </span>
                  </div>
                  <textarea
                    value={form.lifeGoal}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lifeGoal: e.target.value.slice(0, 50) }))
                    }
                    maxLength={50}
                    rows={4}
                    autoFocus
                    placeholder="เขียนสิ่งที่คุณอยากทำ อยากเป็น หรืออยากบรรลุในชีวิต..."
                    className={cn(fp.input, 'px-4 py-3 resize-none')}
                  />
                </div>
                <div className="space-y-2">
                  <label className={fp.label}>
                    อาชีพในฝัน
                  </label>
                  <input
                    value={form.desiredCareer}
                    onChange={(e) => setForm((p) => ({ ...p, desiredCareer: e.target.value }))}
                    placeholder="เช่น วิศวกรซอฟต์แวร์, แพทย์, นักออกแบบ..."
                    className={cn(fp.input, 'px-4 py-3')}
                  />
                </div>

                <div className="border-t border-[#E3E7FC]/80 pt-5 space-y-4">
                  <p className={fp.label}>แผนหลังจบการศึกษา</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'continue' as const, label: 'ต้องการศึกษาต่อ' },
                        { value: 'not_continue' as const, label: 'ไม่ต้องการศึกษาต่อ' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (opt.value === 'not_continue') {
                            openNotContinueModal();
                            return;
                          }
                          setNotContinueModalOpen(false);
                          setForm((p) => ({
                            ...p,
                            planType: opt.value,
                            notContinueReason: '',
                            universityChoices: p.universityChoices,
                          }));
                        }}
                        className={cn(
                          PLAN_CHOICE_BTN,
                          blueChoiceBtnClasses(form.planType === opt.value),
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {form.planType === 'continue' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 overflow-hidden"
                    >
                      <p className={fp.label}>
                        ประเภทการศึกษาต่อ
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { value: 'domestic' as const, label: 'ในประเทศ' },
                            { value: 'international' as const, label: 'นอกประเทศ' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                studyLocation: opt.value,
                                universityChoices: RANKS.map((rank) => EMPTY_CHOICE(rank)),
                              }))
                            }
                            className={cn(
                              PLAN_CHOICE_BTN,
                              blueChoiceBtnClasses(form.studyLocation === opt.value),
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {rankForStep !== null && choiceForStep && (
              <UniversityChoiceFields
                choice={choiceForStep}
                studyLocation={form.studyLocation}
                onChange={(field, value) => handleChoiceChange(rankForStep, field, value)}
              />
            )}

            {step === maxStep && (
              <FuturePlanSummaryPanel form={form} lastUpdatedLabel={lastUpdatedLabel} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div
          className="pointer-events-auto border-t border-white/60 bg-white/85 backdrop-blur-xl shadow-[0_-8px_30px_rgba(15,23,42,0.08)]"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={isPending}
                aria-label="ย้อนกลับ"
                className={cn('size-12', fp.btnCircle)}
              >
                <HiOutlineChevronLeft size={22} />
              </button>
            ) : (
              <span className="size-12" aria-hidden />
            )}

            {isLastStep ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isPending}
                aria-label={
                  isPending
                    ? 'กำลังส่งข้อมูล'
                    : saved
                      ? 'ส่งแล้ว'
                      : existing
                        ? 'บันทึกการแก้ไข'
                        : 'ส่งข้อมูล'
                }
                className={cn(
                  'flex items-center justify-center gap-2 h-12 min-w-[9.5rem] px-6 rounded-full font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-md text-white',
                  saved
                    ? 'bg-[#2277FF] hover:bg-[#0056FF] shadow-[#2277FF]/30'
                    : 'bg-[#0056FF] hover:bg-[#004AD4] shadow-[#0056FF]/30',
                )}
              >
                {isPending ? (
                  <>
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังส่ง...
                  </>
                ) : saved ? (
                  <>
                    <HiOutlineCheckCircle size={20} />
                    ส่งแล้ว
                  </>
                ) : existing ? (
                  <>
                    <HiOutlinePaperAirplane size={18} />
                    บันทึกการแก้ไข
                  </>
                ) : (
                  <>
                    <HiOutlinePaperAirplane size={18} />
                    ส่งข้อมูล
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={isPending}
                aria-label="ถัดไป"
                className={cn('size-12', fp.btnCircle)}
              >
                <HiOutlineChevronRight size={22} />
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={notContinueModalOpen} onOpenChange={handleNotContinueModalClose}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            'max-w-[min(28rem,calc(100%-3rem))] rounded-[2rem] border border-white/60 bg-white/95 py-6 px-7 shadow-2xl backdrop-blur-xl',
            'gap-4 sm:max-w-md',
          )}
        >
          <DialogTitle className="sr-only">ไม่ต้องการศึกษาต่อ</DialogTitle>
          <DialogDescription className="sr-only">
            กรอกสาเหตุที่ไม่ต้องการศึกษาต่อ
          </DialogDescription>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className={cn(fp.labelDark, 'text-sm')}>สาเหตุ</label>
              <span className="text-xs font-semibold text-black/40 tabular-nums">
                {notContinueReasonDraft.length}/50
              </span>
            </div>
            <textarea
              value={notContinueReasonDraft}
              onChange={(e) => {
                setNotContinueReasonDraft(e.target.value.slice(0, 50));
                if (notContinueReasonError) setNotContinueReasonError('');
              }}
              maxLength={50}
              rows={5}
              autoFocus
              placeholder="เช่น ต้องการทำงาน, เรียนฝีมือแรงงาน..."
              className={cn(fp.input, 'px-4 py-3.5 text-sm resize-none w-full min-h-[7.5rem]')}
            />
            {notContinueReasonError && (
              <p className="text-xs font-semibold text-rose-600">{notContinueReasonError}</p>
            )}
          </div>

          <DialogFooter className="mt-1 sm:justify-stretch">
            <button
              type="button"
              onClick={() => void handleNotContinueSubmit()}
              disabled={isPending}
              className={cn(
                'h-12 w-full rounded-2xl font-bold text-sm text-white inline-flex items-center justify-center gap-2',
                'bg-[#0056FF] hover:bg-[#004AD4] disabled:opacity-50',
              )}
            >
              {isPending ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <HiOutlinePaperAirplane size={16} />
                  ส่งข้อมูล
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={notice.open} onOpenChange={(open) => setNotice((prev) => ({ ...prev, open }))}>
        <AlertDialogContent className="max-w-sm rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogMedia
              className={cn(
                'mb-1',
                notice.variant === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600',
              )}
            >
              {notice.variant === 'success' ? (
                <HiOutlineCheckCircle className="size-8" />
              ) : (
                <HiOutlineExclamationTriangle className="size-8" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle
              className={cn(
                'text-lg font-bold',
                notice.variant === 'success' ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {notice.title}
            </AlertDialogTitle>
            {notice.message ? (
              <AlertDialogDescription className="text-sm text-black/60">
                {notice.message}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogAction
              className={cn(
                'h-11 w-full rounded-2xl font-bold text-white',
                notice.variant === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#0056FF] hover:bg-[#004AD4]',
              )}
            >
              ตกลง
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
