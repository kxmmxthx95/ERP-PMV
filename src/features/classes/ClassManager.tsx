import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HiAcademicCap, HiChevronLeft, HiHomeModern, HiPlus } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { GRADE_LEVEL_ORDER, type ClassRoom, type NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { useClassroomManager } from './hooks/useClassroomManager';
import ClassFormModal from './components/ClassFormModal';
import ClassStudentPanel from './components/ClassStudentPanel';

function shortRoomLabel(room: ClassRoom): string {
  const n = String(room.roomNumber ?? '').trim();
  if (n) return n;
  const name = String(room.className ?? '').trim();
  return name.length > 4 ? name.slice(0, 4) : name || '—';
}

export default function ClassManager() {
  const mgr = useClassroomManager();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [desktopHeaderHost, setDesktopHeaderHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  const openAddModal = () => {
    setEditingClass(null);
    setModalOpen(true);
  };

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    mgr.allClasses
      .filter((c) => c.departmentId === filterDepartment || c.department === filterDepartment)
      .forEach((c) => {
        if (c.gradeLevel) grades.add(c.gradeLevel);
      });
    return Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [mgr.allClasses, filterDepartment]);

  const classOptions = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return mgr.allClasses
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
  }, [mgr.allClasses, filterDepartment, filterGradeLevel]);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return mgr.allClasses.find((c) => c.id === selectedClassId) ?? null;
  }, [mgr.allClasses, selectedClassId]);

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
    <div className="flex max-h-[min(50vh,24rem)] w-full flex-col items-center gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide border-t border-border px-1.5 py-2">
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
    <div className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] min-h-0 w-full flex-col overflow-hidden font-sukhumvit">
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
          {selectedClassId && (
            <button
              type="button"
              onClick={() => setSelectedClassId('')}
              className={HEADER_ICON_BTN}
              title="กลับ"
              aria-label="กลับ"
            >
              <HiChevronLeft size={16} />
            </button>
          )}
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
        <div
          className={cn(
            'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
            selectedClassId ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
          )}
        >
          <GradeBookClassSidebar
            selectedDept={filterDepartment}
            selectedGrade={filterGradeLevel}
            selectedClassId={selectedClassId}
            gradeOptions={availableGrades}
            classOptions={classOptions}
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
            'flex min-h-0 flex-1 basis-0 flex-col overflow-hidden',
            !selectedClassId && 'hidden lg:flex',
          )}
        >
          {selectedClass && (
            <div className="mb-2 hidden min-h-[3.25rem] shrink-0 items-center border-b border-border pb-2 pt-2 sm:pt-2.5 lg:flex">
              <div
                ref={setDesktopHeaderHost}
                className="flex h-10 w-full min-w-0 items-center"
              />
            </div>
          )}

          {selectedClass ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ClassStudentPanel
                classRoom={selectedClass}
                desktopHeaderHost={desktopHeaderHost}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
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
