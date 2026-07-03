import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { HiOutlinePlus, HiOutlinePencilSquare, HiChevronLeft, HiChevronRight, HiOutlineHandThumbUp, HiOutlineHandThumbDown } from 'react-icons/hi2';
import { TbFilter2 } from 'react-icons/tb';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PermissionVisible } from '@/components/PermissionGate';
import { useBehaviorCatalog, useBehaviorCatalogActions } from '@/hooks/useBehaviorScore';
import type { BehaviorTemplate, BehaviorType, BehaviorSeverity, NewBehaviorTemplate } from '@/types/behavior';
import { cn } from '@/lib/utils';
import {
  BEHAVIOR_SEVERITY_OPTIONS,
  behaviorSeverityBadgeClass,
  compareBehaviorSeverity,
  getBehaviorSeverityLabel,
} from '../utils/behaviorSeverity';

const EMPTY_FORM: NewBehaviorTemplate = {
  label: '',
  points: 1,
  type: 'negative',
  severity: 'medium',
  isActive: true,
  order: 0,
};

const RULES_ITEMS_PER_PAGE = 8;

export default function BehaviorRulesPanel() {
  const { templates, loading, refresh } = useBehaviorCatalog();
  const { createTemplate, updateTemplate, toggleActive } = useBehaviorCatalogActions();

  const [editing, setEditing] = useState<BehaviorTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBehaviorTemplate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<BehaviorSeverity | 'all'>('all');
  const [activeCard, setActiveCard] = useState<'negative' | 'positive'>('negative');
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsMdOrBelow(!mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const positiveTemplates = templates.filter((t) => t.type === 'positive');
  const negativeTemplates = templates.filter((t) => t.type === 'negative');
  const filteredNegativeTemplates = useMemo(() => {
    const list =
      severityFilter === 'all'
        ? negativeTemplates
        : negativeTemplates.filter((t) => (t.severity ?? 'medium') === severityFilter);

    return [...list].sort((a, b) => {
      const bySeverity = compareBehaviorSeverity(a.severity, b.severity);
      if (bySeverity !== 0) return bySeverity;
      const byPoints = Math.abs(a.points) - Math.abs(b.points);
      if (byPoints !== 0) return byPoints;
      return (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label, 'th');
    });
  }, [negativeTemplates, severityFilter]);

  const cardSwitchPortal = isMdOrBelow && headerMobileActionsEl && createPortal(
    <button
      type="button"
      onClick={() => setActiveCard((card) => (card === 'negative' ? 'positive' : 'negative'))}
      title={activeCard === 'negative' ? 'ดูถูกระเบียบ (คะแนนบวก)' : 'ดูผิดระเบียบ (คะแนนลบ)'}
      aria-label={activeCard === 'negative' ? 'สลับไปถูกระเบียบ' : 'สลับไปผิดระเบียบ'}
      className={cn(
        'pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-black shadow-sm transition-colors active:scale-95',
        activeCard === 'negative'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      {activeCard === 'negative' ? (
        <>
          <HiOutlineHandThumbUp className="h-4 w-4 shrink-0" />
          <span>ถูกระเบียบ</span>
        </>
      ) : (
        <>
          <HiOutlineHandThumbDown className="h-4 w-4 shrink-0" />
          <span>ผิดระเบียบ</span>
        </>
      )}
    </button>,
    headerMobileActionsEl,
  );

  function openCreateForm(type: BehaviorType = 'negative') {
    setEditing(null);
    setForm({ ...EMPTY_FORM, type });
    setShowForm(true);
  }

  function openEditForm(t: BehaviorTemplate) {
    setEditing(t);
    setForm({
      label: t.label,
      points: t.points,
      type: t.type,
      severity: t.type === 'negative' ? (t.severity ?? 'medium') : undefined,
      isActive: t.isActive,
      order: t.order,
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.label.trim()) {
      toast.error('กรุณากรอกชื่อรายการ');
      return;
    }
    const signedPoints = form.type === 'positive' ? Math.abs(form.points) : -Math.abs(form.points);
    const payload: NewBehaviorTemplate = {
      ...form,
      points: signedPoints,
      severity: form.type === 'negative' ? (form.severity ?? 'medium') : undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, payload);
        toast.success('แก้ไขกฎระเบียบแล้ว');
      } else {
        await createTemplate(payload);
        toast.success('เพิ่มกฎระเบียบแล้ว');
      }
      setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(t: BehaviorTemplate) {
    try {
      await toggleActive(t.id, !t.isActive);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ');
    }
  }

  function RuleSection({
    title,
    subtitle,
    items,
    tone,
    onAdd,
    severityFilter: activeSeverityFilter,
    onSeverityFilterChange,
  }: {
    title: string;
    subtitle: string;
    items: BehaviorTemplate[];
    tone: 'positive' | 'negative';
    onAdd: () => void;
    severityFilter?: BehaviorSeverity | 'all';
    onSeverityFilterChange?: (value: BehaviorSeverity | 'all') => void;
  }) {
    const [severityMenuOpen, setSeverityMenuOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pointColor = tone === 'positive' ? 'text-emerald-600' : 'text-rose-600';
    const activeBg = tone === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600';
    const isSeverityFilterActive = activeSeverityFilter !== undefined && activeSeverityFilter !== 'all';

    const severityFilterOptions: Array<{ value: BehaviorSeverity | 'all'; label: string }> = [
      { value: 'all', label: 'ทั้งหมด' },
      ...BEHAVIOR_SEVERITY_OPTIONS,
    ];

    const totalPages = Math.max(1, Math.ceil(items.length / RULES_ITEMS_PER_PAGE));
    const paginatedItems = useMemo(() => {
      const start = (currentPage - 1) * RULES_ITEMS_PER_PAGE;
      return items.slice(start, start + RULES_ITEMS_PER_PAGE);
    }, [items, currentPage]);
    const rangeStart = items.length === 0 ? 0 : (currentPage - 1) * RULES_ITEMS_PER_PAGE + 1;
    const rangeEnd = Math.min(currentPage * RULES_ITEMS_PER_PAGE, items.length);

    useEffect(() => {
      setCurrentPage(1);
    }, [items.length, activeSeverityFilter]);

    useEffect(() => {
      if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-800">{title}</h3>
            <p className="text-[11px] font-medium text-slate-400">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tone === 'negative' && onSeverityFilterChange && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSeverityMenuOpen((open) => !open)}
                  aria-label="กรองระดับความรุนแรง"
                  aria-expanded={severityMenuOpen}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <TbFilter2 className="h-5 w-5" />
                  {isSeverityFilterActive && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                  )}
                </button>

                {severityMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10"
                      aria-label="ปิดตัวกรอง"
                      onClick={() => setSeverityMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {severityFilterOptions.map((opt) => {
                        const isActive = activeSeverityFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              onSeverityFilterChange(opt.value);
                              setSeverityMenuOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center rounded-lg px-3 py-2 text-left text-[11px] font-bold transition-colors',
                              isActive
                                ? 'bg-slate-900 text-white'
                                : opt.value === 'all'
                                  ? 'text-slate-600 hover:bg-slate-50'
                                  : cn('hover:bg-slate-50', behaviorSeverityBadgeClass(opt.value as BehaviorSeverity)),
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <PermissionVisible featureKey="behaviorScore" require="full">
              <button
                type="button"
                onClick={onAdd}
                aria-label="เพิ่ม"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 active:scale-95"
              >
                <HiOutlinePlus size={16} />
              </button>
            </PermissionVisible>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5">
              <p className="text-center text-sm font-bold text-slate-400">
                {tone === 'negative' && activeSeverityFilter !== 'all'
                  ? 'ไม่มีรายการในระดับความรุนแรงนี้'
                  : 'ยังไม่มีรายการ'}
              </p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-50 scrollbar-hide">
                {paginatedItems.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{t.label}</p>
                    {tone === 'negative' && (
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-black',
                          behaviorSeverityBadgeClass(t.severity),
                        )}
                      >
                        {getBehaviorSeverityLabel(t.severity)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400">
                    {tone === 'negative' ? 'หักคะแนนเมื่อพบพฤติกรรมนี้' : 'เพิ่มคะแนนเมื่อทำได้ดี'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-sm font-black', pointColor)}>
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </span>
                  <PermissionVisible featureKey="behaviorScore" require="full">
                    <button
                      type="button"
                      onClick={() => openEditForm(t)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <HiOutlinePencilSquare size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggle(t)}
                      className={cn(
                        'rounded-lg px-2 py-1 text-[11px] font-bold',
                        t.isActive ? activeBg : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {t.isActive ? 'ใช้งาน' : 'ปิดอยู่'}
                    </button>
                  </PermissionVisible>
                </div>
              </div>
                ))}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-3 py-3">
                <p className="font-sarabun text-[11px] font-bold text-slate-500">
                  แสดง {rangeStart}–{rangeEnd} จาก {items.length} รายการ
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label="หน้าก่อนหน้า"
                    >
                      <HiChevronLeft size={16} />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                        if (totalPages > 5) {
                          if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                            if (page === 2 || page === totalPages - 1) {
                              return (
                                <span key={`ellipsis-${page}`} className="px-0.5 font-sarabun text-[10px] text-slate-300">
                                  …
                                </span>
                              );
                            }
                            return null;
                          }
                        }

                        const isActive = currentPage === page;
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              'h-8 min-w-[32px] rounded-lg px-2 font-sukhumvit text-[11px] font-black transition-all',
                              isActive
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                            )}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label="หน้าถัดไป"
                    >
                      <HiChevronRight size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {cardSwitchPortal}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
      ) : (
        <div className="grid min-h-[calc(100dvh-12rem)] flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
          {(!isMdOrBelow || activeCard === 'negative') && (
          <RuleSection
            title="ผิดระเบียบ (คะแนนลบ)"
            subtitle="กำหนดการหักคะแนนเมื่อนักเรียนทำผิด"
            items={filteredNegativeTemplates}
            tone="negative"
            onAdd={() => openCreateForm('negative')}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
          />
          )}
          {(!isMdOrBelow || activeCard === 'positive') && (
          <RuleSection
            title="ความดี (คะแนนบวก)"
            subtitle="กำหนดการเพิ่มคะแนนเมื่อนักเรียนทำได้ดี"
            items={positiveTemplates}
            tone="positive"
            onAdd={() => openCreateForm('positive')}
          />
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent
          className="w-[92vw] sm:max-w-md rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 p-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center bg-transparent">
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
              {editing ? 'แก้ไขกฎระเบียบ' : 'เพิ่มกฎระเบียบ'}
            </DialogTitle>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                ชื่อรายการ
              </label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="เช่น มาสาย"
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                คะแนน
              </label>
              <Input
                type="number"
                min={1}
                value={Math.abs(form.points)}
                onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) || 0 }))}
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            {form.type === 'negative' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  ความรุนแรง
                </label>
                <select
                  value={form.severity ?? 'medium'}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    severity: e.target.value as BehaviorSeverity,
                  }))}
                  className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
                >
                  {BEHAVIOR_SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="rounded-xl font-bold text-slate-500 h-10"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 border border-slate-800"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
