import { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X,
  DoorOpen,
  Trash2,
  ChevronDown,
  Camera, Loader2, Save
} from 'lucide-react';
import {
  HiUser,
  HiUsers,
  HiMapPin,
  HiViewColumns,
  HiBuildingOffice2,
  HiArrowUpCircle,
  HiChevronDown,
  HiHomeModern,
  HiOutlineFunnel,
  HiArrowLeft,
  HiPlus,
  HiAcademicCap,
} from 'react-icons/hi2';
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
import StudentAvatar from './components/StudentAvatar';
import StudentImportChooser from './components/StudentImportChooser';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import type { Student } from '@/types/student';
import type { Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER, type ClassRoom } from '@/types/class';
import { cn } from '@/lib/utils';

const StudentCsvImportModal = lazy(() => import('./components/StudentCsvImportModal'));
const ClassroomAssignmentTab = lazy(() => import('./components/ClassroomAssignmentTab'));
const StudentTransitionTab = lazy(() => import('./components/StudentTransitionTab'));

type StudentTab = 'overview' | 'list' | 'class' | 'promote';
type DetailTab = 'personal' | 'family' | 'map';

function shortRoomLabel(room: ClassRoom): string {
  const n = String(room.roomNumber ?? '').trim();
  if (n) return n;
  const name = String(room.className ?? '').trim();
  return name.length > 4 ? name.slice(0, 4) : name || '—';
}

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_GRID = 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) minmax(4rem, 0.7fr) minmax(5rem, 0.9fr)';

const STUDENT_TAB_CONFIG: Record<StudentTab, { label: string; icon: IconType }> = {
  overview: { label: 'ภาพรวม', icon: HiUsers },
  list: { label: 'รายชื่อ', icon: HiViewColumns },
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
    classrooms,
    addStudent, updateStudent, deleteStudent, toggleStudentStatus,
    getStudentById,
  } = useStudentManager(academicYear ?? '2568');

  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
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
  const [importChooserOpen, setImportChooserOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudentTab>('list');
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('personal');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = !!(filter.department || filter.gradeLevel || filter.classId || searchQuery);
  const yearClassrooms = useMemo(
    () => (classrooms as unknown as ClassRoom[]).filter((c) => {
      const row = c as ClassRoom & { academicYear?: string };
      return (
        String(c.academicYearId) === String(filter.academicYearId) ||
        String(row.academicYear ?? '') === String(filter.academicYearId)
      );
    }),
    [classrooms, filter.academicYearId],
  );

  const sidebarGradeOptions = useMemo(() => {
    if (!filter.department) return [] as string[];
    const grades = new Set<string>();
    yearClassrooms.forEach((c) => {
      if (c.departmentId === filter.department && c.gradeLevel) grades.add(String(c.gradeLevel));
    });
    return Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [yearClassrooms, filter.department]);

  const sidebarClassOptions = useMemo(() => {
    if (!filter.department || !filter.gradeLevel) return [] as ClassRoom[];
    return yearClassrooms
      .filter((c) => c.departmentId === filter.department && c.gradeLevel === filter.gradeLevel)
      .slice()
      .sort((a, b) =>
        String(a.roomNumber || a.className).localeCompare(
          String(b.roomNumber || b.className),
          undefined,
          { numeric: true },
        ),
      );
  }, [yearClassrooms, filter.department, filter.gradeLevel]);

  const handleSidebarSelectDept = useCallback((dept: Department) => {
    setFilter((prev) => ({
      ...prev,
      department: prev.department === dept ? '' : dept,
      gradeLevel: '',
      classId: '',
    }));
    setSelectedId(null);
  }, [setFilter]);

  const handleSidebarSelectGrade = useCallback((grade: string) => {
    setFilter((prev) => ({
      ...prev,
      gradeLevel: prev.gradeLevel === grade ? '' : grade,
      classId: '',
    }));
    setSelectedId(null);
  }, [setFilter]);

  const handleSidebarSelectClass = useCallback((classId: string) => {
    setFilter((prev) => ({ ...prev, classId }));
    setSelectedId(null);
  }, [setFilter]);

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
      return;
    }
    await addStudent(data);
    // Stay on list — do not open detail (multi-add via form)
  };

  const handleDelete = async (id: string) => {
    await deleteStudent(id);
    if (selectedId === id) {
      const next = filteredStudentCards.find(c => c.student.id !== id);
      setSelectedId(next?.student.id ?? null);
    }
  };

  const studentTabs = (
    Object.entries(STUDENT_TAB_CONFIG) as [StudentTab, typeof STUDENT_TAB_CONFIG[StudentTab]][]
  ).filter(([key]) => key !== 'overview');
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
    <button
      type="button"
      onClick={() => setFilterDrawerOpen(true)}
      className={HEADER_ICON_BTN}
      title="ตัวกรอง"
      aria-label="ตัวกรอง"
    >
      <HiOutlineFunnel size={16} />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
      )}
    </button>,
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

  const collapsedBrowseRail = filter.department ? (
    <div className="flex w-full flex-col items-center gap-2 border-t border-border px-1.5 py-2">
      {sidebarGradeOptions.map((grade) => {
        const active = filter.gradeLevel === grade;
        return (
          <button
            key={grade}
            type="button"
            onClick={() => handleSidebarSelectGrade(grade)}
            title={grade}
            aria-label={grade}
            aria-pressed={active}
            className={cn(
              'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
              active
                ? 'border-2 border-foreground bg-foreground text-background'
                : 'border border-border bg-muted/40 text-foreground hover:bg-muted',
            )}
          >
            <HiAcademicCap className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black font-sukhumvit leading-none">{grade}</span>
          </button>
        );
      })}

      {filter.gradeLevel
        ? sidebarClassOptions.map((room) => {
            const active = filter.classId === room.id;
            const label = shortRoomLabel(room);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => handleSidebarSelectClass(room.id)}
                title={room.className}
                aria-label={room.className}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
                  active
                    ? 'border-2 border-foreground bg-foreground text-background'
                    : 'border border-border bg-card text-foreground hover:bg-muted/50',
                )}
              >
                <HiHomeModern className="h-3.5 w-3.5" />
                <span className="max-w-full truncate px-0.5 text-[9px] font-black font-sukhumvit leading-none">
                  {label}
                </span>
              </button>
            );
          })
        : null}
    </div>
  ) : null;

  const showPaneHeaderTabs = !isMdOrBelow && !(activeTab === 'list' && selectedId);
  const paneHeaderTabs = showPaneHeaderTabs ? (
    <div className="flex min-w-0 shrink overflow-x-auto scrollbar-none">
      {navigation}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'flex w-full min-h-0 flex-1 flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {mobileTabPortal}
      {mobileFilterButtonPortal}

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตัวกรองนักเรียน</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              เลือกปีการศึกษา หรือค้นหาชื่อ
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            <DrawerFilterField
              label="ปีการศึกษา"
              value={filter.academicYearId || '2568'}
              onChange={(v) => setFilter((prev) => ({ ...prev, academicYearId: v, gradeLevel: '', classId: '' }))}
              options={yearOptions}
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
        <div className="relative flex h-full min-h-0 max-h-full flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
          {!selectedStudent && (
            <div
              className={cn(
                'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
                sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
                filter.classId ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
              )}
            >
              <GradeBookClassSidebar
                selectedDept={filter.department}
                selectedGrade={filter.gradeLevel}
                selectedClassId={filter.classId}
                gradeOptions={sidebarGradeOptions}
                classOptions={sidebarClassOptions}
                onSelectDept={handleSidebarSelectDept}
                onSelectGrade={handleSidebarSelectGrade}
                onSelectClass={handleSidebarSelectClass}
                collapsed={sidebarCollapsed}
                collapsedExtra={collapsedBrowseRail}
                headerAction={(
                  <>
                    {!sidebarCollapsed && (
                      <div className="relative flex h-8 min-w-0 flex-1 items-center rounded-full border border-border bg-muted/50 px-2 shadow-sm">
                        <select
                          value={filter.academicYearId || '2568'}
                          onChange={(e) => {
                            setFilter((prev) => ({
                              ...prev,
                              academicYearId: e.target.value,
                              gradeLevel: '',
                              classId: '',
                            }));
                            setSelectedId(null);
                          }}
                          aria-label="ปีการศึกษา"
                          className="w-full min-w-0 appearance-none bg-transparent pr-5 text-[11px] font-bold text-foreground outline-none font-sukhumvit"
                        >
                          {yearOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <HiChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    )}
                    <div className={cn('flex shrink-0', HEADER_ICON_BTN_GROUP)}>
                      {!sidebarCollapsed && (
                        <button
                          type="button"
                          onClick={() => setImportChooserOpen(true)}
                          className={HEADER_ICON_BTN}
                          title="นำเข้านักเรียน"
                          aria-label="นำเข้านักเรียน"
                        >
                          <HiPlus size={16} />
                        </button>
                      )}
                      <SidebarCollapseButton
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed((v) => !v)}
                      />
                    </div>
                  </>
                )}
              />
            </div>
          )}

          <div
            className={cn(
              'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
              !selectedStudent && !filter.classId && 'hidden lg:flex',
            )}
          >
            {/* TOP BAR — same height/border as GradeBookClassSidebar */}
            {!selectedStudent && paneHeaderTabs && (
              <div className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex">
                {paneHeaderTabs}
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
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className={HEADER_ICON_BTN}
                      title="กลับไปหน้ารายชื่อ"
                      aria-label="กลับไปหน้ารายชื่อ"
                    >
                      <HiArrowLeft size={16} />
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
                    <p className="text-[10px] font-bold text-slate-400 mb-2 break-all">
                      Firebase ID: {selectedStudent.id}
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
              /* STUDENT LIST TABLE */
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
              >
                {!filter.classId ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
                    <HiHomeModern className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-[13px] font-black text-muted-foreground font-sukhumvit">
                      {!filter.department
                        ? 'เลือกแผนกจากแถบด้านซ้าย'
                        : !filter.gradeLevel
                          ? 'เลือกชั้นจากแถบด้านซ้าย'
                          : 'เลือกห้องเรียนจากแถบด้านซ้าย'}
                    </p>
                  </div>
                ) : filteredStudentCards.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p className="text-[13px] font-sarabun">ไม่พบรายชื่อ</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-6">
                    {/* Mobile cards */}
                    <div className="flex flex-col gap-2.5 md:hidden">
                      {filteredStudentCards.map(({ student, currentGrade }, i) => {
                        const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
                        return (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            onClick={() => setSelectedId(student.id)}
                            className="cursor-pointer rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3">
                              <StudentAvatar
                                photoURL={student.photoURL}
                                studentId={student.id}
                                name={fullName}
                                className="h-9 w-9 shrink-0 rounded-full"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">
                                  {fullName}
                                </p>
                                <p className="mt-0.5 text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                                  {student.studentCode || '—'}
                                </p>
                              </div>
                              {currentGrade ? (
                                <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                                  {currentGrade}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                              <span className="text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                สถานะ
                              </span>
                              <span className="text-[12px] font-bold text-foreground font-sukhumvit">
                                {STATUS_LABEL[student.status] || '—'}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className={cn('hidden md:block', TABLE_SHELL)}>
                      <div className="border-b border-border bg-background">
                        <div
                          className="grid gap-3 px-4 py-3"
                          style={{ gridTemplateColumns: TABLE_GRID }}
                        >
                          <span className={TABLE_HEADER_CELL}>รหัส</span>
                          <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                          <span className={TABLE_HEADER_CELL}>ชั้น</span>
                          <span className={TABLE_HEADER_CELL}>สถานะ</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {filteredStudentCards.map(({ student, currentGrade }, i) => {
                          const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
                          return (
                            <motion.div
                              key={student.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.015 }}
                              onClick={() => setSelectedId(student.id)}
                              className="grid cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
                              style={{ gridTemplateColumns: TABLE_GRID }}
                            >
                              <span className="truncate text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                                {student.studentCode || '—'}
                              </span>
                              <div className="flex min-w-0 items-center gap-3">
                                <StudentAvatar
                                  photoURL={student.photoURL}
                                  studentId={student.id}
                                  name={fullName}
                                  className="h-9 w-9 shrink-0 rounded-full"
                                />
                                <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">
                                  {fullName}
                                </p>
                              </div>
                              <span className="truncate text-[13px] font-semibold text-foreground font-sukhumvit">
                                {currentGrade || (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </span>
                              <span className="truncate text-[13px] font-semibold text-foreground font-sukhumvit">
                                {STATUS_LABEL[student.status] || (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
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
      ) : activeTab === 'class' ? (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <ClassroomAssignmentTab headerTabs={paneHeaderTabs} />
        </Suspense>
      ) : (
        <div className="relative flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5">
          <div className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex">
            {paneHeaderTabs}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
              <StudentTransitionTab />
            </Suspense>
          </div>
        </div>
      )}

      <StudentImportChooser
        open={importChooserOpen}
        onOpenChange={setImportChooserOpen}
        isMobile={isMdOrBelow}
        onSelectCsv={() => setCsvModalOpen(true)}
        onSelectForm={() => setModalOpen(true)}
      />
      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingStudent={editingStudent}
        defaultAcademicYearId={filter.academicYearId || academicYear || undefined}
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
