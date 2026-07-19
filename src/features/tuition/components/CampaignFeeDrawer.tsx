import { useEffect, useMemo, useState } from 'react';
import { HiOutlineExclamationTriangle, HiOutlineTrash, HiXMark } from 'react-icons/hi2';
import { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { cn } from '@/lib/utils';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { computeNetPayable, computeTotalDiscount, formatTHB, sumFeeItems } from '../tuitionCalc';
import {
  feeProfileKey,
  tuitionTermLabel,
  type Installment,
  type Scholarship,
  type TuitionCampaign,
  type TuitionFeeProfile,
} from '@/types/tuition';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-lg',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

const inputCls = cn(modalInputCls, 'h-10 rounded-xl border-none px-3.5 text-xs font-bold');
const labelCls = cn(modalLabelCls, 'mb-1.5 px-0 tracking-wider');
const sectionLabelCls = cn(modalLabelCls, 'mb-2 px-0 tracking-wider');

const DEPARTMENTS = Object.keys(DEPARTMENT_CONFIG) as Department[];

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneProfile(profile: TuitionFeeProfile): TuitionFeeProfile {
  return {
    ...profile,
    feeItems: profile.feeItems.map((item) => ({ ...item })),
    scholarships: (profile.scholarships ?? []).map((item) => ({ ...item })),
    installments: (profile.installments ?? []).map((item) => ({ ...item })),
  };
}

function cloneFeeStructure(
  source: Pick<TuitionFeeProfile, 'feeItems' | 'scholarships' | 'installments'>,
): Pick<TuitionFeeProfile, 'feeItems' | 'scholarships' | 'installments'> {
  return {
    feeItems: source.feeItems.map((item) => ({ ...item, id: makeId() })),
    scholarships: (source.scholarships ?? []).map((item) => ({ ...item, id: makeId() })),
    installments: (source.installments ?? []).map((item) => ({
      ...item,
      id: makeId(),
      status: 'unpaid' as const,
      paidAmount: 0,
    })),
  };
}

function copyTargetKey(curriculumPackageId: string | null): string {
  return curriculumPackageId ?? '_general';
}

function seedProfilesFromCampaign(campaign: TuitionCampaign): TuitionFeeProfile[] {
  if (campaign.feeProfiles?.length) {
    return campaign.feeProfiles.map(cloneProfile);
  }

  const base = {
    feeItems: (campaign.defaultFeeItems ?? []).map((item) => ({ ...item })),
    scholarships: (campaign.defaultScholarships ?? []).map((item) => ({ ...item })),
    installments: (campaign.defaultInstallments ?? []).map((item) => ({ ...item })),
  };

  return DEPARTMENTS.map((departmentId) => ({
    departmentId,
    curriculumPackageId: null,
    ...base,
  }));
}

interface CampaignFeeDrawerProps {
  open: boolean;
  onClose: () => void;
  campaign: TuitionCampaign;
  onSave: (patch: { feeProfiles: TuitionFeeProfile[] }) => Promise<void>;
  isSaving?: boolean;
}

export default function CampaignFeeDrawer({
  open,
  onClose,
  campaign,
  onSave,
  isSaving,
}: CampaignFeeDrawerProps) {
  const { versions } = useCurriculumVersioned();
  const [profiles, setProfiles] = useState<TuitionFeeProfile[]>([]);
  const [activeDepartment, setActiveDepartment] = useState<Department>('primary');
  const [activeCurriculumId, setActiveCurriculumId] = useState<string | null>(null);
  const [copyTargetKeys, setCopyTargetKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const nextProfiles = seedProfilesFromCampaign(campaign);
    setProfiles(nextProfiles);
    setActiveDepartment('primary');
    setActiveCurriculumId(null);
    setCopyTargetKeys(new Set());
  }, [open, campaign]);

  useEffect(() => {
    setCopyTargetKeys(new Set());
  }, [activeDepartment, activeCurriculumId]);

  const curriculumsForDept = useMemo(() => {
    return versions
      .filter((v) => !v.department || v.department === activeDepartment)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
  }, [versions, activeDepartment]);

  const activeProfile = useMemo(() => {
    const key = feeProfileKey(activeDepartment, activeCurriculumId);
    const found = profiles.find(
      (p) => feeProfileKey(p.departmentId, p.curriculumPackageId) === key,
    );
    if (found) return found;

    const deptDefault = profiles.find(
      (p) => p.departmentId === activeDepartment && p.curriculumPackageId === null,
    );
    if (deptDefault && activeCurriculumId) {
      return {
        departmentId: activeDepartment,
        curriculumPackageId: activeCurriculumId,
        feeItems: deptDefault.feeItems.map((item) => ({ ...item })),
        scholarships: (deptDefault.scholarships ?? []).map((item) => ({ ...item })),
        installments: (deptDefault.installments ?? []).map((item) => ({ ...item })),
      };
    }

    return {
      departmentId: activeDepartment,
      curriculumPackageId: activeCurriculumId,
      feeItems: [],
      scholarships: [],
      installments: [],
    };
  }, [profiles, activeDepartment, activeCurriculumId]);

  const totalFee = sumFeeItems(activeProfile.feeItems);
  const totalDiscount = computeTotalDiscount(totalFee, activeProfile.scholarships ?? []);
  const netPayable = computeNetPayable(totalFee, activeProfile.scholarships ?? []);
  const installmentSum = (activeProfile.installments ?? []).reduce((sum, i) => sum + i.amount, 0);
  const installmentMismatch =
    (activeProfile.installments?.length ?? 0) > 0 && installmentSum !== netPayable;

  const hasValidProfiles = useMemo(() => {
    return profiles.some((profile) => {
      const items = profile.feeItems.filter((item) => item.label.trim() || item.amount > 0);
      if (items.length === 0) return false;
      const fee = sumFeeItems(items);
      const net = computeNetPayable(fee, profile.scholarships ?? []);
      const instSum = (profile.installments ?? []).reduce((sum, i) => sum + i.amount, 0);
      const mismatch = (profile.installments?.length ?? 0) > 0 && instSum !== net;
      return !mismatch;
    });
  }, [profiles]);

  const canSave = hasValidProfiles && !installmentMismatch;

  const copyCandidates = useMemo(() => {
    const options: { key: string; curriculumPackageId: string | null; label: string }[] = [];
    if (activeCurriculumId !== null) {
      options.push({
        key: copyTargetKey(null),
        curriculumPackageId: null,
        label: 'ทั่วไป (ทุกหลักสูตรในแผนก)',
      });
    }
    for (const pkg of curriculumsForDept) {
      if (pkg.id === activeCurriculumId) continue;
      options.push({
        key: copyTargetKey(pkg.id),
        curriculumPackageId: pkg.id,
        label: `${pkg.name}${pkg.level ? ` · ${pkg.level}` : ''}`,
      });
    }
    return options;
  }, [curriculumsForDept, activeCurriculumId]);

  const canCopyFees = activeProfile.feeItems.some((item) => item.label.trim() || item.amount > 0);

  function toggleCopyTarget(key: string) {
    setCopyTargetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyFeesToSelectedCurricula() {
    if (copyTargetKeys.size === 0) return;

    const targets = copyCandidates.filter((option) => copyTargetKeys.has(option.key));
    if (targets.length === 0) return;

    setProfiles((prev) => {
      let next = [...prev];
      for (const target of targets) {
        const profile: TuitionFeeProfile = {
          departmentId: activeDepartment,
          curriculumPackageId: target.curriculumPackageId,
          ...cloneFeeStructure(activeProfile),
        };
        const idx = next.findIndex(
          (p) => feeProfileKey(p.departmentId, p.curriculumPackageId) === feeProfileKey(activeDepartment, target.curriculumPackageId),
        );
        if (idx >= 0) {
          next = next.map((p, i) => (i === idx ? profile : p));
        } else {
          next.push(profile);
        }
      }
      return next;
    });

    setCopyTargetKeys(new Set());
  }

  function upsertActiveProfile(patch: Partial<TuitionFeeProfile>) {
    const next: TuitionFeeProfile = { ...activeProfile, ...patch };
    const key = feeProfileKey(next.departmentId, next.curriculumPackageId);
    setProfiles((prev) => {
      const idx = prev.findIndex(
        (p) => feeProfileKey(p.departmentId, p.curriculumPackageId) === key,
      );
      if (idx >= 0) {
        return prev.map((p, i) => (i === idx ? next : p));
      }
      return [...prev, next];
    });
  }

  function splitEvenly(count: number) {
    const base = Math.floor((netPayable / count) / 10) * 10;
    const remainder = netPayable - base * count;
    const next: Installment[] = Array.from({ length: count }, (_, idx) => ({
      id: makeId(),
      label: `งวดที่ ${idx + 1}`,
      amount: idx === count - 1 ? base + remainder : base,
      dueDate: '',
      status: 'unpaid',
      paidAmount: 0,
    }));
    upsertActiveProfile({ installments: next });
  }

  async function handleSubmit() {
    const activeKey = feeProfileKey(activeDepartment, activeCurriculumId);
    const activeCleaned: TuitionFeeProfile = {
      ...activeProfile,
      departmentId: activeDepartment,
      curriculumPackageId: activeCurriculumId,
      feeItems: activeProfile.feeItems.filter((item) => item.label.trim() || item.amount > 0),
    };

    let mergedProfiles = [...profiles];
    if (activeCleaned.feeItems.length > 0) {
      const idx = mergedProfiles.findIndex(
        (p) => feeProfileKey(p.departmentId, p.curriculumPackageId) === activeKey,
      );
      if (idx >= 0) {
        mergedProfiles = mergedProfiles.map((p, i) => (i === idx ? activeCleaned : p));
      } else {
        mergedProfiles.push(activeCleaned);
      }
    }

    const cleaned = mergedProfiles
      .map((profile) => ({
        ...profile,
        feeItems: profile.feeItems.filter((item) => item.label.trim() || item.amount > 0),
      }))
      .filter((profile) => profile.feeItems.length > 0);

    await onSave({ feeProfiles: cleaned });
  }

  const activeCurriculumLabel = activeCurriculumId
    ? curriculumsForDept.find((c) => c.id === activeCurriculumId)?.name ?? 'หลักสูตร'
    : 'ทั่วไป (ทุกหลักสูตรในแผนก)';

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-left">
                <DrawerTitle className="text-base font-black text-slate-900">
                  กำหนดค่าเทอม / ทุนการศึกษา
                </DrawerTitle>
                <DrawerDescription className="text-xs font-semibold text-slate-500">
                  ปีการศึกษา {campaign.academicYearId} · {tuitionTermLabel(campaign.term)}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>แผนก</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        setActiveDepartment(dept);
                        setActiveCurriculumId(null);
                      }}
                      className={cn(
                        inputCls,
                        'h-9 w-auto px-3 text-[11px] font-bold transition-colors',
                        activeDepartment === dept
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      {DEPARTMENT_CONFIG[dept].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>หลักสูตร</label>
                <select
                  value={activeCurriculumId ?? ''}
                  onChange={(e) => setActiveCurriculumId(e.target.value || null)}
                  className={cn(inputCls, 'w-full appearance-none')}
                >
                  <option value="">ทั่วไป (ทุกหลักสูตรในแผนก)</option>
                  {curriculumsForDept.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                      {pkg.level ? ` · ${pkg.level}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                  กำลังตั้งค่า: {DEPARTMENT_CONFIG[activeDepartment].label} · {activeCurriculumLabel}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className={sectionLabelCls}>รายการค่าใช้จ่าย</label>
                  <button
                    type="button"
                    onClick={() =>
                      upsertActiveProfile({
                        feeItems: [...activeProfile.feeItems, { id: makeId(), label: '', amount: 0 }],
                      })
                    }
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มรายการ
                  </button>
                </div>
                <div className="space-y-2">
                  {activeProfile.feeItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) =>
                          upsertActiveProfile({
                            feeItems: activeProfile.feeItems.map((row, i) =>
                              i === idx ? { ...row, label: e.target.value } : row,
                            ),
                          })
                        }
                        placeholder="ชื่อรายการ เช่น ค่าธรรมเนียมการศึกษา"
                        className={cn(inputCls, 'flex-1')}
                      />
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) =>
                          upsertActiveProfile({
                            feeItems: activeProfile.feeItems.map((row, i) =>
                              i === idx ? { ...row, amount: Number(e.target.value) } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'w-28 text-right tabular-nums')}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          upsertActiveProfile({
                            feeItems: activeProfile.feeItems.filter((_, i) => i !== idx),
                          })
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-500">
                  รวม {formatTHB(totalFee)}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className={sectionLabelCls}>ทุนการศึกษา / ส่วนลด</label>
                  <button
                    type="button"
                    onClick={() =>
                      upsertActiveProfile({
                        scholarships: [
                          ...(activeProfile.scholarships ?? []),
                          { id: makeId(), label: '', type: 'percentage', value: 0 },
                        ],
                      })
                    }
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มทุน
                  </button>
                </div>
                {(activeProfile.scholarships ?? []).length === 0 && (
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">ไม่มีทุนการศึกษา</p>
                )}
                <div className="space-y-2">
                  {(activeProfile.scholarships ?? []).map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <input
                        value={s.label}
                        onChange={(e) =>
                          upsertActiveProfile({
                            scholarships: (activeProfile.scholarships ?? []).map((row, i) =>
                              i === idx ? { ...row, label: e.target.value } : row,
                            ),
                          })
                        }
                        placeholder="ชื่อทุน เช่น ทุนเรียนดี"
                        className={cn(inputCls, 'flex-1')}
                      />
                      <select
                        value={s.type}
                        onChange={(e) =>
                          upsertActiveProfile({
                            scholarships: (activeProfile.scholarships ?? []).map((row, i) =>
                              i === idx ? { ...row, type: e.target.value as Scholarship['type'] } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'w-28 appearance-none')}
                      >
                        <option value="percentage">เปอร์เซ็นต์</option>
                        <option value="fixed">จำนวนเงิน</option>
                      </select>
                      <input
                        type="number"
                        value={s.value}
                        onChange={(e) =>
                          upsertActiveProfile({
                            scholarships: (activeProfile.scholarships ?? []).map((row, i) =>
                              i === idx ? { ...row, value: Number(e.target.value) } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'w-24 text-right tabular-nums')}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          upsertActiveProfile({
                            scholarships: (activeProfile.scholarships ?? []).filter((_, i) => i !== idx),
                          })
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-right text-[11px] font-semibold text-emerald-600">
                  ส่วนลดรวม −{formatTHB(totalDiscount)}
                </p>
              </div>

              <div>
                <label className={sectionLabelCls}>แผนผ่อนชำระ</label>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => splitEvenly(n)}
                      className={cn(inputCls, 'h-9 w-auto px-3 text-[11px] font-bold text-slate-500 hover:text-slate-700')}
                    >
                      แบ่ง {n} งวด
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      upsertActiveProfile({
                        installments: [
                          ...(activeProfile.installments ?? []),
                          {
                            id: makeId(),
                            label: `งวดที่ ${(activeProfile.installments ?? []).length + 1}`,
                            amount: 0,
                            dueDate: '',
                            status: 'unpaid',
                            paidAmount: 0,
                          },
                        ],
                      })
                    }
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มงวด
                  </button>
                </div>
                {(activeProfile.installments ?? []).length === 0 && (
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">
                    ชำระเต็มจำนวนครั้งเดียว (ไม่มีการแบ่งงวด)
                  </p>
                )}
                <div className="space-y-2">
                  {(activeProfile.installments ?? []).map((inst, idx) => (
                    <div key={inst.id} className="flex items-center gap-2">
                      <input
                        value={inst.label}
                        onChange={(e) =>
                          upsertActiveProfile({
                            installments: (activeProfile.installments ?? []).map((row, i) =>
                              i === idx ? { ...row, label: e.target.value } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'w-28')}
                      />
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={(e) =>
                          upsertActiveProfile({
                            installments: (activeProfile.installments ?? []).map((row, i) =>
                              i === idx ? { ...row, amount: Number(e.target.value) } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'w-24 text-right tabular-nums')}
                      />
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) =>
                          upsertActiveProfile({
                            installments: (activeProfile.installments ?? []).map((row, i) =>
                              i === idx ? { ...row, dueDate: e.target.value } : row,
                            ),
                          })
                        }
                        className={cn(inputCls, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          upsertActiveProfile({
                            installments: (activeProfile.installments ?? []).filter((_, i) => i !== idx),
                          })
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {installmentMismatch && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <HiOutlineExclamationTriangle size={13} />
                    ยอดรวมงวด ({formatTHB(installmentSum)}) ไม่เท่ากับยอดสุทธิ ({formatTHB(netPayable)})
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-right">
                <p className={cn(labelCls, 'mb-1')}>ยอดสุทธิที่ต้องชำระ</p>
                <p className="text-base font-black text-slate-800">{formatTHB(netPayable)}</p>
              </div>

              {canCopyFees && copyCandidates.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-3.5 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className={cn(sectionLabelCls, 'mb-0')}>คัดลอกค่าธรรมเนียมไปยังหลักสูตรอื่น</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (copyTargetKeys.size === copyCandidates.length) {
                          setCopyTargetKeys(new Set());
                        } else {
                          setCopyTargetKeys(new Set(copyCandidates.map((option) => option.key)));
                        }
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                    >
                      {copyTargetKeys.size === copyCandidates.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  <p className="mb-2 text-[10px] font-semibold text-slate-500">
                    คัดลอกรายการค่าใช้จ่าย ทุน และแผนผ่อนจาก &quot;{activeCurriculumLabel}&quot;
                  </p>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto">
                    {copyCandidates.map((option) => {
                      const checked = copyTargetKeys.has(option.key);
                      return (
                        <label
                          key={option.key}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
                            checked ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCopyTarget(option.key)}
                            className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="line-clamp-2">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={copyFeesToSelectedCurricula}
                    disabled={copyTargetKeys.size === 0}
                    className="mt-3 h-9 w-full rounded-xl border border-blue-200 bg-white text-[11px] font-bold text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    คัดลอกไปยังหลักสูตรที่เลือก ({copyTargetKeys.size})
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSaving || !canSave}
              className="h-10 w-full rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              บันทึก
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
