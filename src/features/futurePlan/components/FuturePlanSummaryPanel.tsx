import { HiOutlineGlobeAlt } from 'react-icons/hi2';
import type { FuturePlanFormData } from '@/types/futurePlan';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import { DetailViewField } from '@/features/students/components/studentDetailFormShared';

const PLAN_TYPE_LABEL = {
  continue: 'ต้องการศึกษาต่อ',
  not_continue: 'ไม่ต้องการศึกษาต่อ',
} as const;

const STUDY_LOCATION_LABEL = {
  domestic: 'ในประเทศ',
  international: 'นอกประเทศ',
} as const;

function SummaryField({ label, value }: { label: string; value: string }) {
  const isEmpty = !value.trim();

  return (
    <div className="space-y-1">
      <label className="text-[12px] font-black text-slate-700">{label}</label>
      {isEmpty ? (
        <DetailViewField value={value} />
      ) : (
        <div className="rounded-xl border-2 border-white bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm">
          {value}
        </div>
      )}
    </div>
  );
}

export function FuturePlanSummaryPanel({
  form,
  lastUpdatedLabel,
}: {
  form: FuturePlanFormData;
  lastUpdatedLabel?: string;
}) {
  const sortedChoices = [...form.universityChoices].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-5">
      {lastUpdatedLabel ? (
        <div className="flex justify-center">
          <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-600">
            {lastUpdatedLabel}
          </span>
        </div>
      ) : null}

      <section className="rounded-3xl bg-slate-50/90 p-4 sm:p-5">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <SummaryField label="เป้าหมายในชีวิต" value={form.lifeGoal} />
            <SummaryField label="อาชีพในฝัน" value={form.desiredCareer} />
          </div>

          <div className="h-px bg-slate-100" />

          <div className="grid grid-cols-1 gap-4">
            <SummaryField label="ประเภทแผน" value={PLAN_TYPE_LABEL[form.planType]} />
            {form.planType === 'continue' && (
              <SummaryField
                label="สถานที่ศึกษา"
                value={STUDY_LOCATION_LABEL[form.studyLocation]}
              />
            )}
            {form.planType === 'not_continue' && form.notContinueReason.trim() && (
              <SummaryField
                label="สาเหตุที่ไม่ศึกษาต่อ"
                value={form.notContinueReason}
              />
            )}
          </div>

          {form.planType === 'continue' && (
            <>
              <div className="h-px bg-slate-100" />

              <div className="space-y-3">
                {sortedChoices.map((choice) => {
                  const hasSelection = Boolean(choice.universityName.trim());

                  return (
                    <div
                      key={choice.rank}
                      className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        {form.studyLocation === 'domestic' ? (
                          <UniversityLogo
                            domain={choice.universityDomain}
                            label={choice.universityName}
                            size="md"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <HiOutlineGlobeAlt className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black uppercase tracking-wide text-blue-600">
                            อันดับ {choice.rank}
                          </p>
                          <p className="truncate text-sm font-black text-slate-900">
                            {hasSelection ? choice.universityName : 'ยังไม่ได้เลือก'}
                          </p>
                        </div>
                      </div>

                      {hasSelection && (
                        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-3">
                          {form.studyLocation === 'international' && choice.country && (
                            <SummaryField label="ประเทศ" value={choice.country} />
                          )}
                          {choice.faculty && (
                            <SummaryField label="คณะ" value={choice.faculty} />
                          )}
                          {choice.program && (
                            <SummaryField label="สาขาวิชา" value={choice.program} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
