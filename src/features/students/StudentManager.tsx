import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X,
  DoorOpen,
  Trash2,
  ChevronDown, ChevronRight,
  Camera, Loader2, Save
} from 'lucide-react';
import {
  HiUser,
  HiUsers,
  HiMapPin,
  HiViewColumns,
  HiArrowUpTray,
  HiBuildingOffice2,
  HiArrowUpCircle,
  HiChevronDown,
  HiPencilSquare,
} from 'react-icons/hi2';
import { TbFilter2 } from 'react-icons/tb';
import type { IconType } from 'react-icons';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toast } from 'sonner';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import StudentFormModal from './components/StudentFormModal';
import StudentOverviewDashboard from './components/StudentOverviewDashboard';
import { StudentDetailFormTab } from './components/StudentDetailFormTab';
import { compressImage } from './components/studentDetailFormShared';
import type { Student } from '@/types/student';
import { cn } from '@/lib/utils';

const StudentCsvImportModal = lazy(() => import('./components/StudentCsvImportModal'));
const StudentImportTab = lazy(() => import('./components/StudentImportTab'));
const ClassroomAssignmentTab = lazy(() => import('./components/ClassroomAssignmentTab'));
const StudentTransitionTab = lazy(() => import('./components/StudentTransitionTab'));
const StudentUpdateDataTab = lazy(() => import('./components/StudentUpdateDataTab'));

type StudentTab = 'overview' | 'list' | 'update' | 'import' | 'class' | 'promote';
type DetailTab = 'personal' | 'family' | 'map';

const STUDENT_TAB_CONFIG: Record<StudentTab, { label: string; icon: IconType }> = {
  overview: { label: 'ภาพรวม', icon: HiUsers },
  list: { label: 'รายชื่อ', icon: HiViewColumns },
  update: { label: 'อัพเดตข้อมูล', icon: HiPencilSquare },
  import: { label: 'นำเข้า', icon: HiArrowUpTray },
  class: { label: 'ห้องเรียน', icon: HiBuildingOffice2 },
  promote: { label: 'เลื่อนชั้น', icon: HiArrowUpCircle },
};

const STATUS_LABEL: Record<string, string> = {
  active: 'กำลังศึกษา',
  inactive: 'พักการศึกษา',
  graduated: 'จบการศึกษา',
  transferred: 'ย้ายออก',
};
const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  inactive: '#f59e0b',
  graduated: '#6366f1',
  transferred: '#94a3b8',
};

const GRADE_ORDER: Record<string, string[]> = {
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

function FilterSelect({
  value, onChange, options, disabled = false, hasDivider = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hasDivider?: boolean;
}) {
  return (
    <div className={`relative flex items-center shrink-0 ${hasDivider ? 'border-r border-black/[0.07]' : ''}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-6 h-7 bg-transparent text-[10px] font-black text-slate-600 hover:text-slate-800 outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="font-bold text-slate-800 bg-white">{o.label}</option>
        ))}
      </select>
      <ChevronDown size={10} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none shrink-0 ${disabled ? 'opacity-30' : 'text-slate-400'}`} />
    </div>
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
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-9 text-[13px] font-bold text-slate-800 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-white font-bold text-slate-800">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

export default function StudentManager() {
  const { year: academicYear } = useActiveAcademicYear();

  const {
    filteredStudentCards, stats, filter, setFilter,
    availableClasses,
    addStudent, updateStudent, deleteStudent, toggleStudentStatus,
    getStudentById,
  } = useStudentManager(academicYear ?? '2568');

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-portal-center'));
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { prefixes: guardianPrefixes } = useNamePrefix('adult');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent] = useState<Student | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudentTab>('overview');
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('personal');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = !!(filter.department || filter.gradeLevel || filter.classId || searchQuery);

  const handleClearFilters = () => {
    setFilter(prev => ({
      ...prev,
      department: '',
      gradeLevel: '',
      classId: '',
      searchText: '',
    }));
    setSearchQuery('');
  };

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const selectedStudent = selectedId ? getStudentById(selectedId) : null;

  // Sync detail form when selected student changes
  useEffect(() => {
    if (selectedStudent) {
      setDetailForm(selectedStudent);
      setHasPendingChanges(false);
    }
  }, [selectedStudent]);

  const handleDetailFormChange = (key: string, value: any) => {
    setDetailForm((prev: any) => ({ ...prev, [key]: value }));
    setHasPendingChanges(true);
  };

  const handleSaveDetailChanges = async () => {
    if (!selectedId || !detailForm || isSavingChanges) return;

    setIsSavingChanges(true);
    try {
      const payload = { ...detailForm };
      delete payload.id;
      await updateStudent(selectedId, payload);
      setHasPendingChanges(false);
      setIsEditMode(false);
      toast.success('บันทึกข้อมูลเรียบร้อย');
    } catch (error) {
      console.error('Save student detail error:', error);
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleEditModeToggle = () => {
    if (isEditMode && hasPendingChanges) {
      const shouldDiscard = confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากโหมดแก้ไขและยกเลิกการเปลี่ยนแปลงหรือไม่?');
      if (!shouldDiscard) return;
      if (selectedStudent) setDetailForm(selectedStudent);
      setHasPendingChanges(false);
    }
    setIsEditMode(prev => !prev);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading('กำลังอัปโหลดและบีบอัดรูปภาพ...');

    try {
      // 1. Compress
      const compressedBlob = await compressImage(file);
      
      // 2. Upload
      const fileName = `student_photos/${selectedId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);

      // 3. Keep in draft form and save with "บันทึก" button
      setDetailForm((prev: any) => ({ ...prev, photoURL: url }));
      setHasPendingChanges(true);
      
      toast.success('อัปโหลดรูปภาพสำเร็จ (รอบันทึกข้อมูล)', { id: loadingToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  // Sync search query to filter
  useEffect(() => {
    setFilter(prev => ({ ...prev, searchText: searchQuery }));
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === 'list') {
      setSelectedId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    setMobileTabMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!mobileTabMenuOpen) return;
    const close = () => setMobileTabMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileTabMenuOpen]);

  const handleFormSubmit = async (data: any) => {
    if (editingStudent) {
      await updateStudent(editingStudent.id, data);
    } else {
      const newStudent = await addStudent(data);
      setSelectedId(newStudent.id);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteStudent(id);
    if (selectedId === id) {
      const next = filteredStudentCards.find(c => c.student.id !== id);
      setSelectedId(next?.student.id ?? null);
    }
  };

  const studentTabs = Object.entries(STUDENT_TAB_CONFIG) as [StudentTab, typeof STUDENT_TAB_CONFIG[StudentTab]][];
  const activeTabConfig = STUDENT_TAB_CONFIG[activeTab];
  const ActiveTabIcon = activeTabConfig.icon;

  const navigation = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center h-10 bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto"
    >
      {studentTabs.map(([key, cfg]) => {
        const isActive = activeTab === key;
        const Icon = cfg.icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center justify-center h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap gap-1.5 cursor-pointer ${isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'}`}
          >
            <Icon className="h-3.5 w-3.5 sm:hidden" />
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </motion.div>
  );

  const mobileTabPortal = isMdOrBelow && headerCenterMobileEl && createPortal(
    <div className="pointer-events-auto relative flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center lg:hidden">
      <button
        type="button"
        onClick={() => setMobileTabMenuOpen((open) => !open)}
        className="flex min-w-0 items-center gap-1.5 text-black/80 transition-colors hover:text-black/60"
        aria-label="เปิดเมนูแท็บ"
        aria-expanded={mobileTabMenuOpen}
      >
        <ActiveTabIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-sukhumvit text-[12px] font-black">
          {activeTabConfig.label}
        </span>
        <HiChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-black/45 transition-transform ${mobileTabMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {mobileTabMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/20"
            aria-label="ปิดเมนูแท็บ"
            onClick={() => setMobileTabMenuOpen(false)}
          />
          <div className="fixed left-1/2 top-14 z-[100] w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
              จัดการนักเรียน
            </p>
            {studentTabs.map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>,
    headerCenterMobileEl,
  );

  const showMobileFilterButton = isMdOrBelow && activeTab === 'list' && !selectedStudent;

  const mobileFilterButtonPortal = showMobileFilterButton && headerMobileActionsEl && createPortal(
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={() => setFilterDrawerOpen(true)}
      className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      title="ตัวกรอง"
      aria-label="ตัวกรอง"
    >
      <TbFilter2 className="h-5 w-5" />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
      )}
    </motion.button>,
    headerMobileActionsEl,
  );

  const yearOptions = useMemo(() => [
    { value: '2565', label: 'ปี 2565' },
    { value: '2566', label: 'ปี 2566' },
    { value: '2567', label: 'ปี 2567' },
    { value: '2568', label: 'ปี 2568' },
    { value: '2569', label: 'ปี 2569' },
    { value: '2570', label: 'ปี 2570' },
  ], []);

  const departmentOptions = useMemo(() => [
    { value: '', label: 'แผนก' },
    { value: 'early', label: 'ปฐมวัย' },
    { value: 'primary', label: 'ประถมฯ' },
    { value: 'secondary', label: 'มัธยมฯ' },
  ], []);

  const drawerDepartmentOptions = useMemo(() => [
    { value: '', label: 'เลือกแผนก' },
    { value: 'early', label: 'ปฐมวัย' },
    { value: 'primary', label: 'ประถมฯ' },
    { value: 'secondary', label: 'มัธยมฯ' },
  ], []);

  const gradeOptions = useMemo(() => [
    { value: '', label: filter.department ? 'ชั้น' : 'เลือกชั้น' },
    ...(GRADE_ORDER[filter.department] ?? []).map((g) => ({ value: g, label: g })),
  ], [filter.department]);

  const classOptions = useMemo(() => [
    { value: '', label: filter.gradeLevel ? 'ห้อง' : 'เลือกห้อง' },
    ...availableClasses.map((c) => ({ value: c.classId, label: c.className })),
  ], [availableClasses, filter.gradeLevel]);

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden pb-4 gap-6 font-sukhumvit">
      {portalTarget && !isMdOrBelow && createPortal(navigation, portalTarget)}
      {mobileTabPortal}
      {mobileFilterButtonPortal}

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตัวกรองนักเรียน</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              เลือกปีการศึกษา แผนก ชั้น ห้องเรียน หรือค้นหาชื่อ
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            <DrawerFilterField
              label="ปีการศึกษา"
              value={filter.academicYearId || '2568'}
              onChange={(v) => setFilter((prev) => ({ ...prev, academicYearId: v, gradeLevel: '', classId: '' }))}
              options={yearOptions}
            />
            <DrawerFilterField
              label="แผนก"
              value={filter.department || ''}
              onChange={(v) => setFilter((prev) => ({ ...prev, department: v, gradeLevel: '', classId: '' }))}
              options={drawerDepartmentOptions}
            />
            <DrawerFilterField
              label="ชั้น"
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
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                ค้นหา
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="ชื่อ รหัสนักเรียน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
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

      {activeTab === 'overview' ? (
        <StudentOverviewDashboard
          studentCards={filteredStudentCards}
          stats={stats}
          academicYear={academicYear ?? undefined}
        />
      ) : activeTab === 'list' ? (
        <div className="flex flex-1 min-w-0 h-full overflow-hidden relative">

          {/* SINGLE PANEL */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-[2rem] bg-white/30 border border-white/30 p-4">

            {/* TOP FILTER BAR — step capsules */}
            {!selectedStudent && (
              <div className="mb-3 hidden shrink-0 flex-wrap items-center gap-1 lg:flex">

                {/* Step 1: Year */}
                <motion.div layout className="flex items-center h-7 bg-white/60 backdrop-blur-xl border border-white rounded-full px-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] shrink-0">
                  <FilterSelect
                    value={filter.academicYearId || '2568'}
                    onChange={v => setFilter(prev => ({ ...prev, academicYearId: v, gradeLevel: '', classId: '' }))}
                    options={yearOptions}
                  />
                </motion.div>

                {/* Arrow */}
                <ChevronRight size={10} className="text-slate-400 shrink-0" />

                {/* Step 2: Department */}
                <motion.div layout className="flex items-center h-7 bg-white/60 backdrop-blur-xl border border-white rounded-full px-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] shrink-0">
                  <FilterSelect
                    value={filter.department || ''}
                    onChange={v => setFilter(prev => ({ ...prev, department: v, gradeLevel: '', classId: '' }))}
                    options={departmentOptions}
                  />
                </motion.div>

                {/* Arrow + Step 3: Grade (shows when dept selected) */}
                <AnimatePresence>
                  {filter.department && (
                    <>
                      <motion.span
                        key="arrow-grade"
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                      >
                        <ChevronRight size={10} className="text-slate-400 shrink-0" />
                      </motion.span>
                      <motion.div
                        key="grade-capsule"
                        layout
                        initial={{ opacity: 0, x: -8, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.95 }}
                        className="flex items-center h-7 bg-white/60 backdrop-blur-xl border border-white rounded-full px-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] shrink-0"
                      >
                        <FilterSelect
                          value={filter.gradeLevel || ''}
                          onChange={v => setFilter(prev => ({ ...prev, gradeLevel: v, classId: '' }))}
                          options={gradeOptions}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Arrow + Step 4: Class (shows when grade selected) */}
                <AnimatePresence>
                  {filter.gradeLevel && (
                    <>
                      <motion.span
                        key="arrow-class"
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                      >
                        <ChevronRight size={10} className="text-slate-400 shrink-0" />
                      </motion.span>
                      <motion.div
                        key="class-capsule"
                        layout
                        initial={{ opacity: 0, x: -8, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.95 }}
                        className="flex items-center h-7 bg-white/60 backdrop-blur-xl border border-white rounded-full px-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] shrink-0"
                      >
                        <FilterSelect
                          value={filter.classId || ''}
                          onChange={v => setFilter(prev => ({ ...prev, classId: v }))}
                          options={classOptions}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 h-7 px-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <X size={10} strokeWidth={2.5} />
                      <span>ล้างตัวกรอง</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Spacer */}
                <div className="flex-1 min-w-0" />

                {/* Search */}
                <div className="relative min-w-0 max-w-[220px] w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                  <input
                    type="text"
                    placeholder="ค้นหา..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-7 h-7 bg-white/60 backdrop-blur-xl border border-white rounded-full text-[10px] font-black text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-50/50 focus:border-blue-200 transition-all w-full outline-none shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden"
              >
                {/* LEFT SIDE: Photo, Info, Edit Toggle, Tabs Selection */}
                <div className="w-full lg:w-[300px] flex flex-col shrink-0 lg:border-r lg:border-black/[0.05] lg:pr-6 min-h-0 overflow-y-auto scrollbar-hide">
                  {/* Back button */}
                  <div className="mb-4">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 border border-black/[0.07] text-blue-600 hover:text-blue-800 hover:bg-white shadow-sm transition-all cursor-pointer"
                      title="กลับไปหน้ารายชื่อ"
                    >
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>

                  {/* Student Photo */}
                  <div className="w-32 h-32 mx-auto rounded-full overflow-hidden shadow-[0_8px_20px_-8px_rgba(0,0,0,0.2)] shrink-0 group relative transition-all duration-500 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 mb-5 border-2 border-white/50">
                    <img
                      src={(isEditMode ? detailForm?.photoURL : selectedStudent.photoURL) || selectedStudent.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.id}`}
                      className={`w-full h-full object-cover transition-all duration-700 ${isEditMode ? 'blur-sm scale-110' : 'group-hover:scale-110'}`}
                      alt={selectedStudent.firstName}
                    />
                    
                    {isEditMode ? (
                      <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-[2px]">
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin mb-2" size={32} />
                        ) : (
                          <Camera className="text-white mb-2" size={32} />
                        )}
                        <span className="text-white text-[12px] font-black uppercase tracking-widest text-center px-2">
                          {isUploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปถ่าย'}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={isUploading}
                        />
                      </label>
                    ) : (
                      <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                    )}
                  </div>

                  {/* Student Info */}
                  <div className="mb-5 text-center">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-1">
                      {selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}
                    </h2>
                    <p className="text-base font-bold text-blue-600 mb-2">
                      รหัส: {selectedStudent.studentCode}
                    </p>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ background: STATUS_COLOR[selectedStudent.status] || '#94a3b8' }}
                      />
                      {STATUS_LABEL[selectedStudent.status] || 'ไม่ทราบสถานะ'}
                    </p>
                  </div>

                  {/* Edit Toggle and Actions */}
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center justify-between px-4 py-2 bg-[#f2f2f7]/85 border border-black/[0.03] rounded-2xl transition-all">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">โหมดแก้ไข</span>
                      <div
                        onClick={handleEditModeToggle}
                        className={`w-9 h-5 rounded-full p-0.5 flex cursor-pointer transition-colors ${isEditMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                      >
                        <motion.div
                          layout
                          className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {isEditMode && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-3 gap-1.5 w-full"
                        >
                          <motion.button
                            whileHover={{ scale: hasPendingChanges && !isSavingChanges ? 1.02 : 1 }}
                            whileTap={{ scale: hasPendingChanges && !isSavingChanges ? 0.98 : 1 }}
                            onClick={handleSaveDetailChanges}
                            disabled={!hasPendingChanges || isSavingChanges}
                            className={`flex items-center justify-center gap-1 w-full py-2 rounded-xl transition-all font-black text-[10px] tracking-tight shadow-sm border ${hasPendingChanges && !isSavingChanges ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                          >
                            {isSavingChanges ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} strokeWidth={2.5} />
                            )}
                            <span>บันทึก</span>
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleStudentStatus(selectedStudent.id)}
                            className={`flex items-center justify-center gap-1 w-full py-2 rounded-xl transition-all font-black text-[10px] tracking-tight ${selectedStudent.status === 'active' ? 'bg-white text-blue-600 border-black/5 hover:bg-slate-50' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'} shadow-sm border`}
                          >
                            <div className={`w-7 h-4 rounded-full p-0.5 flex transition-colors ${selectedStudent.status === 'active' ? 'bg-blue-500 justify-end' : 'bg-rose-500 justify-start'} shrink-0`}>
                              <motion.div
                                layout
                                className="w-2.5 h-2.5 bg-white rounded-full shadow-sm"
                              />
                            </div>
                            <span>{selectedStudent.status === 'active' ? 'พักเรียน' : 'เปิดสถานะ'}</span>
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (confirm(`ลบรายชื่อ ${selectedStudent.prefix}${selectedStudent.firstName}?`)) {
                                handleDelete(selectedStudent.id);
                              }
                            }}
                            className="flex items-center justify-center gap-1 w-full py-2 bg-[#fff1f2] hover:bg-[#ffe4e6] text-rose-600 rounded-xl transition-all font-black text-[10px] tracking-tight shadow-sm border border-rose-100"
                          >
                            <Trash2 size={12} strokeWidth={2.5} />
                            <span>ลบข้อมูล</span>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-px bg-black/[0.05] mb-5" />

                  {/* Tabs Selection inside Left Panel (Vertical style) */}
                  <div className="flex flex-col gap-1">
                    {[
                      { id: 'personal', label: 'ข้อมูลส่วนตัว', icon: HiUser },
                      { id: 'family', label: 'ข้อมูลครอบครัว', icon: HiUsers },
                      { id: 'map', label: 'แผนที่บ้าน', icon: HiMapPin },
                    ].map((tab) => {
                      const isActive = detailTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setDetailTab(tab.id as DetailTab)}
                          className={`flex items-center gap-3 py-2.5 px-4 rounded-xl transition-all text-left w-full cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-sm font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-black/[0.02] font-bold'}`}
                        >
                          <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                          <span className="text-[13px]">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT SIDE: Detail Form Content */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden h-full lg:pl-2">
                  <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0 px-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={detailTab + (isEditMode ? '-edit' : '-view')}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {detailForm && (
                          <StudentDetailFormTab
                            tab={detailTab}
                            viewData={selectedStudent}
                            formData={detailForm}
                            isEditMode={isEditMode}
                            onChange={(key, value) => handleDetailFormChange(key as string, value)}
                            guardianPrefixes={guardianPrefixes}
                            studentId={selectedStudent.id}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                  </div>
                </div>
              </motion.div>
            ) : (
              /* STUDENT CARD GRID */
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
              >
                {!hasActiveFilters ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-400 opacity-70 border-2 border-dashed border-slate-200 rounded-2xl">
                    <Search size={28} className="mb-3" />
                    <span className="text-sm font-bold">กรุณาเลือกตัวกรองก่อนแสดงรายชื่อ</span>
                  </div>
                ) : filteredStudentCards.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <Search size={28} className="mb-3" />
                    <span className="text-sm font-bold">ไม่พบรายชื่อ</span>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'pb-6',
                      isMdOrBelow
                        ? 'flex flex-col gap-2'
                        : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3',
                    )}
                  >
                    {filteredStudentCards.map(({ student, currentGrade }, idx) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                        onClick={() => setSelectedId(student.id)}
                        className={cn(
                          'group cursor-pointer border border-white/60 bg-white/60 transition-all hover:border-blue-200',
                          isMdOrBelow
                            ? 'flex items-center gap-3 rounded-2xl p-3 hover:bg-white/90 active:scale-[0.99]'
                            : 'flex flex-col items-center gap-2.5 rounded-2xl p-3 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md active:scale-95',
                        )}
                      >
                        <div
                          className={cn(
                            'overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-transform duration-300 group-hover:scale-105',
                            isMdOrBelow ? 'h-12 w-12 shrink-0' : 'h-16 w-16',
                          )}
                        >
                          <img
                            src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className={cn('min-w-0', isMdOrBelow ? 'flex-1' : 'w-full text-center')}>
                          <p className="truncate text-[13px] font-bold leading-tight text-slate-800 lg:text-[11px]">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-bold text-blue-500 lg:text-[9px]">
                            {student.studentCode || 'N/A'}
                          </p>
                          {!isMdOrBelow && currentGrade && (
                            <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400">
                              {currentGrade}
                            </span>
                          )}
                        </div>
                        {isMdOrBelow && currentGrade && (
                          <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-600">
                            {currentGrade}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Floating Action Bar — when students are multi-selected */}
          <AnimatePresence>
            {selectedStudentIds.size > 0 && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-2xl text-slate-900 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-4 border border-white scale-90 sm:scale-100"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white">
                    {selectedStudentIds.size}
                  </div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">รายการที่เลือก</span>
                </div>

                <div className="w-[1px] h-4 bg-slate-200" />

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('class')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  <DoorOpen size={12} />
                  จัดห้องเรียน
                </motion.button>

                <button
                  onClick={() => setSelectedStudentIds(new Set())}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'update' ? (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <StudentUpdateDataTab
            studentCards={filteredStudentCards}
            filter={filter}
            setFilter={setFilter}
            yearOptions={yearOptions}
            departmentOptions={departmentOptions}
            gradeOptions={gradeOptions}
            classOptions={classOptions}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
            updateStudent={updateStudent}
            guardianPrefixes={guardianPrefixes}
          />
        </Suspense>
      ) : activeTab === 'import' ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-[2rem] bg-white/30 border border-white/30 p-4">
          <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
            <StudentImportTab />
          </Suspense>
        </div>
      ) : activeTab === 'class' ? (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <ClassroomAssignmentTab />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <StudentTransitionTab />
        </Suspense>
      )}

      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingStudent={editingStudent}
      />
      <Suspense fallback={null}>
        <StudentCsvImportModal
          open={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
        />
      </Suspense>
    </div>
  );
}
