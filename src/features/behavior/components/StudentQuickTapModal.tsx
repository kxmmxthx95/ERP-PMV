import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  HiArrowLeft,
  HiFunnel,
  HiMagnifyingGlass,
  HiPlus,
  HiTrash,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useAuth } from '@/hooks/useAuth';
import {
  useBehaviorCatalog,
  useBehaviorScoreActions,
  useStudentBehaviorRecords,
} from '@/hooks/useBehaviorScore';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentCard } from '@/types/student';
import type {
  BehaviorRecord,
  BehaviorSeverity,
  BehaviorTemplate,
  BehaviorTotal,
  BehaviorType,
} from '@/types/behavior';
import { cn } from '@/lib/utils';
import {
  BEHAVIOR_SEVERITY_OPTIONS,
  behaviorSeverityBadgeClass,
  behaviorSeverityButtonClass,
  compareBehaviorSeverity,
  getBehaviorSeverityLabel,
} from '../utils/behaviorSeverity';

const BASELINE_POINTS = 100;
const SEARCH_MIN_LENGTH = 5;

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 font-sukhumvit before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-lg sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

type DrawerScreen = 'history' | 'record';
type RecordStep = 'type' | 'list';

interface StudentQuickTapModalProps {
  open: boolean;
  onClose: () => void;
  studentCard: StudentCard | null;
  academicYearId: string;
  semester: number;
  currentTotal: BehaviorTotal | undefined;
  onRecorded: (next: BehaviorTotal) => void;
}

interface ActorUserData {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  displayName?: string;
}

function actorDisplayName(userData: ActorUserData | null | undefined, fallbackEmail: string | null | undefined): string {
  const composed = `${userData?.prefix ?? ''}${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim();
  return userData?.name || userData?.displayName || composed || fallbackEmail || 'ครู';
}

function formatRecordDate(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${Number(year) + 543}`;
}

function HistoryItem({
  record,
  onDelete,
  deleting,
}: {
  record: BehaviorRecord;
  onDelete?: (record: BehaviorRecord) => void;
  deleting: boolean;
}) {
  const isPositive = record.type === 'positive';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5',
        isPositive ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/80',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-block rounded border px-1.5 py-0.5 text-[9px] font-black',
              isPositive
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : 'border-rose-200 bg-rose-100 text-rose-700',
            )}
          >
            {isPositive ? 'ความดี' : 'ผิดระเบียบ'}
          </span>
          {!isPositive && (
            <span
              className={cn(
                'inline-block rounded border px-1.5 py-0.5 text-[9px] font-black',
                behaviorSeverityBadgeClass(record.severity),
              )}
            >
              {getBehaviorSeverityLabel(record.severity)}
            </span>
          )}
          <span className="text-[10px] font-bold text-slate-400">{formatRecordDate(record.date)}</span>
        </div>
        <p className="mt-1 text-sm font-bold leading-snug text-slate-800">{record.templateLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'min-w-[2rem] text-right text-sm font-black tabular-nums',
            isPositive ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          {record.points > 0 ? `+${record.points}` : record.points}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(record)}
            disabled={deleting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
            aria-label="ลบรายการ"
          >
            <HiTrash size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryList({
  records,
  onDelete,
  deletingId,
}: {
  records: BehaviorRecord[];
  onDelete?: (record: BehaviorRecord) => void;
  deletingId: string | null;
}) {
  if (records.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-8 text-center text-xs font-bold text-slate-400">
        ยังไม่มีบันทึก
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record) => (
        <HistoryItem
          key={record.id}
          record={record}
          onDelete={onDelete}
          deleting={deletingId === record.id}
        />
      ))}
    </div>
  );
}

function resetRecordState(setters: {
  setDrawerScreen: (v: DrawerScreen) => void;
  setRecordStep: (v: RecordStep) => void;
  setSelectedType: (v: BehaviorType | null) => void;
  setSeverityFilter: (v: BehaviorSeverity | 'all') => void;
  setSearchQuery: (v: string) => void;
  setSeverityMenuOpen: (v: boolean) => void;
}) {
  setters.setDrawerScreen('history');
  setters.setRecordStep('type');
  setters.setSelectedType(null);
  setters.setSeverityFilter('all');
  setters.setSearchQuery('');
  setters.setSeverityMenuOpen(false);
}

export default function StudentQuickTapModal({
  open,
  onClose,
  studentCard,
  academicYearId,
  semester,
  currentTotal,
  onRecorded,
}: StudentQuickTapModalProps) {
  const { user, userData } = useAuth();
  const { templates, loading: loadingCatalog } = useBehaviorCatalog();
  const { recordBehavior, deleteBehaviorRecord } = useBehaviorScoreActions();
  const {
    records: studentRecords,
    loading: loadingRecords,
    refresh: refreshRecords,
  } = useStudentBehaviorRecords(open ? academicYearId : null, open ? studentCard?.student.id : null);

  const [localTotal, setLocalTotal] = useState<number>(currentTotal?.totalPoints ?? BASELINE_POINTS);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [drawerScreen, setDrawerScreen] = useState<DrawerScreen>('history');
  const [recordStep, setRecordStep] = useState<RecordStep>('type');
  const [selectedType, setSelectedType] = useState<BehaviorType | null>(null);
  const [severityFilter, setSeverityFilter] = useState<BehaviorSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityMenuOpen, setSeverityMenuOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalTotal(currentTotal?.totalPoints ?? BASELINE_POINTS);
      resetRecordState({
        setDrawerScreen,
        setRecordStep,
        setSelectedType,
        setSeverityFilter,
        setSearchQuery,
        setSeverityMenuOpen,
      });
    }
  }, [open, currentTotal, studentCard?.student.id]);

  const positiveTemplates = templates.filter((t) => t.type === 'positive');
  const negativeTemplates = templates.filter((t) => t.type === 'negative');
  const trimmedSearch = searchQuery.trim();
  const isSearchActive = trimmedSearch.length >= SEARCH_MIN_LENGTH;

  const filteredTemplates = useMemo(() => {
    if (!selectedType) return [];

    let list = selectedType === 'positive' ? positiveTemplates : negativeTemplates;

    if (selectedType === 'negative' && severityFilter !== 'all') {
      list = list.filter((t) => (t.severity ?? 'medium') === severityFilter);
    }

    if (isSearchActive) {
      const keyword = trimmedSearch.toLowerCase();
      list = list.filter((t) => t.label.toLowerCase().includes(keyword));
    }

    return [...list].sort((a, b) => {
      if (selectedType === 'negative') {
        const bySeverity = compareBehaviorSeverity(a.severity, b.severity);
        if (bySeverity !== 0) return bySeverity;
      }
      const byPoints =
        selectedType === 'negative'
          ? Math.abs(a.points) - Math.abs(b.points)
          : a.points - b.points;
      if (byPoints !== 0) return byPoints;
      const byOrder = (a.order ?? 0) - (b.order ?? 0);
      if (byOrder !== 0) return byOrder;
      return a.label.localeCompare(b.label, 'th');
    });
  }, [
    selectedType,
    positiveTemplates,
    negativeTemplates,
    severityFilter,
    isSearchActive,
    trimmedSearch,
  ]);

  if (!studentCard) return null;

  const student = studentCard.student;
  const studentName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
  const classId = studentCard.enrollment?.classId ?? '';
  const className = studentCard.enrollment?.className ?? studentCard.currentClass ?? '';
  const departmentId = studentCard.enrollment?.departmentId ?? '';

  const hasHistory = studentRecords.length > 0;
  const loading = loadingCatalog || loadingRecords;
  const isRecording = drawerScreen === 'record';

  const severityFilterOptions: Array<{ value: BehaviorSeverity | 'all'; label: string }> = [
    { value: 'all', label: 'ทั้งหมด' },
    ...BEHAVIOR_SEVERITY_OPTIONS,
  ];

  function handleOpenRecord() {
    setDrawerScreen('record');
    setRecordStep('type');
    setSelectedType(null);
    setSeverityFilter('all');
    setSearchQuery('');
    setSeverityMenuOpen(false);
  }

  function handleRecordBack() {
    if (recordStep === 'list') {
      setRecordStep('type');
      setSelectedType(null);
      setSeverityFilter('all');
      setSearchQuery('');
      setSeverityMenuOpen(false);
      return;
    }

    resetRecordState({
      setDrawerScreen,
      setRecordStep,
      setSelectedType,
      setSeverityFilter,
      setSearchQuery,
      setSeverityMenuOpen,
    });
  }

  function handleSelectType(type: BehaviorType) {
    setSelectedType(type);
    setRecordStep('list');
    setSeverityFilter('all');
    setSearchQuery('');
    setSeverityMenuOpen(false);
  }

  async function handleTap(template: BehaviorTemplate) {
    if (!user) return;
    setPendingTemplateId(template.id);
    try {
      const next = await recordBehavior(
        {
          studentId: student.id,
          studentName,
          studentCode: student.studentCode,
          classId,
          className,
          departmentId,
        },
        {
          templateId: template.id,
          templateLabel: template.label,
          points: template.points,
          type: template.type,
          severity: template.severity,
        },
        {
          recordedBy: user.uid,
          recordedByName: actorDisplayName(userData, user.email),
        },
        academicYearId,
        semester,
      );
      setLocalTotal(next.totalPoints);
      setFlash(template.points >= 0 ? 'up' : 'down');
      setTimeout(() => setFlash(null), 500);
      onRecorded(next);
      refreshRecords();
      toast.success(`${template.label} ${template.points > 0 ? '+' : ''}${template.points} คะแนน`);
      resetRecordState({
        setDrawerScreen,
        setRecordStep,
        setSelectedType,
        setSeverityFilter,
        setSearchQuery,
        setSeverityMenuOpen,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setPendingTemplateId(null);
    }
  }

  async function handleDelete(record: BehaviorRecord) {
    const confirmed = window.confirm(
      `ลบรายการ "${record.templateLabel}"?\nคะแนนจะถูกปรับกลับ ${record.points > 0 ? '-' : '+'}${Math.abs(record.points)} คะแนน`,
    );
    if (!confirmed) return;

    setDeletingRecordId(record.id);
    try {
      const next = await deleteBehaviorRecord(record, academicYearId);
      setLocalTotal(next.totalPoints);
      onRecorded(next);
      refreshRecords();
      toast.success('ลบรายการแล้ว');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setDeletingRecordId(null);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      direction="right"
    >
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
        <DrawerHeader className="shrink-0 border-b border-slate-100/70 px-5 pb-4 pt-5">
          <div className="flex items-center gap-4">
            {isRecording && (
              <button
                type="button"
                onClick={handleRecordBack}
                aria-label="กลับ"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
              >
                <HiArrowLeft size={18} />
              </button>
            )}
            <StudentAvatar
              studentId={student.id}
              name={studentName}
              photoURL={student.photoURL}
              gender={student.gender}
              className="h-14 w-14 shrink-0 rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <DrawerTitle className="truncate text-base font-black text-slate-800">
                {isRecording ? 'บันทึกพฤติกรรม' : studentName}
              </DrawerTitle>
              <DrawerDescription className="text-xs font-bold text-slate-400">
                {isRecording
                  ? recordStep === 'type'
                    ? 'เลือกประเภทพฤติกรรม'
                    : selectedType === 'positive'
                      ? 'ความดี · เลือกรายการ'
                      : 'ผิดระเบียบ · เลือกรายการ'
                  : `${student.studentCode}${className ? ` · ${className}` : ''}`}
              </DrawerDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <motion.div
                key={localTotal}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className={cn(
                  'rounded-2xl px-4 py-2 text-center text-lg font-black',
                  flash === 'up' && 'bg-emerald-100 text-emerald-600',
                  flash === 'down' && 'bg-rose-100 text-rose-600',
                  !flash && 'bg-slate-100 text-slate-700',
                )}
              >
                {localTotal}
              </motion.div>
              {!isRecording && templates.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenRecord}
                  aria-label="บันทึกพฤติกรรม"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 active:scale-95"
                >
                  <HiPlus size={18} />
                </button>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
            </div>
          ) : drawerScreen === 'history' ? (
            <section className="space-y-3">
              <div>
                <p className="text-sm font-black text-slate-800">ประวัติการบันทึก</p>
                <p className="text-xs font-bold text-slate-400">
                  {hasHistory
                    ? `บันทึกแล้ว ${studentRecords.length} รายการ`
                    : 'ยังไม่มีบันทึกพฤติกรรม — คะแนนเริ่มต้น 100'}
                </p>
              </div>
              <HistoryList
                records={studentRecords}
                onDelete={handleDelete}
                deletingId={deletingRecordId}
              />
              {templates.length === 0 && (
                <p className="py-4 text-center text-sm font-bold text-slate-400">
                  ยังไม่มีรายการพฤติกรรม กรุณาเพิ่มรายการในเมนู "ระเบียบโรงเรียน"
                </p>
              )}
            </section>
          ) : recordStep === 'type' ? (
            <section className="space-y-4">
              <div>
                <p className="text-sm font-black text-slate-800">ให้เลือกพฤติกรรม</p>
                <p className="text-xs font-bold text-slate-400">เลือกประเภทถูกหรือผิด</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={positiveTemplates.length === 0}
                  onClick={() => handleSelectType('positive')}
                  className="flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-100 bg-emerald-50/70 px-4 py-5 text-center transition-all hover:border-emerald-200 hover:bg-emerald-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-2xl font-black text-emerald-600">ถูก</span>
                  <span className="text-xs font-bold text-emerald-700">ความดี</span>
                  <span className="text-[10px] font-bold text-emerald-500/80">
                    {positiveTemplates.length} รายการ
                  </span>
                </button>
                <button
                  type="button"
                  disabled={negativeTemplates.length === 0}
                  onClick={() => handleSelectType('negative')}
                  className="flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-rose-100 bg-rose-50/70 px-4 py-5 text-center transition-all hover:border-rose-200 hover:bg-rose-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-2xl font-black text-rose-600">ผิด</span>
                  <span className="text-xs font-bold text-rose-700">ผิดระเบียบ</span>
                  <span className="text-[10px] font-bold text-rose-500/80">
                    {negativeTemplates.length} รายการ
                  </span>
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  <HiMagnifyingGlass
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`ค้นหา (อย่างน้อย ${SEARCH_MIN_LENGTH} ตัวอักษร)`}
                    className="h-10 w-full rounded-xl border border-slate-100/50 bg-slate-50 pl-9 pr-4 text-sm font-medium text-slate-700 transition-all placeholder:text-slate-300 focus:border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
                {selectedType === 'negative' && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setSeverityMenuOpen((open) => !open)}
                      aria-label="กรองระดับความรุนแรง"
                      aria-expanded={severityMenuOpen}
                      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <HiFunnel size={18} />
                      {severityFilter !== 'all' && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
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
                            const isActive = severityFilter === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setSeverityFilter(opt.value);
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
              </div>

              {trimmedSearch.length > 0 && trimmedSearch.length < SEARCH_MIN_LENGTH && (
                <p className="text-[11px] font-bold text-slate-400">
                  พิมพ์อีก {SEARCH_MIN_LENGTH - trimmedSearch.length} ตัวอักษรเพื่อค้นหา
                </p>
              )}

              {filteredTemplates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-8 text-center text-xs font-bold text-slate-400">
                  {isSearchActive ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการในหมวดนี้'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((t) => {
                    const isPositive = t.type === 'positive';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={pendingTemplateId !== null}
                        onClick={() => handleTap(t)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-all active:scale-95 disabled:opacity-50',
                          isPositive
                            ? 'border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50'
                            : cn('bg-white', behaviorSeverityButtonClass(t.severity)),
                          pendingTemplateId === t.id && 'animate-pulse',
                        )}
                      >
                        <div className="min-w-0">
                          <span
                            className={cn(
                              'block text-sm font-bold',
                              isPositive ? 'text-emerald-700' : 'text-slate-800',
                            )}
                          >
                            {t.label}
                          </span>
                          {!isPositive && (
                            <span
                              className={cn(
                                'mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[9px] font-black',
                                behaviorSeverityBadgeClass(t.severity),
                              )}
                            >
                              {getBehaviorSeverityLabel(t.severity)}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-black',
                            isPositive ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          {isPositive ? `+${t.points}` : t.points}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <DrawerFooter className="shrink-0 border-t border-slate-100/70 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 bg-white/70 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
            >
              เสร็จสิ้น
            </button>
          </div>
        </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
