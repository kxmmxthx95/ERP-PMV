import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HiAcademicCap, HiChevronLeft, HiHomeModern, HiPlus } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { GRADE_LEVEL_ORDER, type ClassRoom, type NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { useClassroomManager } from './hooks/useClassroomManager';
import { useBrowseVisibleDepartments } from '@/hooks/useBrowseVisibleDepartments';
import { shouldCountDepartment } from '@/lib/departments/homeDepartment';
import ClassFormModal from './components/ClassFormModal';
import ClassStudentPanel from './components/ClassStudentPanel';
import ClassMobileBrowse from './components/ClassMobileBrowse';

function shortRoomLabel(room: ClassRoom): string {
  const n = String(room.roomNumber ?? '').trim();
  if (n) return n;
  const name = String(room.className ?? '').trim();
  return name.length > 4 ? name.slice(0, 4) : name || '—';
}

export default function ClassManager() {
  const mgr = useClassroomManager();
  const { homeDepartment, browseVisibleDepartments, isDeptScoped } = useBrowseVisibleDepartments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [desktopHeaderHost, setDesktopHeaderHost] = useState<HTMLDivElement | null>(null);
  const [isLgOrBelow, setIsLgOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsLgOrBelow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openAddModal = () => {
    setEditingClass(null);
    setModalOpen(true);
  };

  const scopedClasses = useMemo(() => {
    if (!isDeptScoped || !homeDepartment) return mgr.allClasses;
    return mgr.allClasses.filter(
      (c) => c.departmentId === homeDepartment || c.department === homeDepartment,
    );
  }, [mgr.allClasses, isDeptScoped, homeDepartment]);

  const browseClassCards = useMemo(() => {
    if (!isDeptScoped || !homeDepartment) return mgr.classCards;
    return mgr.classCards.filter((card) => {
      const dept = card.classRoom.departmentId || card.classRoom.department;
      return dept === homeDepartment;
    });
  }, [mgr.classCards, isDeptScoped, homeDepartment]);

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    scopedClasses
      .filter((c) => c.departmentId === filterDepartment || c.department === filterDepartment)
      .forEach((c) => {
        if (c.gradeLevel) grades.add(c.gradeLevel);
      });
    return Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [scopedClasses, filterDepartment]);

  const classOptions = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return scopedClasses
      .filter(
        (c) =>
          (c.departmentId === filterDepartment || c.department === filterDepartment)
          && c.gradeLevel === filterGradeLevel,
      )
      .slice()
      .sort((a, b) =>
        (a.roomNumber || a.className).localeCompare(b.roomNumber || b.className, undefined, {
          numeric: true,
        }),
      );
  }, [scopedClasses, filterDepartment, filterGradeLevel]);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return scopedClasses.find((c) => c.id === selectedClassId) ?? null;
  }, [scopedClasses, selectedClassId]);

  const handleSelectDept = (dept: Department) => {
    setFilterDepartment(dept);
    setFilterGradeLevel('');
    setSelectedClassId('');
    mgr.setFilterDept(dept);
    mgr.setFilterGrade('all');
  };

  const handleSelectGrade = (level: string) => {
    setFilterGradeLevel(level);
    setSelectedClassId('');
    mgr.setFilterGrade(level);
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
  };

  const handleMobileSelectClass = (classId: string) => {
    const room = scopedClasses.find((c) => c.id === classId);
    if (room?.gradeLevel) {
      setFilterGradeLevel(room.gradeLevel);
      mgr.setFilterGrade(room.gradeLevel);
    }
    handleSelectClass(classId);
  };

  const showMobileClassBrowse = isLgOrBelow && !selectedClassId;
  const needsCustomMobileBack = isLgOrBelow && Boolean(selectedClassId || filterDepartment);

  const classCountsByDept = useMemo(() => {
    const counts: Partial<Record<Department, number>> = {};
    (['early', 'primary', 'secondary'] as Department[]).forEach((dept) => {
      if (!shouldCountDepartment(dept, homeDepartment, isDeptScoped)) return;
      const n = mgr.summary.byDept[dept] ?? 0;
      if (n > 0) counts[dept] = n;
    });
    return counts;
  }, [mgr.summary.byDept, homeDepartment, isDeptScoped]);

  const handleMobileBack = useCallback(() => {
    if (selectedClassId) {
      setSelectedClassId('');
      return;
    }
    setFilterDepartment('');
    setFilterGradeLevel('');
    setSelectedClassId('');
    mgr.setFilterDept('all');
    mgr.setFilterGrade('all');
  }, [selectedClassId, mgr]);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = needsCustomMobileBack ? 'none' : '';
  }, [needsCustomMobileBack]);

  useEffect(() => {
    if (!isLgOrBelow) return;
    document.getElementById('portal-scroll-container')?.scrollTo({ top: 0 });
  }, [isLgOrBelow, filterDepartment, selectedClassId]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingClass(null);
  };

  const emptyHint = !filterDepartment
    ? 'เลือกแผนกจากแถบด้านซ้าย'
    : !filterGradeLevel
      ? 'เลือกระดับชั้นเพื่อดูห้องเรียน'
      : 'เลือกห้องเรียนเพื่อจัดการ';

  const collapsedBrowseRail = filterDepartment ? (
    <div className="flex w-full flex-col items-center gap-2 border-t border-border px-1.5 py-2">
      {availableGrades.map((grade) => {
        const active = filterGradeLevel === grade;
        return (
          <button
            key={grade}
            type="button"
            onClick={() => handleSelectGrade(grade)}
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

      {filterGradeLevel
        ? classOptions.map((room) => {
            const active = selectedClassId === room.id;
            const label = shortRoomLabel(room);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => handleSelectClass(room.id)}
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

  return (
    <div className="flex h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)] min-h-0 w-full flex-col overflow-hidden font-sukhumvit">
      {needsCustomMobileBack && headerMobileBackEl && createPortal(
        <button
          type="button"
          onClick={handleMobileBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
          title={selectedClassId ? 'กลับเลือกห้องเรียน' : 'กลับเลือกแผนก'}
          aria-label={selectedClassId ? 'กลับเลือกห้องเรียน' : 'กลับเลือกแผนก'}
        >
          <HiChevronLeft size={16} />
        </button>,
        headerMobileBackEl,
      )}

      {!selectedClassId && headerCenterMobilePortalEl && createPortal(
        <div className="pointer-events-none flex items-center gap-1.5 lg:hidden">
          <HiAcademicCap className="h-4 w-4 shrink-0 text-black/80" />
          <span className="whitespace-nowrap font-sukhumvit text-[13px] font-black leading-none tracking-tight text-black/80">
            ห้องเรียน
          </span>
        </div>,
        headerCenterMobilePortalEl,
      )}

      {headerMobileActionsEl && createPortal(
        <div className={cn('pointer-events-auto relative flex lg:hidden', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={openAddModal}
            className={HEADER_ICON_BTN}
            title="เพิ่มห้องเรียน"
            aria-label="เพิ่มห้องเรียน"
          >
            <HiPlus size={16} />
          </button>
        </div>,
        headerMobileActionsEl,
      )}

      {headerRightActionsEl && createPortal(
        <div className={cn('pointer-events-auto hidden lg:flex', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={openAddModal}
            className={HEADER_ICON_BTN}
            title="เพิ่มห้องเรียน"
            aria-label="เพิ่มห้องเรียน"
          >
            <HiPlus size={16} />
          </button>
        </div>,
        headerRightActionsEl,
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
        {showMobileClassBrowse ? (
          <ClassMobileBrowse
            selectedDept={filterDepartment}
            gradeOptions={availableGrades}
            classCards={browseClassCards}
            classCountsByDept={classCountsByDept}
            departments={browseVisibleDepartments}
            onSelectDept={handleSelectDept}
            onSelectClass={handleMobileSelectClass}
          />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
            selectedClassId ? 'hidden lg:flex' : 'hidden min-h-0 flex-1 lg:flex lg:flex-none',
          )}
        >
          <GradeBookClassSidebar
            selectedDept={filterDepartment}
            selectedGrade={filterGradeLevel}
            selectedClassId={selectedClassId}
            gradeOptions={availableGrades}
            classOptions={classOptions}
            departments={browseVisibleDepartments}
            onSelectDept={handleSelectDept}
            onSelectGrade={handleSelectGrade}
            onSelectClass={handleSelectClass}
            collapsed={sidebarCollapsed}
            collapsedExtra={collapsedBrowseRail}
            headerAction={(
              <SidebarCollapseButton
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((v) => !v)}
              />
            )}
          />
        </div>

        <div
          className={cn(
            'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
            !selectedClassId && 'hidden lg:flex',
            isLgOrBelow && selectedClassId && 'rounded-none border-0 bg-transparent px-3 pb-4 pt-2 sm:px-3',
          )}
        >
          {selectedClass && (
            <div className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex">
              <div
                ref={setDesktopHeaderHost}
                className="flex h-10 w-full min-w-0 items-center"
              />
            </div>
          )}

          {selectedClass ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ClassStudentPanel
                key={selectedClassId}
                classRoom={selectedClass}
                desktopHeaderHost={desktopHeaderHost}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <HiAcademicCap className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                {emptyHint}
              </p>
            </div>
          )}
        </div>
      </div>

      <ClassFormModal
        open={modalOpen}
        editingClass={editingClass}
        yearId={mgr.yearId}
        semester={mgr.semester}
        teachers={mgr.availableTeachers}
        onClose={closeModal}
        onSubmit={async (data: NewClassRoom) => await mgr.addClass(data)}
        onUpdate={async (id, data) => await mgr.updateClass(id, data)}
        onDelete={async (id) => await mgr.deleteClass(id)}
      />
    </div>
  );
}
