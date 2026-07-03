import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Save } from 'lucide-react';
import { HiUser, HiUsers } from 'react-icons/hi2';
import { TbFilter2 } from 'react-icons/tb';
import { toast } from 'sonner';
import type { Student, StudentCard } from '@/types/student';
import type { StudentFilter } from '@/hooks/useStudentManager';
import { StudentDetailFormTab, type StudentDetailTab } from './StudentDetailFormTab';
import StudentAvatar from './StudentAvatar';
import { checkStudentCompletion } from '@/utils/studentValidation';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type UpdateSection = Extract<StudentDetailTab, 'personal' | 'family'>;

const SECTION_TABS: { id: UpdateSection; label: string; icon: typeof HiUser }[] = [
  { id: 'personal', label: 'ข้อมูลส่วนตัว', icon: HiUser },
  { id: 'family', label: 'ข้อมูลครอบครัว', icon: HiUsers },
];

function FilterSelect({
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'appearance-none min-w-0 rounded-full border-0 bg-transparent pl-3 pr-6 font-black text-slate-600 outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed',
        className ?? 'h-7 text-[10px]',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="font-bold text-slate-800 bg-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function DrawerFilterField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-white px-1 shadow-sm">
        <FilterSelect
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled}
          className="h-11 w-full text-[13px] font-bold"
        />
      </div>
    </label>
  );
}

interface Props {
  studentCards: StudentCard[];
  filter: StudentFilter;
  setFilter: React.Dispatch<React.SetStateAction<StudentFilter>>;
  yearOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  gradeOptions: { value: string; label: string }[];
  classOptions: { value: string; label: string }[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  guardianPrefixes: string[];
}

export default function StudentUpdateDataTab({
  studentCards,
  filter,
  setFilter,
  yearOptions,
  departmentOptions,
  gradeOptions,
  classOptions,
  searchQuery,
  onSearchQueryChange,
  onClearFilters,
  hasActiveFilters,
  updateStudent,
  guardianPrefixes,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<UpdateSection>('personal');
  const [formData, setFormData] = useState<Student | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const isFilterReady = Boolean(filter.department && filter.gradeLevel && filter.classId);

  const drawerDepartmentOptions = useMemo(
    () => [
      { value: '', label: 'เลือกสายชั้น' },
      ...departmentOptions.filter((o) => o.value !== ''),
    ],
    [departmentOptions],
  );

  const selectedCard = useMemo(
    () => studentCards.find((c) => c.student.id === selectedId) ?? null,
    [studentCards, selectedId],
  );
  const selectedStudent = selectedCard?.student ?? null;

  useEffect(() => {
    if (selectedStudent) {
      setFormData({ ...selectedStudent });
      setHasPendingChanges(false);
    } else {
      setFormData(null);
      setHasPendingChanges(false);
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (!isFilterReady) {
      setSelectedId(null);
    }
  }, [isFilterReady]);

  useEffect(() => {
    if (selectedId && !studentCards.some((c) => c.student.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, studentCards]);

  const handleChange = (key: keyof Student, value: unknown) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setHasPendingChanges(true);
  };

  const handleSave = async () => {
    if (!selectedId || !formData || isSaving) return;
    setIsSaving(true);
    try {
      const payload = { ...formData };
      delete (payload as Partial<Student>).id;
      await updateStudent(selectedId, payload);
      setHasPendingChanges(false);
      toast.success('บันทึกข้อมูลเรียบร้อย');
    } catch (error) {
      console.error('Update student data error:', error);
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!selectedStudent) return;
    if (hasPendingChanges && !confirm('ยกเลิกการเปลี่ยนแปลงที่ยังไม่ได้บันทึก?')) return;
    setFormData({ ...selectedStudent });
    setHasPendingChanges(false);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/30 bg-white/30 p-4">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="relative flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="ตัวกรอง"
          aria-label="ตัวกรอง"
        >
          <TbFilter2 className="h-4 w-4" />
          <span className="text-[11px] font-black">ตัวกรอง</span>
          {hasActiveFilters && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
          )}
        </motion.button>

        {isFilterReady && (
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="ค้นหานักเรียน..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-9 text-[12px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="ล้างคำค้นหา"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตัวกรองนักเรียน</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              เลือกปีการศึกษา สายชั้น ชั้นเรียน ห้องเรียน หรือค้นหาชื่อ
            </DrawerDescription>
          </DrawerHeader>

          <div className="grid grid-cols-2 gap-3 px-4">
            <DrawerFilterField
              label="ปีการศึกษา"
              value={filter.academicYearId || '2568'}
              onChange={(v) => setFilter((prev) => ({ ...prev, academicYearId: v, gradeLevel: '', classId: '' }))}
              options={yearOptions}
            />
            <DrawerFilterField
              label="สายชั้น"
              value={filter.department || ''}
              onChange={(v) => setFilter((prev) => ({ ...prev, department: v, gradeLevel: '', classId: '' }))}
              options={drawerDepartmentOptions}
            />
            <DrawerFilterField
              label="ชั้นเรียน"
              value={filter.gradeLevel || ''}
              onChange={(v) => setFilter((prev) => ({ ...prev, gradeLevel: v, classId: '' }))}
              options={gradeOptions}
              disabled={!filter.department}
            />
            <DrawerFilterField
              label="ห้องเรียน"
              value={filter.classId || ''}
              onChange={(v) => setFilter((prev) => ({ ...prev, classId: v }))}
              options={classOptions}
              disabled={!filter.gradeLevel}
            />
          </div>

          <div className="px-4 pt-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="ค้นหานักเรียน..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                ล้างตัวกรอง
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(false)}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800"
            >
              แสดงผล
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {!isFilterReady ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-white/40 bg-white/50 p-8 text-center">
          <HiUsers className="h-12 w-12 text-slate-300" />
          <p className="text-[14px] font-black text-slate-600">กรุณาเลือกตัวกรองก่อน</p>
          <p className="max-w-sm text-[12px] font-bold text-slate-400">
            เลือก สายชั้น → ชั้นเรียน → ห้องเรียน เพื่อแสดงรายชื่อนักเรียน
          </p>
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="mt-1 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[12px] font-black text-white shadow-md transition-colors hover:bg-slate-800"
          >
            <TbFilter2 className="h-4 w-4" />
            เปิดตัวกรอง
          </button>
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        {/* Student list */}
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/40 bg-white/50 lg:w-[280px]">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">เลือกนักเรียน</p>
            <p className="text-[13px] font-black text-slate-800">{studentCards.length} คน</p>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
            {studentCards.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] font-bold text-slate-400">
                ไม่พบนักเรียน
              </div>
            ) : (
              studentCards.map(({ student, currentClass, currentGrade }) => {
                const completion = checkStudentCompletion(student);
                const sectionComplete = section === 'personal'
                  ? completion.categories.personal
                  : completion.categories.family;
                const isActive = selectedId === student.id;

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedId(student.id)}
                    className={cn(
                      'mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all',
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'hover:bg-slate-50',
                    )}
                  >
                    <StudentAvatar
                      photoURL={student.photoURL}
                      studentId={student.id}
                      name={student.firstName}
                      gender={student.gender}
                      className="h-10 w-10 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[12px] font-black', isActive ? 'text-white' : 'text-slate-800')}>
                        {student.firstName} {student.lastName}
                      </p>
                      <p className={cn('truncate text-[10px] font-bold', isActive ? 'text-blue-100' : 'text-slate-400')}>
                        {student.studentCode} · {currentGrade || '—'}{currentClass ? `/${currentClass.split('/').pop()}` : ''}
                      </p>
                    </div>
                    {!sectionComplete && (
                      <span className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase',
                        isActive ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-500',
                      )}>
                        ไม่ครบ
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-white/40 bg-white/70">
          {!selectedStudent || !formData ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <HiUser className="h-10 w-10 text-slate-300" />
              <p className="text-[14px] font-black text-slate-500">เลือกนักเรียนจากรายการด้านซ้าย</p>
              <p className="text-[12px] font-bold text-slate-400">เพื่ออัพเดตข้อมูลส่วนตัวหรือข้อมูลครอบครัว</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-[15px] font-black text-slate-900">
                    {selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400">รหัส {selectedStudent.studentCode}</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasPendingChanges && (
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="rounded-xl px-3 py-1.5 text-[11px] font-black text-slate-500 hover:bg-slate-100"
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!hasPendingChanges || isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-[11px] font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    บันทึก
                  </button>
                </div>
              </div>

              <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
                {SECTION_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = section === tab.id;
                  const complete = tab.id === 'personal'
                    ? checkStudentCompletion(selectedStudent).categories.personal
                    : checkStudentCompletion(selectedStudent).categories.family;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSection(tab.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-black transition-all',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Icon size={14} />
                      {tab.label}
                      {!complete && (
                        <span className={cn(
                          'rounded-full px-1.5 py-0.5 text-[8px] font-black',
                          isActive ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-500',
                        )}>
                          ไม่ครบ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={section}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <StudentDetailFormTab
                      tab={section}
                      viewData={selectedStudent}
                      formData={formData}
                      isEditMode
                      onChange={handleChange}
                      guardianPrefixes={guardianPrefixes}
                      studentId={selectedStudent.id}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
