import { motion } from 'framer-motion';
import { HiOutlineCheck } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { fpGradients, fpStatus } from '@/features/futurePlan/futurePlanTheme';

export interface FuturePlanStepMeta {
  id: number;
  title: string;
  shortTitle: string;
}

interface FuturePlanStepIndicatorProps {
  steps: FuturePlanStepMeta[];
  currentStep: number;
  completedThrough: number;
}

export function FuturePlanStepIndicator({
  steps,
  currentStep,
  completedThrough,
}: FuturePlanStepIndicatorProps) {
  const progress =
    steps.length <= 1 ? 0 : ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-black/45">
          ขั้นที่ {currentStep} / {steps.length}
        </p>
        <p className="text-[11px] font-bold text-black">
          {steps[currentStep - 1]?.shortTitle}
        </p>
      </div>

      <div className="relative h-1.5 rounded-full bg-[#E3E7FC] overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: fpGradients.futurewave }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-start justify-between gap-1">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isDone = step.id < currentStep || step.id <= completedThrough;
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all duration-200',
                  isActive &&
                    'border-[#0056FF] bg-[#0056FF] text-white shadow-md shadow-sky-300/50 scale-110',
                  !isActive && isDone && cn(fpStatus.success.border, fpStatus.success.bg, fpStatus.success.text),
                  !isActive && !isDone && 'border-slate-200 bg-white text-slate-300',
                )}
              >
                {isDone && !isActive ? <HiOutlineCheck size={14} /> : step.id}
              </div>
              <span
                className={cn(
                  'text-[9px] sm:text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full',
                  isActive ? 'text-black font-bold' : isDone ? 'text-black/55' : 'text-black/35',
                )}
              >
                {step.shortTitle}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
