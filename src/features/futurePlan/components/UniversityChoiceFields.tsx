import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineBuildingLibrary,
  HiOutlineChevronLeft,
  HiOutlineMagnifyingGlass,
  HiOutlineCheckCircle,
  HiOutlinePlus,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { ProfileRow } from '@/features/profile/profileLayoutShared';
import {
  STUDY_COUNTRIES,
  type UniversityChoice,
  type StudyLocation,
} from '@/types/futurePlan';
import {
  mytcasFacultiesForUniversity,
  mytcasFieldsForFaculty,
  type MytcasFaculty,
  type MytcasField,
} from '@/data/mytcasUniversities';
import {
  matchesUniversitySearch,
  universityLabel,
  type ThaiUniversity,
} from '@/data/thaiUniversities';
import {
  findMytcasForChoice,
  findMytcasForThaiUniversity,
  hasMytcasFacultyData,
} from '@/data/universityBridge';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import {
  FuturePlanRankBadge,
  FuturePlanStatusBadge,
} from '@/features/futurePlan/components/FuturePlanStatusBadge';
import { fp, fpRankStatus, fpStatus } from '@/features/futurePlan/futurePlanTheme';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { SimpleDropdown } from '@/features/futurePlan/components/FuturePlanPickers';
import { useMytcasCatalog } from '@/hooks/useMytcasCatalog';
import { usePickerUniversities } from '@/hooks/usePickerUniversities';

interface UniversityChoiceFieldsProps {
  choice: UniversityChoice;
  studyLocation: StudyLocation;
  onChange: (field: keyof UniversityChoice, value: string) => void;
}

type PickerView = 'university' | 'faculty' | 'program' | 'manual' | 'summary';

function resolvePickerView(
  choice: UniversityChoice,
  hasMytcasFaculties: boolean,
  fieldCount: number,
  programSkipped: boolean,
): PickerView {
  if (!choice.universityName.trim()) return 'university';
  if (!choice.faculty.trim()) {
    return hasMytcasFaculties ? 'faculty' : 'manual';
  }
  if (hasMytcasFaculties && fieldCount > 0 && !(choice.program ?? '').trim() && !programSkipped) {
    return 'program';
  }
  return 'summary';
}

const PICKER_BUTTON_LABEL: Record<Exclude<PickerView, 'summary'>, string> = {
  university: 'เลือกมหาวิทยาลัย',
  faculty: 'เลือกคณะ',
  program: 'เลือกสาขาวิชา',
  manual: 'กรอกคณะและสาขา',
};

export function UniversityChoiceFields({
  choice,
  studyLocation,
  onChange,
}: UniversityChoiceFieldsProps) {
  const isIntl = studyLocation === 'international';
  const { universities: mytcasList } = useMytcasCatalog();
  const { pickerUniversities, isLoading: pickerLoading } = usePickerUniversities();

  const selectedMytcas = findMytcasForChoice(choice.universityName, choice.universityDomain, mytcasList);
  const hasMytcasFaculties = hasMytcasFacultyData(selectedMytcas, mytcasList);
  const faculties = selectedMytcas ? mytcasFacultiesForUniversity(selectedMytcas.nameTh, mytcasList) : [];
  const fields =
    selectedMytcas && choice.faculty && hasMytcasFaculties
      ? mytcasFieldsForFaculty(selectedMytcas.nameTh, choice.faculty, mytcasList)
      : [];

  const [view, setView] = useState<PickerView>(() =>
    isIntl ? 'summary' : resolvePickerView(choice, hasMytcasFaculties, fields.length, false),
  );
  const [search, setSearch] = useState('');
  const [programSkipped, setProgramSkipped] = useState(false);
  const [pickerDrawerOpen, setPickerDrawerOpen] = useState(false);

  useEffect(() => {
    setSearch('');
    setProgramSkipped(false);
  }, [choice.rank, choice.universityName, choice.faculty]);

  useEffect(() => {
    if (!isIntl) {
      setView(resolvePickerView(choice, hasMytcasFaculties, fields.length, programSkipped));
    }
  }, [
    choice.universityName,
    choice.faculty,
    choice.program,
    isIntl,
    hasMytcasFaculties,
    fields.length,
    programSkipped,
  ]);

  const filteredUniversities = useMemo(() => {
    return pickerUniversities.filter((u) => matchesUniversitySearch(u, search));
  }, [pickerUniversities, search]);

  const filteredFaculties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faculties;
    return faculties.filter(
      (f) =>
        f.nameTh.toLowerCase().includes(q) ||
        (f.nameEn?.toLowerCase().includes(q) ?? false) ||
        (f.campusNameTh?.toLowerCase().includes(q) ?? false),
    );
  }, [faculties, search]);

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.nameTh.toLowerCase().includes(q) ||
        (f.nameEn?.toLowerCase().includes(q) ?? false),
    );
  }, [fields, search]);

  function openPickerDrawer(atView?: Exclude<PickerView, 'summary'>) {
    setSearch('');
    setView(atView ?? (view === 'summary' ? 'university' : view));
    setPickerDrawerOpen(true);
  }

  function closePickerDrawer() {
    setPickerDrawerOpen(false);
    setSearch('');
  }

  function selectUniversity(uni: ThaiUniversity) {
    onChange('universityDomain', uni.domain);
    onChange('universityName', universityLabel(uni));
    onChange('faculty', '');
    onChange('program', '');
    setProgramSkipped(false);
    setSearch('');
    const mytcas = findMytcasForThaiUniversity(uni, mytcasList);
    setView(hasMytcasFacultyData(mytcas, mytcasList) ? 'faculty' : 'manual');
  }

  function selectFaculty(fac: MytcasFaculty) {
    onChange('faculty', fac.nameTh);
    onChange('program', '');
    setProgramSkipped(false);
    setSearch('');
    const nextFields = mytcasFieldsForFaculty(
      selectedMytcas?.nameTh ?? choice.universityName,
      fac.nameTh,
      mytcasList,
    );
    if (nextFields.length > 0) {
      setView('program');
    } else {
      closePickerDrawer();
      setView('summary');
    }
  }

  function selectProgram(field: MytcasField) {
    onChange('program', field.nameTh);
    setSearch('');
    closePickerDrawer();
    setView('summary');
  }

  function skipProgram() {
    setProgramSkipped(true);
    onChange('program', '');
    setSearch('');
    closePickerDrawer();
    setView('summary');
  }

  function confirmManual(faculty: string, program: string) {
    onChange('faculty', faculty);
    onChange('program', program);
    setSearch('');
    closePickerDrawer();
    setView('summary');
  }

  function drawerBack() {
    setSearch('');
    if (view === 'program') {
      onChange('program', '');
      setProgramSkipped(false);
      setView('faculty');
    } else if (view === 'faculty' || view === 'manual') {
      onChange('faculty', '');
      onChange('program', '');
      setProgramSkipped(false);
      setView('university');
    }
  }

  const drawerTitle =
    view === 'faculty'
      ? 'เลือกคณะ'
      : view === 'program'
        ? 'เลือกสาขาวิชา'
        : view === 'manual'
          ? 'กรอกคณะและสาขา'
          : 'เลือกมหาวิทยาลัย';

  const drawerSubtitle =
    view === 'faculty' || view === 'manual'
      ? choice.universityName
      : view === 'program'
        ? choice.faculty
        : pickerLoading && mytcasList.length === 0
          ? 'กำลังโหลดรายชื่อ...'
          : `${filteredUniversities.length} สถาบัน`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {isIntl && (
        <>
          <Field label="ประเทศ">
            <SimpleDropdown
              value={choice.country ?? ''}
              options={STUDY_COUNTRIES}
              placeholder="เลือกประเทศ..."
              onChange={(v) => onChange('country', v)}
            />
          </Field>
          <Field label="มหาวิทยาลัย / สถาบัน">
            <input
              value={choice.universityName}
              onChange={(e) => onChange('universityName', e.target.value)}
              placeholder="เช่น MIT, Oxford, Tokyo University..."
              className={cn(fp.inputSm, 'px-3 py-2.5')}
            />
          </Field>
          <Field label="คณะ / สาขาวิชา">
            <input
              value={choice.faculty}
              onChange={(e) => onChange('faculty', e.target.value)}
              placeholder="เช่น Computer Science..."
              className={cn(fp.inputSm, 'px-3 py-2.5')}
            />
          </Field>
        </>
      )}

      {!isIntl && (
        <AnimatePresence mode="wait">
          <motion.div
            key={view === 'summary' ? 'summary' : 'picker'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {view !== 'summary' && (
              <>
                {choice.universityName && (
                  <PartialSelectionPreview
                    universityName={choice.universityName}
                    universityDomain={choice.universityDomain}
                    faculty={choice.faculty}
                  />
                )}
                <SelectPickerButton
                  label={PICKER_BUTTON_LABEL[view]}
                  onClick={() => openPickerDrawer(view)}
                />
              </>
            )}

            {view === 'summary' && choice.universityName && (
              <UniversitySelectionSummary
                choice={choice}
                hasProgramStep={hasMytcasFaculties && fields.length > 0}
                isManualFaculty={!hasMytcasFaculties}
                onEditUniversity={() => openPickerDrawer('university')}
                onEditFaculty={() => openPickerDrawer(hasMytcasFaculties ? 'faculty' : 'manual')}
                onEditProgram={() => openPickerDrawer('program')}
              />
            )}

            <UniversityPickerDrawer
              open={pickerDrawerOpen}
              onOpenChange={(open) => {
                if (!open) closePickerDrawer();
                else setPickerDrawerOpen(true);
              }}
              view={view === 'summary' ? 'university' : view}
              title={drawerTitle}
              subtitle={drawerSubtitle}
              showBack={view === 'faculty' || view === 'program' || view === 'manual'}
              onBack={drawerBack}
              search={search}
              onSearchChange={setSearch}
              universityDomain={choice.universityDomain}
              universities={filteredUniversities}
              faculties={filteredFaculties}
              fields={filteredFields}
              manualFaculty={choice.faculty}
              manualProgram={choice.program ?? ''}
              onSelectUniversity={selectUniversity}
              onSelectFaculty={selectFaculty}
              onSelectProgram={selectProgram}
              onSkipProgram={skipProgram}
              onConfirmManual={confirmManual}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function UniversitySelectionSummary({
  choice,
  hasProgramStep,
  isManualFaculty,
  onEditUniversity,
  onEditFaculty,
  onEditProgram,
}: {
  choice: UniversityChoice;
  hasProgramStep: boolean;
  isManualFaculty: boolean;
  onEditUniversity: () => void;
  onEditFaculty: () => void;
  onEditProgram: () => void;
}) {
  return (
    <section
      className={cn(
        fp.section,
        'p-4 sm:p-5 space-y-4 border',
        fpStatus[
          choice.rank === 1 || choice.rank === 2 || choice.rank === 3
            ? fpRankStatus[choice.rank as 1 | 2 | 3]
            : 'success'
        ].border,
      )}
    >
      <div className="flex flex-col items-center pt-1 pb-2 text-center">
        <UniversityLogo domain={choice.universityDomain} label={choice.universityName} size="lg" />
        <h2 className="mt-3 text-sm font-black text-[#000000]">{choice.universityName}</h2>
        <div className="mt-2 flex items-center gap-2">
          <FuturePlanRankBadge rank={choice.rank} className="size-7 text-xs" />
          <FuturePlanStatusBadge variant="success" icon={<HiOutlineCheckCircle className="h-3.5 w-3.5" />}>
            เลือกครบแล้ว
          </FuturePlanStatusBadge>
        </div>
      </div>

      <div className="space-y-4">
        <ProfileField label="มหาวิทยาลัย" value={choice.universityName} />
        {choice.faculty && <ProfileField label="คณะ" value={choice.faculty} />}
        {choice.program && <ProfileField label="สาขาวิชา" value={choice.program} />}
      </div>

      <div className="h-px bg-[#E3E7FC]" />

      <div className="divide-y divide-[#E3E7FC]">
        <ProfileRow
          icon={<HiOutlineBuildingLibrary className="h-5 w-5" />}
          label="เปลี่ยนมหาวิทยาลัย"
          onClick={onEditUniversity}
        />
        {choice.faculty && (
          <ProfileRow
            icon={<HiOutlineAcademicCap className="h-5 w-5" />}
            label={isManualFaculty ? 'แก้ไขคณะ / สาขา' : 'เปลี่ยนคณะ'}
            onClick={onEditFaculty}
          />
        )}
        {hasProgramStep && (
          <ProfileRow
            icon={<HiOutlineBookOpen className="h-5 w-5" />}
            label={choice.program ? 'เปลี่ยนสาขาวิชา' : 'เลือกสาขาวิชา'}
            onClick={onEditProgram}
          />
        )}
      </div>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className={fp.labelDark}>{label}</label>
      <p className="rounded-lg border border-[#E3E7FC] bg-white px-3 py-2 text-[13px] font-bold text-[#000000]">
        {value}
      </p>
    </div>
  );
}

function PartialSelectionPreview({
  universityName,
  universityDomain,
  faculty,
}: {
  universityName: string;
  universityDomain?: string;
  faculty: string;
}) {
  return (
    <section className={cn(fp.section, 'p-4 space-y-3')}>
      <div className="flex items-center gap-3">
        <UniversityLogo domain={universityDomain} label={universityName} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#000000] truncate">{universityName}</p>
          {faculty ? (
            <p className="text-xs font-medium text-black/45 truncate">{faculty}</p>
          ) : (
            <p className="text-xs font-medium text-black/45">เลือกคณะและสาขาต่อ</p>
          )}
        </div>
      </div>
    </section>
  );
}

function SelectPickerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('w-full flex flex-col items-center justify-center gap-3 py-12 rounded-2xl active:scale-[0.99] transition-all', fp.btnPicker)}
    >
      <span className="flex items-center justify-center size-14 rounded-full bg-[#0056FF] text-white shadow-md shadow-[#0056FF]/30">
        <HiOutlinePlus size={28} strokeWidth={2} />
      </span>
      <span className="text-sm font-bold text-[#000000]">{label}</span>
    </button>
  );
}

function UniversityPickerDrawer({
  open,
  onOpenChange,
  view,
  title,
  subtitle,
  showBack,
  onBack,
  search,
  onSearchChange,
  universityDomain,
  universities,
  faculties,
  fields,
  manualFaculty,
  manualProgram,
  onSelectUniversity,
  onSelectFaculty,
  onSelectProgram,
  onSkipProgram,
  onConfirmManual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: Exclude<PickerView, 'summary'>;
  title: string;
  subtitle: string;
  showBack: boolean;
  onBack: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  universityDomain?: string;
  universities: ThaiUniversity[];
  faculties: MytcasFaculty[];
  fields: MytcasField[];
  manualFaculty: string;
  manualProgram: string;
  onSelectUniversity: (uni: ThaiUniversity) => void;
  onSelectFaculty: (fac: MytcasFaculty) => void;
  onSelectProgram: (field: MytcasField) => void;
  onSkipProgram: () => void;
  onConfirmManual: (faculty: string, program: string) => void;
}) {
  const [draftFaculty, setDraftFaculty] = useState(manualFaculty);
  const [draftProgram, setDraftProgram] = useState(manualProgram);

  useEffect(() => {
    if (view === 'manual') {
      setDraftFaculty(manualFaculty);
      setDraftProgram(manualProgram);
    }
  }, [view, manualFaculty, manualProgram, open]);

  const searchPlaceholder =
    view === 'faculty'
      ? 'ค้นหาคณะ...'
      : view === 'program'
        ? 'ค้นหาสาขาวิชา...'
        : 'ค้นหามหาวิทยาลัย...';

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className={cn(
          'h-dvh flex flex-col p-0 rounded-none',
          'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
          'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
          'sm:h-full sm:rounded-l-3xl',
          'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
          'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
        )}
      >
        <DrawerHeader className="px-4 pb-3 pt-4 shrink-0">
          <div className="relative flex items-center justify-center min-h-10">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="ย้อนกลับ"
                className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3E7FC] bg-white text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 active:scale-[0.98] transition"
              >
                <HiOutlineChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0 text-center px-12">
              <DrawerTitle className="text-base font-black text-[#000000]">{title}</DrawerTitle>
              <DrawerDescription className="text-xs text-black/45 truncate">
                {subtitle}
              </DrawerDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3E7FC] bg-white text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 active:scale-[0.98] transition"
              aria-label="ปิด"
            >
              <HiOutlineXMark className="w-5 h-5" />
            </button>
          </div>
          {universityDomain && view !== 'university' && (
            <div className="flex justify-center pt-2">
              <UniversityLogo domain={universityDomain} size="md" />
            </div>
          )}
        </DrawerHeader>

        <div className="px-4 pb-6 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {view !== 'manual' && (
            <PickerSearch
              value={search}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          )}

          {view === 'university' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto flex-1 min-h-0 pr-0.5 pb-2">
                {universities.map((uni) => (
                  <button
                    key={uni.id}
                    type="button"
                    onClick={() => onSelectUniversity(uni)}
                    className={cn('flex flex-col items-center gap-2 p-3 rounded-2xl active:scale-[0.98] transition-all text-center min-h-[7.5rem]', fp.cardPick)}
                  >
                    <UniversityLogo university={uni} size="lg" />
                    <span className="text-[11px] sm:text-xs font-semibold text-[#000000] leading-snug line-clamp-3">
                      {universityLabel(uni)}
                    </span>
                  </button>
                ))}
              </div>
              {universities.length === 0 && (
                <p className="text-sm text-black/40 text-center py-6">ไม่พบมหาวิทยาลัย</p>
              )}
            </>
          )}

          {view === 'manual' && (
            <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 pb-2">
              <p className="text-xs text-black/45 text-center px-2">
                มหาวิทยาลัยนี้ยังไม่มีข้อมูลคณะ/สาขาใน myTCAS — กรุณาระบุเอง
              </p>
              <Field label="คณะ *">
                <input
                  value={draftFaculty}
                  onChange={(e) => setDraftFaculty(e.target.value)}
                  placeholder="เช่น คณะวิศวกรรมศาสตร์"
                  className={cn(fp.inputSm, 'px-3 py-2.5')}
                />
              </Field>
              <Field label="สาขาวิชา (ไม่บังคับ)">
                <input
                  value={draftProgram}
                  onChange={(e) => setDraftProgram(e.target.value)}
                  placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                  className={cn(fp.inputSm, 'px-3 py-2.5')}
                />
              </Field>
              <button
                type="button"
                disabled={!draftFaculty.trim()}
                onClick={() => onConfirmManual(draftFaculty.trim(), draftProgram.trim())}
                className={cn('mt-auto w-full py-3 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-all rounded-xl', fp.btnPrimary)}
              >
                ยืนยัน
              </button>
            </div>
          )}

          {view === 'faculty' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 content-start items-start auto-rows-min pr-0.5 pb-2">
                {faculties.map((fac) => (
                  <button
                    key={`${fac.facultyId}:${fac.campusId ?? '00'}`}
                    type="button"
                    onClick={() => onSelectFaculty(fac)}
                    className={cn('flex w-full flex-col items-start gap-1 self-start p-3.5 rounded-2xl active:scale-[0.98] transition-all text-left', fp.cardPick)}
                  >
                    <span className="text-sm font-semibold text-[#000000] leading-snug">
                      {fac.nameTh}
                    </span>
                    {fac.campusNameTh && (
                      <span className="text-[11px] text-black/45">{fac.campusNameTh}</span>
                    )}
                    {fac.fields.length > 0 && (
                      <span className="text-[10px] font-medium text-black/45 mt-0.5">
                        {fac.fields.length} สาขาวิชา
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {faculties.length === 0 && (
                <p className="text-sm text-black/40 text-center py-6">ไม่พบคณะ</p>
              )}
            </>
          )}

          {view === 'program' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 content-start items-start auto-rows-min pr-0.5 pb-2">
                {fields.map((field) => (
                  <button
                    key={field.fieldId ?? field.nameTh}
                    type="button"
                    onClick={() => onSelectProgram(field)}
                    className={cn('flex w-full flex-col items-start gap-0.5 self-start p-3.5 rounded-2xl active:scale-[0.98] transition-all text-left', fp.cardPick)}
                  >
                    <span className="text-sm font-semibold text-[#000000]">{field.nameTh}</span>
                    {field.nameEn && (
                      <span className="text-[11px] text-black/45">{field.nameEn}</span>
                    )}
                  </button>
                ))}
              </div>
              {fields.length === 0 && (
                <p className="text-sm text-black/40 text-center py-6">ไม่พบสาขาวิชา</p>
              )}
              <button
                type="button"
                onClick={onSkipProgram}
                className="shrink-0 w-full py-2.5 text-center text-xs font-semibold text-black/50 hover:text-black/70 transition-colors"
              >
                ไม่ระบุสาขา — ใช้เฉพาะคณะ
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PickerSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <HiOutlineMagnifyingGlass
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35 pointer-events-none"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fp.inputSm, 'pl-9 pr-3 py-2.5 placeholder:text-black/35')}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={fp.label}>
        {label}
      </label>
      {children}
    </div>
  );
}
