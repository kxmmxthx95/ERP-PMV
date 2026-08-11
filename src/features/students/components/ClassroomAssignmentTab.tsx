import React, { useState, useEffect, useMemo, useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiArrowRight, HiPlus, HiXMark,
    HiChevronLeft,
    HiPencil, HiTrash,
    HiAcademicCap,
    HiUserPlus,
    HiMagnifyingGlass,
    HiOutlineBookOpen,
} from 'react-icons/hi2';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    getStudentsByYearStore,
    getEnrollmentsByYearStore,
    getClassesByYearStore,
    invalidateStudentSummaryCache,
} from '@/lib/firestoreShared/studentSummaryStore';
import { curriculumsCollectionStore } from '@/lib/firestoreShared/curriculumsStore';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import {
    DRAWER_HEADER_ICON_BTN,
    DRAWER_HEADER_RIGHT_ACTIONS,
} from '@/lib/drawerHeaderBtn';
import { GRADE_LEVEL_ORDER, type ClassRoom, type ClassRoomCard } from '@/types/class';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import ClassMobileBrowse from '@/features/classes/components/ClassMobileBrowse';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_GRID = 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) minmax(4rem, 0.7fr) minmax(3rem, 0.45fr)';
const FIELD_INPUT =
    'h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20';
const FIELD_LABEL = 'pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600';

const ASSIGN_DRAWER_CONTENT = cn(
    'flex h-dvh flex-col bg-transparent p-0 before:hidden',
    'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
    'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);
const ASSIGN_DRAWER_PANEL = cn(
    'flex h-full min-h-0 flex-col overflow-hidden bg-white',
    'sm:rounded-4xl sm:border sm:border-border sm:shadow-xl',
);

// --- Grade Progression Maps ---
const GRADE_ORDER: Record<string, string[]> = {
    early: ['อ.1', 'อ.2', 'อ.3'],
    primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
    secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

// --- Types ---
interface Student {
    id: string;
    studentCode?: string;
    nationalId: string;
    prefix: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    academicYearId?: string;
    classroomId: string | null;
    currentTrack?: string;
    photoURL?: string;
}

interface CurriculumPackage {
    id: string;
    name?: string;
    versionName?: string;
    gradeLevel?: string;
    assignedGrades?: string[];
    departmentId?: string;
    academicYearId?: string;
    year?: string | number;
}

interface Classroom {
    id: string;
    className: string;
    gradeLevel: string;
    roomNumber: string;
    departmentId?: string;
    academicYearId?: string;
    capacity?: number;
    studentIds?: string[];
    track?: string;
    trackColor?: string;
    curriculumPackageId?: string | null;
    homeroomTeacherIds?: string[];
}

const TRACK_OPTIONS = [
    { label: 'วิทย์-คณิต', color: 'bg-blue-500 shadow-blue-500/40' },
    { label: 'วิทย์-คอม', color: 'bg-indigo-500 shadow-indigo-500/40' },
    { label: 'ศิลป์-คำนวณ', color: 'bg-pink-500 shadow-pink-500/40' },
    { label: 'ศิลป์-ภาษา', color: 'bg-orange-500 shadow-orange-500/40' },
    { label: 'ทั่วไป', color: 'bg-slate-500 shadow-slate-500/40' },
];
const ACADEMIC_YEARS = ['2566', '2567', '2568', '2569'];

function enrollmentMatchesYear(data: { academicYearId?: string; academicYear?: string }, year: string): boolean {
    return (
        String(data.academicYearId ?? data.academicYear ?? '') === String(year)
    );
}

function PanelCapsuleSelect({
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-10 w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 text-xs font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-100 hover:bg-slate-50 transition-colors">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="font-sukhumvit">
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold">
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default function ClassroomAssignmentTab({ headerTabs }: { headerTabs?: ReactNode }) {
    const { year: activeYear } = useActiveAcademicYear();

    // --- State ---
    const [classroomYear, setClassroomYear] = useState<string>(activeYear);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoom, setNewRoom] = useState({
        name: '',
        gradeLevel: 'ม.4',
        departmentId: 'secondary',
        capacity: '40',
        track: TRACK_OPTIONS[0].label,
        trackColor: TRACK_OPTIONS[0].color,
        academicYearId: classroomYear,
        curriculumPackageId: '',
        homeroomTeacherIds: [] as string[],
    });
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deptFilter, setDeptFilter] = useState<string>('');
    const [gradeFilter, setGradeFilter] = useState<string>('');
    const [curriculumFilter, setCurriculumFilter] = useState<string>('');

    const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isLgOrBelow, setIsLgOrBelow] = useState(() => window.innerWidth < 1024);
    const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
    const [addStudentsOpen, setAddStudentsOpen] = useState(false);
    const [addStudentsSearch, setAddStudentsSearch] = useState('');
    const [drawerSelectedIds, setDrawerSelectedIds] = useState<Set<string>>(new Set());
    const [curriculumDrawerOpen, setCurriculumDrawerOpen] = useState(false);
    const [curriculumSearch, setCurriculumSearch] = useState('');
    const [drawerCurriculumId, setDrawerCurriculumId] = useState<string | null>(null);
    const [curriculumFilterDept, setCurriculumFilterDept] = useState<Department | ''>('');
    const [curriculumFilterGrade, setCurriculumFilterGrade] = useState('');
    const [curriculumFilterYear, setCurriculumFilterYear] = useState('');

    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Bulk Select State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [bulkTargetClass, setBulkTargetClass] = useState<string>('');

    useEffect(() => {
        if (!editingClassroom) {
            setNewRoom(prev => ({ ...prev, academicYearId: classroomYear }));
        }
    }, [classroomYear, editingClassroom]);

    useEffect(() => {
        setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const onChange = () => setIsLgOrBelow(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    // --- Shared cached data (ไม่ refetch ทั้งโรงเรียนใหม่ทุกครั้งที่ mount/สลับ tab) ---
    const studentsStore = useMemo(() => getStudentsByYearStore(classroomYear), [classroomYear]);
    const enrollmentsStore = useMemo(() => getEnrollmentsByYearStore(classroomYear), [classroomYear]);
    const classesStore = useMemo(() => getClassesByYearStore(classroomYear), [classroomYear]);

    const rawStudents = useSyncExternalStore(studentsStore.subscribe, studentsStore.getSnapshot, studentsStore.getSnapshot);
    const rawEnrollments = useSyncExternalStore(enrollmentsStore.subscribe, enrollmentsStore.getSnapshot, enrollmentsStore.getSnapshot);
    const rawClassrooms = useSyncExternalStore(classesStore.subscribe, classesStore.getSnapshot, classesStore.getSnapshot);
    const rawCurriculums = useSyncExternalStore(
        curriculumsCollectionStore.subscribe,
        curriculumsCollectionStore.getSnapshot,
        curriculumsCollectionStore.getSnapshot,
    );
    const loading = !studentsStore.getReady() || !enrollmentsStore.getReady() || !classesStore.getReady();

    const classrooms = rawClassrooms as unknown as Classroom[];
    const curriculumPackages = rawCurriculums as unknown as CurriculumPackage[];

    const students = useMemo(() => {
        return (rawStudents as unknown as Student[]).map(student => {
            const enrollment = rawEnrollments.find(
                e => e.studentId === student.id && enrollmentMatchesYear(e, classroomYear),
            );
            if (enrollment) {
                return {
                    ...student,
                    academicYearId: String(enrollment.academicYearId),
                    gradeLevel: enrollment.gradeLevel || student.gradeLevel,
                    classroomId: enrollment.classId || student.classroomId || null,
                };
            }
            return student;
        });
    }, [rawStudents, rawEnrollments, classroomYear]);

    // --- Derived State ---
    const sidebarGradeOptions = useMemo(() => {
        if (!deptFilter) return [] as string[];
        const grades = new Set<string>();
        classrooms.forEach((c) => {
            if (c.departmentId === deptFilter && c.gradeLevel) grades.add(String(c.gradeLevel));
        });
        return Array.from(grades).sort(
            (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
        );
    }, [classrooms, deptFilter]);

    const sidebarClassOptions = useMemo(() => {
        if (!deptFilter || !gradeFilter) return [] as ClassRoom[];
        return classrooms
            .filter((c) => c.departmentId === deptFilter && c.gradeLevel === gradeFilter)
            .slice()
            .sort((a, b) =>
                String(a.roomNumber || a.className).localeCompare(
                    String(b.roomNumber || b.className),
                    undefined,
                    { numeric: true },
                ),
            ) as unknown as ClassRoom[];
    }, [classrooms, deptFilter, gradeFilter]);

    const handleSidebarSelectDept = useCallback((dept: Department) => {
        setDeptFilter((prev) => (prev === dept ? '' : dept));
        setGradeFilter('');
        setSelectedClassroomId(null);
    }, []);

    const handleSidebarSelectGrade = useCallback((grade: string) => {
        setGradeFilter((prev) => (prev === grade ? '' : grade));
        setSelectedClassroomId(null);
    }, []);

    const handleSidebarSelectClass = useCallback((classId: string) => {
        setSelectedClassroomId(classId);
    }, []);

    const filteredClassrooms = useMemo(() => {
        return classrooms
            .filter((cls) => {
                const matchDept = !deptFilter || cls.departmentId === deptFilter;
                const matchGrade = !gradeFilter || cls.gradeLevel === gradeFilter;
                return matchDept && matchGrade;
            })
            .sort((a, b) => {
                const flatGrades = Object.values(GRADE_ORDER).flat();
                const gradeIndexA = flatGrades.indexOf(a.gradeLevel);
                const gradeIndexB = flatGrades.indexOf(b.gradeLevel);
                if (gradeIndexA !== gradeIndexB) {
                    return (gradeIndexA === -1 ? 999 : gradeIndexA) - (gradeIndexB === -1 ? 999 : gradeIndexB);
                }
                return a.className.localeCompare(b.className, undefined, { numeric: true });
            });
    }, [classrooms, deptFilter, gradeFilter]);

    const classroomScopedStudents = useMemo(() => {
        let result = students;

        if (classroomYear) {
            result = result.filter(s => {
                if (s.classroomId) {
                    const cls = classrooms.find(c => c.id === s.classroomId);
                    return !!cls;
                }
                const studentCurrentYear = (s as any).academicYear || s.academicYearId;
                return String(studentCurrentYear) === classroomYear;
            });
        }
        return result;
    }, [students, classroomYear, classrooms]);

    const studentsByClass = useMemo(() => {
        const groups: Record<string, Student[]> = { 'unassigned': [] };
        classrooms.forEach(c => groups[c.id] = []);

        classroomScopedStudents.forEach(student => {
            if (student.classroomId && groups[student.classroomId]) {
                groups[student.classroomId].push(student);
            } else {
                groups['unassigned'].push(student);
            }
        });
        return groups;
    }, [classroomScopedStudents, classrooms]);

    const selectedClassroom = useMemo(
        () => classrooms.find((c) => c.id === selectedClassroomId) ?? null,
        [classrooms, selectedClassroomId],
    );

    const classCountsByDept = useMemo(() => {
        const counts: Partial<Record<Department, number>> = {};
        classrooms.forEach((cls) => {
            const dept = cls.departmentId as Department | undefined;
            if (dept) counts[dept] = (counts[dept] ?? 0) + 1;
        });
        return counts;
    }, [classrooms]);

    const browseClassCards = useMemo((): ClassRoomCard[] => {
        return classrooms.map((cls) => {
            const studentCount = studentsByClass[cls.id]?.length ?? 0;
            const dept = (cls.departmentId || 'secondary') as Department;
            return {
                classRoom: {
                    id: cls.id,
                    className: cls.className,
                    gradeLevel: cls.gradeLevel,
                    roomNumber: cls.roomNumber,
                    departmentId: dept,
                    department: dept,
                    academicYearId: cls.academicYearId || classroomYear,
                    semester: 1,
                    homeroomTeacherId: cls.homeroomTeacherIds?.[0] || '',
                    homeroomTeacherIds: cls.homeroomTeacherIds || [],
                    enrolledCourses: [],
                    studentCount,
                    maxStudents: cls.capacity || 40,
                    track: cls.track,
                    trackColor: cls.trackColor,
                    isActive: true,
                    createdAt: '',
                },
                homeroomTeacher: null,
                homeroomTeachers: [],
                scheduledPeriods: 0,
                totalPeriods: 0,
                fillPct: 0,
                isFull: studentCount >= (cls.capacity || 40),
            };
        });
    }, [classrooms, studentsByClass, classroomYear]);

    const showMobileClassBrowse = isLgOrBelow && !selectedClassroomId;
    const needsCustomMobileBack = isLgOrBelow && Boolean(deptFilter || selectedClassroomId);

    const handleMobileBack = useCallback(() => {
        if (selectedClassroomId) {
            setSelectedClassroomId(null);
            return;
        }
        setDeptFilter('');
        setGradeFilter('');
    }, [selectedClassroomId]);

    useEffect(() => {
        const defaultBack = document.getElementById('portal-default-mobile-back');
        if (!defaultBack) return;
        defaultBack.style.display = needsCustomMobileBack ? 'none' : '';
    }, [needsCustomMobileBack]);

    useEffect(() => {
        if (!isLgOrBelow) return;
        document.getElementById('portal-scroll-container')?.scrollTo({ top: 0 });
    }, [isLgOrBelow, deptFilter, selectedClassroomId]);

    const curriculumDrawerGradeOptions = useMemo(() => {
        if (curriculumFilterDept) {
            return DEPARTMENT_CONFIG[curriculumFilterDept].grades;
        }
        return Object.values(GRADE_ORDER).flat();
    }, [curriculumFilterDept]);

    const curriculumDrawerCandidates = useMemo(() => {
        const q = curriculumSearch.trim().toLowerCase();
        return curriculumPackages
            .filter((pkg) => {
                const pkgYear = String(pkg.year || pkg.academicYearId || '').trim();
                if (curriculumFilterYear && pkgYear && pkgYear !== curriculumFilterYear) return false;

                const pkgGrades = pkg.assignedGrades?.length
                    ? pkg.assignedGrades
                    : pkg.gradeLevel
                        ? [pkg.gradeLevel]
                        : [];

                let pkgDept = (pkg.departmentId || '') as Department | '';
                if (!pkgDept && pkgGrades.length > 0) {
                    const found = (Object.keys(GRADE_ORDER) as Array<keyof typeof GRADE_ORDER>).find((dept) =>
                        pkgGrades.some((g) => GRADE_ORDER[dept].includes(g)),
                    );
                    pkgDept = (found as Department | undefined) ?? '';
                }

                if (curriculumFilterDept && pkgDept && pkgDept !== curriculumFilterDept) return false;
                if (curriculumFilterDept && !pkgDept && pkgGrades.length > 0) {
                    const deptGrades = DEPARTMENT_CONFIG[curriculumFilterDept].grades;
                    if (!pkgGrades.some((g) => deptGrades.includes(g))) return false;
                }
                if (curriculumFilterGrade) {
                    if (pkgGrades.length > 0 && !pkgGrades.includes(curriculumFilterGrade)) return false;
                }
                if (!q) return true;
                const label = `${pkg.name || ''} ${pkg.versionName || ''} ${pkg.id}`.toLowerCase();
                return label.includes(q);
            })
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [
        curriculumPackages,
        curriculumSearch,
        curriculumFilterYear,
        curriculumFilterDept,
        curriculumFilterGrade,
    ]);

    const hasCurriculumDrawerFilters = !!(
        curriculumFilterYear
        || curriculumFilterDept
        || curriculumFilterGrade
        || curriculumSearch.trim()
    );

    const assignDrawerCandidates = useMemo(() => {
        if (!selectedClassroom) return [] as Student[];
        const q = addStudentsSearch.trim().toLowerCase();
        return (studentsByClass.unassigned ?? [])
            .filter((s) => {
                if (selectedClassroom.gradeLevel && s.gradeLevel && s.gradeLevel !== selectedClassroom.gradeLevel) {
                    return false;
                }
                if (!q) return true;
                const fullName = `${s.prefix ?? ''}${s.firstName} ${s.lastName}`.toLowerCase();
                return fullName.includes(q) || (s.studentCode || '').toLowerCase().includes(q);
            })
            .slice()
            .sort((a, b) =>
                (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
                || a.firstName.localeCompare(b.firstName),
            );
    }, [selectedClassroom, studentsByClass.unassigned, addStudentsSearch]);

    // --- Actions ---
    const toggleStudentSelection = (studentId: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(studentId)) newSet.delete(studentId);
        else newSet.add(studentId);
        setSelectedStudentIds(newSet);
    };

    const moveStudents = async (studentIdsToMove: string[], targetClassroomId: string | null) => {
        if (studentIdsToMove.length === 0) return;

        setIsProcessing(true);
        const batch = writeBatch(db);
        const targetClass = classrooms.find(c => c.id === targetClassroomId);

        try {
            const classUpdates: Record<string, { add: string[], remove: string[] }> = {};

            studentIdsToMove.forEach(studentId => {
                const student = students.find(s => s.id === studentId);
                if (!student) return;

                const oldClassroomId = student.classroomId || 'unassigned';
                if (oldClassroomId === targetClassroomId) return;

                if (oldClassroomId !== 'unassigned') {
                    if (!classUpdates[oldClassroomId]) classUpdates[oldClassroomId] = { add: [], remove: [] };
                    classUpdates[oldClassroomId].remove.push(studentId);
                }
                if (targetClassroomId && targetClassroomId !== 'unassigned') {
                    if (!classUpdates[targetClassroomId]) classUpdates[targetClassroomId] = { add: [], remove: [] };
                    classUpdates[targetClassroomId].add.push(studentId);
                }

                const studentRef = doc(db, 'students', studentId);
                batch.update(studentRef, {
                    classroomId: targetClassroomId === 'unassigned' ? null : targetClassroomId,
                    currentTrack: targetClass ? targetClass.track : null
                });
            });

            const enrollmentsRef = collection(db, 'enrollments');
            const enrollmentsSnap = await getDocs(enrollmentsRef);
            enrollmentsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (studentIdsToMove.includes(data.studentId) && enrollmentMatchesYear(data, classroomYear)) {
                    batch.update(docSnap.ref, { classId: targetClassroomId === 'unassigned' ? null : targetClassroomId });
                }
            });

            Object.entries(classUpdates).forEach(([clsId, changes]) => {
                const classRef = doc(db, 'classes', clsId);
                const updateData: any = {};
                if (changes.add.length > 0) updateData.studentIds = arrayUnion(...changes.add);
                if (changes.remove.length > 0) updateData.studentIds = arrayRemove(...changes.remove);
                if (Object.keys(updateData).length > 0) {
                    batch.set(classRef, updateData, { merge: true });
                }
            });

            await batch.commit();
            await invalidateStudentSummaryCache(classroomYear);

            setSelectedStudentIds(new Set());
            setBulkTargetClass('');

        } catch (error) {
            console.error("Batch move error:", error);
            alert('เกิดข้อผิดพลาดในการย้ายห้องเรียน');
        } finally {
            setIsProcessing(false);
        }
    };

    const deleteClassroom = async (classroomId: string, studentCount: number) => {
        if (studentCount > 0) {
            alert('ไม่สามารถลบห้องเรียนที่มีนักเรียนอยู่ได้ กรุณาย้ายนักเรียนออกก่อน');
            return;
        }
        if (!confirm('ยืนยันการลบห้องเรียนนี้?')) return;

        try {
            await deleteDoc(doc(db, 'classes', classroomId));
            await invalidateStudentSummaryCache(classroomYear);
            if (selectedClassroomId === classroomId) setSelectedClassroomId(null);
        } catch (error) {
            console.error("Delete classroom error:", error);
            alert('เกิดข้อผิดพลาดในการลบห้องเรียน');
        }
    };

    const handleRemoveCurriculum = async (classroomId: string, curriculumName: string) => {
        if (!confirm(`ยืนยันการเอาหลักสูตร "${curriculumName}" ออกจากห้องเรียนนี้?`)) return;
        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'classes', classroomId), { curriculumPackageId: null });
            await invalidateStudentSummaryCache(classroomYear);
        } catch (error) {
            console.error("Remove curriculum error:", error);
            alert('เกิดข้อผิดพลาดในการนำหลักสูตรออก');
        } finally {
            setIsProcessing(false);
        }
    };

    const openAddStudentsDrawer = () => {
        setAddStudentsSearch('');
        setDrawerSelectedIds(new Set());
        setAddStudentsOpen(true);
    };

    const toggleDrawerStudent = (studentId: string) => {
        setDrawerSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    };

    const confirmAddStudentsToRoom = async () => {
        if (!selectedClassroomId || drawerSelectedIds.size === 0) return;
        await moveStudents(Array.from(drawerSelectedIds), selectedClassroomId);
        setAddStudentsOpen(false);
        setDrawerSelectedIds(new Set());
        setAddStudentsSearch('');
    };

    const createClassroom = async () => {
        if (!newRoom.name.trim() || !newRoom.gradeLevel) return;
        setIsCreating(true);
        try {
            const roomNumber = newRoom.name.trim();
            const className = `${newRoom.gradeLevel}/${roomNumber}`;
            const departmentId = (newRoom as any).departmentId ||
                (newRoom.gradeLevel.startsWith('อ') ? 'early' :
                    newRoom.gradeLevel.startsWith('ป') ? 'primary' : 'secondary');

            const roomData = {
                className,
                gradeLevel: newRoom.gradeLevel,
                roomNumber,
                departmentId,
                academicYearId: newRoom.academicYearId,
                track: newRoom.track,
                trackColor: newRoom.trackColor,
                curriculumPackageId: newRoom.curriculumPackageId || null,
                homeroomTeacherIds: newRoom.homeroomTeacherIds || [],
            };

            if (editingClassroom) {
                await updateDoc(doc(db, 'classes', editingClassroom.id), roomData);
            } else {
                await addDoc(collection(db, 'classes'), { ...roomData, studentIds: [] });
            }
            await invalidateStudentSummaryCache(classroomYear);

            setShowCreateModal(false);
            setEditingClassroom(null);
            setNewRoom({
                name: '',
                gradeLevel: 'ม.4',
                departmentId: 'secondary',
                capacity: '40',
                track: TRACK_OPTIONS[0].label,
                trackColor: TRACK_OPTIONS[0].color,
                academicYearId: classroomYear,
                curriculumPackageId: '',
                homeroomTeacherIds: [],
            });
        } catch (err) {
            console.error('Save classroom error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, studentId: string) => {
        e.dataTransfer.setData('studentId', studentId);
    };

    const assignCurriculumToClass = async (curriculumId: string, classroomId: string) => {
        try {
            await updateDoc(doc(db, 'classes', classroomId), { curriculumPackageId: curriculumId });
            await invalidateStudentSummaryCache(classroomYear);
        } catch (error) {
            console.error("Error assigning curriculum:", error);
            alert('ไม่สามารถมอบหมายหลักสูตรได้');
        }
    };

    const openCurriculumDrawer = () => {
        const dept = (selectedClassroom?.departmentId || '') as Department | '';
        const grade = selectedClassroom?.gradeLevel || '';
        setCurriculumSearch('');
        setCurriculumFilterYear(classroomYear || selectedClassroom?.academicYearId || '');
        setCurriculumFilterDept(
            dept === 'early' || dept === 'primary' || dept === 'secondary' ? dept : '',
        );
        setCurriculumFilterGrade(grade);
        setDrawerCurriculumId(selectedClassroom?.curriculumPackageId || null);
        setCurriculumDrawerOpen(true);
    };

    const clearCurriculumDrawerFilters = () => {
        setCurriculumSearch('');
        setCurriculumFilterYear('');
        setCurriculumFilterDept('');
        setCurriculumFilterGrade('');
    };

    const confirmAssignCurriculum = async () => {
        if (!selectedClassroomId || !drawerCurriculumId) return;
        await assignCurriculumToClass(drawerCurriculumId, selectedClassroomId);
        setCurriculumDrawerOpen(false);
        setCurriculumFilter('');
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = (e: React.DragEvent, targetClassroomId: string) => {
        e.preventDefault();
        const studentId = e.dataTransfer.getData('studentId');
        const curriculumId = e.dataTransfer.getData('curriculumId');
        if (studentId) moveStudents([studentId], targetClassroomId);
        else if (curriculumId && targetClassroomId !== 'unassigned') assignCurriculumToClass(curriculumId, targetClassroomId);
    };

    return (
        <div className="relative flex h-full min-h-0 max-h-full flex-1 flex-col gap-4 overflow-hidden font-sukhumvit lg:flex-row lg:items-stretch">

            {needsCustomMobileBack && headerMobileBackEl && createPortal(
                <button
                    type="button"
                    onClick={handleMobileBack}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
                    title={selectedClassroomId ? 'กลับเลือกห้องเรียน' : 'กลับเลือกแผนก'}
                    aria-label={selectedClassroomId ? 'กลับเลือกห้องเรียน' : 'กลับเลือกแผนก'}
                >
                    <HiChevronLeft size={16} />
                </button>,
                headerMobileBackEl,
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 gap-3 h-64">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    <span className="font-bold text-sm">กำลังโหลดข้อมูล...</span>
                </div>
            ) : (
                <>
                    {showMobileClassBrowse ? (
                        <ClassMobileBrowse
                            selectedDept={deptFilter}
                            gradeOptions={sidebarGradeOptions}
                            classCards={browseClassCards}
                            classCountsByDept={classCountsByDept}
                            onSelectDept={(dept) => {
                                setDeptFilter(dept);
                                setGradeFilter('');
                                setSelectedClassroomId(null);
                            }}
                            onSelectClass={(classId) => {
                                const room = classrooms.find((c) => c.id === classId);
                                if (room?.gradeLevel) setGradeFilter(room.gradeLevel);
                                setSelectedClassroomId(classId);
                            }}
                        />
                    ) : null}

                    {/* ── LEFT — GradeBookClassSidebar (same as รายชื่อ) ── */}
                    <div
                        className={cn(
                            'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
                            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
                            selectedClassroomId
                                ? 'hidden lg:flex'
                                : 'hidden min-h-0 flex-1 lg:flex lg:flex-none',
                        )}
                    >
                        <GradeBookClassSidebar
                            selectedDept={deptFilter}
                            selectedGrade={gradeFilter}
                            selectedClassId={selectedClassroomId || ''}
                            gradeOptions={sidebarGradeOptions}
                            classOptions={sidebarClassOptions}
                            onSelectDept={handleSidebarSelectDept}
                            onSelectGrade={handleSidebarSelectGrade}
                            onSelectClass={handleSidebarSelectClass}
                            collapsed={sidebarCollapsed}
                            headerAction={(
                                <>
                                    {!sidebarCollapsed && (
                                        <Select
                                            value={classroomYear}
                                            onValueChange={(y) => {
                                                setClassroomYear(y);
                                                setDeptFilter('');
                                                setGradeFilter('');
                                                setSelectedClassroomId(null);
                                            }}
                                        >
                                            <SelectTrigger
                                                aria-label="ปีการศึกษา"
                                                className="h-8 min-w-0 flex-1 rounded-full border-border bg-background px-2 text-[11px] font-bold text-foreground font-sukhumvit"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ACADEMIC_YEARS.map((y) => (
                                                    <SelectItem key={y} value={y}>
                                                        ปี {y}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <div className={cn('flex shrink-0', HEADER_ICON_BTN_GROUP)}>
                                        {!sidebarCollapsed && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingClassroom(null);
                                                    setNewRoom({
                                                        name: '',
                                                        gradeLevel: 'ม.4',
                                                        departmentId: 'secondary',
                                                        capacity: '40',
                                                        track: TRACK_OPTIONS[0].label,
                                                        trackColor: TRACK_OPTIONS[0].color,
                                                        academicYearId: classroomYear,
                                                        curriculumPackageId: '',
                                                        homeroomTeacherIds: [],
                                                    });
                                                    setShowCreateModal(true);
                                                }}
                                                className={HEADER_ICON_BTN}
                                                title="เพิ่มห้องเรียน"
                                                aria-label="เพิ่มห้องเรียน"
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

                    {/* ── MIDDLE — Classroom workspace (card shell matches sidebar) ── */}
                    <div
                        className={cn(
                            'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
                            !selectedClassroomId && 'hidden lg:flex',
                            isLgOrBelow && selectedClassroomId && 'rounded-none border-0 bg-transparent px-3 pb-4 pt-2 sm:px-3',
                        )}
                    >
                        {(() => {
                            const cls = selectedClassroomId
                                ? classrooms.find((c) => c.id === selectedClassroomId)
                                : undefined;
                            const count = cls ? (studentsByClass[cls.id]?.length || 0) : 0;
                            const curriculum = cls
                                ? curriculumPackages.find((p) => p.id === cls.curriculumPackageId)
                                : undefined;

                            const openEdit = () => {
                                if (!cls) return;
                                const deptId = Object.entries(GRADE_ORDER).find(([, grades]) =>
                                    grades.includes(cls.gradeLevel),
                                )?.[0] || 'secondary';
                                setEditingClassroom(cls);
                                setNewRoom({
                                    name: cls.roomNumber,
                                    gradeLevel: cls.gradeLevel,
                                    departmentId: deptId,
                                    capacity: String(cls.capacity || 40),
                                    track: cls.track || '',
                                    trackColor: cls.trackColor || '',
                                    academicYearId: cls.academicYearId || classroomYear,
                                    curriculumPackageId: cls.curriculumPackageId || '',
                                    homeroomTeacherIds: cls.homeroomTeacherIds || [],
                                });
                                setShowCreateModal(true);
                            };

                            const actionBtnClass =
                                'flex h-8 flex-1 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-200/50 lg:h-8 lg:w-8 lg:flex-none';
                            const actionDividerClass = 'mx-1 h-3.5 w-px shrink-0 bg-slate-300/60';

                            const headerActions = (
                                <div className={cn('flex w-full min-w-0 items-center lg:w-auto lg:shrink-0', HEADER_ICON_BTN_GROUP)}>
                                    {curriculum && (
                                        <span className="hidden sm:inline-flex max-w-[120px] items-center gap-1 truncate rounded-full border border-emerald-100/80 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-600 shadow-sm">
                                            <span className="truncate">{curriculum.name}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveCurriculum(cls!.id, curriculum.name || '');
                                                }}
                                                className="shrink-0 rounded-full p-0.5 text-emerald-400 transition-all duration-200 hover:bg-emerald-100 hover:text-emerald-700"
                                                title="ยกเลิกหลักสูตร"
                                            >
                                                <HiXMark className="h-3 w-3" />
                                            </button>
                                        </span>
                                    )}
                                    {cls && (
                                        <div className="flex w-full min-w-0 items-center rounded-full border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:w-auto lg:shrink-0">
                                            <button
                                                type="button"
                                                onClick={openAddStudentsDrawer}
                                                className={actionBtnClass}
                                                title="เพิ่มนักเรียนเข้าห้อง"
                                                aria-label="เพิ่มนักเรียนเข้าห้อง"
                                            >
                                                <HiUserPlus size={16} />
                                            </button>
                                            <div className={actionDividerClass} aria-hidden />
                                            <button
                                                type="button"
                                                onClick={openCurriculumDrawer}
                                                className={actionBtnClass}
                                                title="มอบหมายหลักสูตร"
                                                aria-label="มอบหมายหลักสูตร"
                                            >
                                                <HiOutlineBookOpen size={16} />
                                            </button>
                                            <div className={actionDividerClass} aria-hidden />
                                            <button
                                                type="button"
                                                onClick={openEdit}
                                                className={actionBtnClass}
                                                title="แก้ไขห้องเรียน"
                                                aria-label="แก้ไขห้องเรียน"
                                            >
                                                <HiPencil size={16} />
                                            </button>
                                            <div className={actionDividerClass} aria-hidden />
                                            <button
                                                type="button"
                                                onClick={() => deleteClassroom(cls.id, count)}
                                                className={cn(actionBtnClass, 'text-rose-500 hover:bg-rose-50')}
                                                title="ลบห้องเรียน"
                                                aria-label="ลบห้องเรียน"
                                            >
                                                <HiTrash size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );

                            return (
                                <>
                        {/* Header — same height/border as GradeBookClassSidebar */}
                        <div className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center justify-between gap-2 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex">
                            <div className="min-w-0 shrink overflow-x-auto scrollbar-none">
                                {headerTabs}
                            </div>
                            <div className="ml-auto shrink-0">{headerActions}</div>
                        </div>

                        {/* Mobile header when room selected */}
                        {cls && (
                            <div className="mb-2 flex min-h-[3.25rem] w-full shrink-0 items-center gap-2 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:hidden">
                                {headerActions}
                            </div>
                        )}

                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {cls ? (
                            // ── Classroom Detail View ──
                                    <div className="flex h-full flex-col">
                                        {/* Student table */}
                                        <div
                                            className="flex-1 overflow-y-auto scrollbar-hide pb-6"
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, cls.id)}
                                        >
                                            {count === 0 ? (
                                                <div className="py-12 text-center text-muted-foreground">
                                                    <p className="text-[13px] font-sarabun">ยังไม่มีนักเรียนในห้องนี้</p>
                                                </div>
                                            ) : (
                                                (() => {
                                                    const rows = (studentsByClass[cls.id] || [])
                                                        .slice()
                                                        .sort((a, b) =>
                                                            (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
                                                            || a.firstName.localeCompare(b.firstName),
                                                        );
                                                    return (
                                                        <div className="flex flex-col gap-3">
                                                            {/* Mobile cards */}
                                                            <div className="flex flex-col gap-2.5 md:hidden">
                                                                <AnimatePresence>
                                                                    {rows.map((student, i) => {
                                                                        const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
                                                                        const isSelected = selectedStudentIds.has(student.id);
                                                                        return (
                                                                            <motion.div
                                                                                key={student.id}
                                                                                layout
                                                                                initial={{ opacity: 0, y: 8 }}
                                                                                animate={{ opacity: 1, y: 0 }}
                                                                                exit={{ opacity: 0 }}
                                                                                transition={{ delay: i * 0.02 }}
                                                                                draggable
                                                                                onDragStart={(e: any) => handleDragStart(e, student.id)}
                                                                                onClick={() => toggleStudentSelection(student.id)}
                                                                                className={cn(
                                                                                    'cursor-pointer rounded-2xl border border-border bg-card p-3 transition-colors active:scale-[0.99]',
                                                                                    isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/40',
                                                                                )}
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
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            moveStudents([student.id], 'unassigned');
                                                                                        }}
                                                                                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                                                        aria-label="นำออกจากห้อง"
                                                                                    >
                                                                                        <HiXMark className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                                                                                    <span className="text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                                                                        ชั้น
                                                                                    </span>
                                                                                    <span className="text-[12px] font-bold text-foreground font-sukhumvit">
                                                                                        {student.gradeLevel || '—'}
                                                                                    </span>
                                                                                </div>
                                                                            </motion.div>
                                                                        );
                                                                    })}
                                                                </AnimatePresence>
                                                            </div>

                                                            {/* Desktop table */}
                                                            <div className={cn('hidden md:block', TABLE_SHELL)}>
                                                                <div className="border-b border-border bg-muted shrink-0">
                                                                    <div
                                                                        className="grid gap-3 px-4 py-3"
                                                                        style={{ gridTemplateColumns: TABLE_GRID }}
                                                                    >
                                                                        <span className={TABLE_HEADER_CELL}>รหัส</span>
                                                                        <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                                                                        <span className={TABLE_HEADER_CELL}>ชั้น</span>
                                                                        <span className={TABLE_HEADER_CELL} />
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <AnimatePresence>
                                                                        {rows.map((student, i) => {
                                                                            const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
                                                                            const isSelected = selectedStudentIds.has(student.id);
                                                                            return (
                                                                                <motion.div
                                                                                    key={student.id}
                                                                                    layout
                                                                                    initial={{ opacity: 0 }}
                                                                                    animate={{ opacity: 1 }}
                                                                                    exit={{ opacity: 0 }}
                                                                                    transition={{ delay: i * 0.015 }}
                                                                                    draggable
                                                                                    onDragStart={(e: any) => handleDragStart(e, student.id)}
                                                                                    onClick={() => toggleStudentSelection(student.id)}
                                                                                    className={cn(
                                                                                        'grid cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0',
                                                                                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/40',
                                                                                    )}
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
                                                                                        {student.gradeLevel || (
                                                                                            <span className="text-muted-foreground/40">—</span>
                                                                                        )}
                                                                                    </span>
                                                                                    <div className="flex justify-end">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                moveStudents([student.id], 'unassigned');
                                                                                            }}
                                                                                            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                                                            aria-label="นำออกจากห้อง"
                                                                                        >
                                                                                            <HiXMark className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                </motion.div>
                                                                            );
                                                                        })}
                                                                    </AnimatePresence>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    </div>
                        ) : (
                            // ── Empty / pick room (desktop) ──
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                                <HiAcademicCap className="h-8 w-8 text-muted-foreground/40" />
                                <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                                    {!deptFilter
                                        ? 'เลือกแผนกจากแถบด้านซ้าย'
                                        : !gradeFilter
                                            ? 'เลือกระดับชั้นจากแถบด้านซ้าย'
                                            : sidebarClassOptions.length === 0
                                                ? 'ยังไม่มีห้องในระดับชั้นนี้ — กด + เพื่อเพิ่ม'
                                                : 'เลือกห้องเรียนจากแถบด้านซ้าย'}
                                </p>
                                {gradeFilter && (
                                    <p className="text-[11px] font-bold text-slate-400">
                                        {filteredClassrooms.length} ห้องในตัวกรองนี้
                                    </p>
                                )}
                            </div>
                        )}
                        </div>
                                </>
                            );
                        })()}
                    </div>

                </>
            )}

            {/* ── Create/Edit Classroom Modal ── */}
            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowCreateModal(false);
                        setEditingClassroom(null);
                    }
                }}
            >
                <DialogContent
                    className="w-[92vw] sm:max-w-lg rounded-2xl border-none p-0 shadow-2xl overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    }}
                >
                    <div className="flex max-h-[90vh] flex-col">
                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 sm:pb-3">
                            <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                                {editingClassroom ? 'แก้ไขข้อมูลห้องเรียน' : 'สร้างห้องเรียนใหม่'}
                            </DialogTitle>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto px-6 sm:px-8 py-4 custom-scrollbar">
                            <div className="space-y-1">
                                <label className={FIELD_LABEL}>
                                    แผนก <span className="text-destructive">*</span>
                                </label>
                                <div className="flex gap-1.5 rounded-xl bg-slate-100/80 p-1">
                                    {([
                                        { id: 'early', label: 'ปฐมวัย' },
                                        { id: 'primary', label: 'ประถม' },
                                        { id: 'secondary', label: 'มัธยม' },
                                    ] as const).map((d) => {
                                        const active = newRoom.departmentId === d.id;
                                        return (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => {
                                                    const grades = GRADE_ORDER[d.id] || [];
                                                    setNewRoom((p) => ({
                                                        ...p,
                                                        departmentId: d.id,
                                                        gradeLevel: grades.includes(p.gradeLevel) ? p.gradeLevel : (grades[0] || ''),
                                                    }));
                                                }}
                                                className={cn(
                                                    'h-9 flex-1 rounded-lg text-xs font-bold transition-all',
                                                    active
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-700',
                                                )}
                                            >
                                                {d.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={FIELD_LABEL}>
                                        ปีการศึกษา <span className="text-destructive">*</span>
                                    </label>
                                    <Select
                                        value={newRoom.academicYearId}
                                        onValueChange={(v) => setNewRoom((p) => ({ ...p, academicYearId: v }))}
                                    >
                                        <SelectTrigger className={cn(FIELD_INPUT, 'w-full')}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACADEMIC_YEARS.map((y) => (
                                                <SelectItem key={y} value={y}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className={FIELD_LABEL}>
                                        ระดับชั้น <span className="text-destructive">*</span>
                                    </label>
                                    <Select
                                        value={newRoom.gradeLevel}
                                        onValueChange={(v) => setNewRoom((p) => ({ ...p, gradeLevel: v }))}
                                    >
                                        <SelectTrigger className={cn(FIELD_INPUT, 'w-full')}>
                                            <SelectValue placeholder="เลือกชั้น" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(GRADE_ORDER[newRoom.departmentId || 'secondary'] || []).map((g) => (
                                                <SelectItem key={g} value={g}>{g}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={FIELD_LABEL}>
                                        ชื่อห้อง (ทับ) <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        value={newRoom.name}
                                        onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))}
                                        placeholder="เช่น 1"
                                        className={FIELD_INPUT}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={FIELD_LABEL}>แผนการเรียน</label>
                                    <Input
                                        value={newRoom.track}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const match = TRACK_OPTIONS.find((t) => t.label === val);
                                            setNewRoom((p) => ({
                                                ...p,
                                                track: val,
                                                trackColor: match ? match.color : 'bg-slate-500 shadow-slate-500/40',
                                            }));
                                        }}
                                        placeholder="เช่น วิทย์-คณิต"
                                        className={FIELD_INPUT}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="border-t border-white/20 px-6 pt-4 pb-6 sm:px-8 sm:pb-8">
                            <Button
                                type="button"
                                disabled={!newRoom.name.trim() || !newRoom.academicYearId || !newRoom.gradeLevel || isCreating}
                                onClick={() => void createClassroom()}
                                className="h-10 w-full rounded-xl font-bold"
                            >
                                {isCreating ? 'กำลังบันทึก...' : editingClassroom ? 'บันทึก' : 'สร้างห้องเรียน'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Floating Action Bar (bulk assign) ── */}
            <AnimatePresence>
                {(selectedStudentIds.size > 0 || !!curriculumFilter) && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-[max(7.5rem,env(safe-area-inset-bottom))] left-1/2 z-[100] -translate-x-1/2 px-3 py-2 rounded-full flex flex-wrap items-center justify-center gap-2 max-w-[calc(100vw-1.5rem)] lg:bottom-10 lg:max-w-none lg:flex-nowrap lg:gap-3 lg:px-4"
                        style={{
                            background: 'rgba(255,255,255,0.90)',
                            backdropFilter: 'blur(24px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                            border: '1px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] text-white shadow-lg shadow-blue-600/30">
                                {selectedStudentIds.size > 0 ? selectedStudentIds.size : 1}
                            </div>
                            <div>
                                <p className="font-black text-[9px] uppercase tracking-[0.1em] text-slate-400 leading-none">รายการที่เลือก</p>
                                <p className="font-bold text-[12px] text-slate-700 leading-none">
                                    {selectedStudentIds.size > 0 ? 'นักเรียน' : 'หลักสูตร'}
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-5 bg-black/10" />

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ย้ายไปที่</span>
                            <Select value={bulkTargetClass} onValueChange={setBulkTargetClass}>
                                <SelectTrigger className="min-w-[140px] rounded-full border-slate-200/50 bg-slate-100 py-1.5 pl-4 text-[11px] font-bold text-slate-900 shadow-none hover:bg-slate-200">
                                    <SelectValue placeholder="-- เลือกห้อง --" />
                                </SelectTrigger>
                                <SelectContent>
                                    {([...classrooms].sort((a, b) => {
                                        const flatGrades = Object.values(GRADE_ORDER).flat();
                                        const idxA = flatGrades.indexOf(a.gradeLevel);
                                        const idxB = flatGrades.indexOf(b.gradeLevel);
                                        if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                                        return a.className.localeCompare(b.className, undefined, { numeric: true });
                                    })).map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <button
                            disabled={!bulkTargetClass || isProcessing}
                            onClick={() => {
                                if (selectedStudentIds.size > 0) moveStudents(Array.from(selectedStudentIds), bulkTargetClass);
                                else if (curriculumFilter) assignCurriculumToClass(curriculumFilter, bulkTargetClass);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                        >
                            {isProcessing ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <HiArrowRight className="w-3 h-3" />
                            )}
                            ยืนยัน
                        </button>

                        <div className="w-px h-5 bg-black/10" />

                        <button
                            onClick={() => { setSelectedStudentIds(new Set()); setCurriculumFilter(''); setBulkTargetClass(''); }}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        >
                            <HiXMark className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Drawer
                open={addStudentsOpen}
                onOpenChange={(open) => {
                    setAddStudentsOpen(open);
                    if (!open) {
                        setDrawerSelectedIds(new Set());
                        setAddStudentsSearch('');
                    }
                }}
                direction="right"
            >
                <DrawerContent className={ASSIGN_DRAWER_CONTENT}>
                    <div className={ASSIGN_DRAWER_PANEL}>
                        <DrawerHeader className="px-4 pb-2">
                            <div className="relative flex min-h-10 items-center justify-center">
                                <DrawerTitle className="text-base font-black text-foreground font-sukhumvit">
                                    เพิ่มนักเรียนเข้าห้อง
                                </DrawerTitle>
                                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                                    <button
                                        type="button"
                                        onClick={() => setAddStudentsOpen(false)}
                                        className={DRAWER_HEADER_ICON_BTN}
                                        aria-label="ปิด"
                                    >
                                        <HiXMark className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            {selectedClassroom && (
                                <p className="mt-1 text-center text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    {selectedClassroom.className}
                                    {selectedClassroom.gradeLevel ? ` · ${selectedClassroom.gradeLevel}` : ''}
                                </p>
                            )}
                        </DrawerHeader>

                        <div className="px-4 pb-3">
                            <div className="flex h-10 items-center gap-2 rounded-xl border-none bg-slate-50/70 px-3">
                                <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <input
                                    value={addStudentsSearch}
                                    onChange={(e) => setAddStudentsSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อ หรือรหัส..."
                                    className="min-w-0 flex-1 bg-transparent text-xs font-bold text-foreground outline-none placeholder:text-muted-foreground font-sukhumvit"
                                />
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
                            {assignDrawerCandidates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                                    <HiUserPlus className="h-8 w-8 text-muted-foreground/40" />
                                    <p className="text-[13px] font-bold text-muted-foreground font-sukhumvit">
                                        ไม่มีนักเรียนที่พร้อมจัดเข้าห้องนี้
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/70 font-sarabun">
                                        แสดงเฉพาะคนที่ยังไม่มีห้องในระดับชั้นนี้
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {assignDrawerCandidates.map((student) => {
                                        const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();
                                        const selected = drawerSelectedIds.has(student.id);
                                        return (
                                            <button
                                                key={student.id}
                                                type="button"
                                                onClick={() => toggleDrawerStudent(student.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                                                    selected
                                                        ? 'border-primary/30 bg-primary/5'
                                                        : 'border-border bg-card hover:bg-muted/40',
                                                )}
                                            >
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
                                                    <p className="text-[13px] font-black tabular-nums text-foreground font-sukhumvit">
                                                        {student.studentCode || '—'}
                                                    </p>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black',
                                                        selected
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-border text-transparent',
                                                    )}
                                                    aria-hidden
                                                >
                                                    ✓
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            <Button
                                type="button"
                                disabled={drawerSelectedIds.size === 0 || isProcessing || !selectedClassroomId}
                                onClick={() => void confirmAddStudentsToRoom()}
                                className="h-10 w-full rounded-xl font-bold"
                            >
                                {isProcessing
                                    ? 'กำลังบันทึก...'
                                    : drawerSelectedIds.size > 0
                                        ? `เพิ่ม ${drawerSelectedIds.size} คนเข้าห้อง`
                                        : 'เลือกนักเรียน'}
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={curriculumDrawerOpen}
                onOpenChange={(open) => {
                    setCurriculumDrawerOpen(open);
                    if (!open) {
                        setDrawerCurriculumId(null);
                        setCurriculumSearch('');
                        setCurriculumFilterYear('');
                        setCurriculumFilterDept('');
                        setCurriculumFilterGrade('');
                    }
                }}
                direction="right"
            >
                <DrawerContent className={ASSIGN_DRAWER_CONTENT}>
                    <div className={ASSIGN_DRAWER_PANEL}>
                        <DrawerHeader className="px-4 pb-2">
                            <div className="relative flex min-h-10 items-center justify-center">
                                <DrawerTitle className="text-base font-black text-foreground font-sukhumvit">
                                    มอบหมายหลักสูตร
                                </DrawerTitle>
                                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                                    <button
                                        type="button"
                                        onClick={() => setCurriculumDrawerOpen(false)}
                                        className={DRAWER_HEADER_ICON_BTN}
                                        aria-label="ปิด"
                                    >
                                        <HiXMark className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            {selectedClassroom && (
                                <p className="mt-1 text-center text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    {selectedClassroom.className}
                                    {selectedClassroom.gradeLevel ? ` · ${selectedClassroom.gradeLevel}` : ''}
                                </p>
                            )}
                        </DrawerHeader>

                        <div className="space-y-2 px-4 pb-3">
                            <div className="flex h-10 items-center gap-2 rounded-xl border-none bg-slate-50/70 px-3">
                                <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <input
                                    value={curriculumSearch}
                                    onChange={(e) => setCurriculumSearch(e.target.value)}
                                    placeholder="ค้นหาหลักสูตร..."
                                    className="min-w-0 flex-1 bg-transparent text-xs font-bold text-foreground outline-none placeholder:text-muted-foreground font-sukhumvit"
                                />
                            </div>
                            <div>
                                <PanelCapsuleSelect
                                    value={curriculumFilterYear}
                                    onChange={setCurriculumFilterYear}
                                    placeholder="ทุกปีการศึกษา"
                                    options={ACADEMIC_YEARS.map((y) => ({
                                        value: y,
                                        label: `ปี ${y}`,
                                    }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <PanelCapsuleSelect
                                        value={curriculumFilterDept}
                                        onChange={(v) => {
                                            setCurriculumFilterDept((v || '') as Department | '');
                                            setCurriculumFilterGrade('');
                                        }}
                                        placeholder="ทุกแผนก"
                                        options={(
                                            Object.entries(DEPARTMENT_CONFIG) as [Department, (typeof DEPARTMENT_CONFIG)[Department]][]
                                        ).map(([id, cfg]) => ({ value: id, label: cfg.label }))}
                                    />
                                </div>
                                <div>
                                    <PanelCapsuleSelect
                                        value={curriculumFilterGrade}
                                        onChange={setCurriculumFilterGrade}
                                        placeholder="ทุกระดับ"
                                        options={curriculumDrawerGradeOptions.map((g) => ({ value: g, label: g }))}
                                    />
                                </div>
                            </div>
                            {hasCurriculumDrawerFilters && (
                                <button
                                    type="button"
                                    onClick={clearCurriculumDrawerFilters}
                                    className="w-full rounded-xl py-2 text-[12px] font-black text-destructive transition-colors hover:bg-destructive/5 font-sukhumvit"
                                >
                                    ล้างตัวกรอง
                                </button>
                            )}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
                            {curriculumDrawerCandidates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                                    <HiOutlineBookOpen className="h-8 w-8 text-muted-foreground/40" />
                                    <p className="text-[13px] font-bold text-muted-foreground font-sukhumvit">
                                        ไม่พบหลักสูตร
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <p className="px-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                        {curriculumDrawerCandidates.length} หลักสูตร
                                    </p>
                                    {curriculumDrawerCandidates.map((pkg) => {
                                        const selected = drawerCurriculumId === pkg.id;
                                        const current = selectedClassroom?.curriculumPackageId === pkg.id;
                                        return (
                                            <button
                                                key={pkg.id}
                                                type="button"
                                                onClick={() => setDrawerCurriculumId(pkg.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                                                    selected
                                                        ? 'border-primary/30 bg-primary/5'
                                                        : 'border-border bg-card hover:bg-muted/40',
                                                )}
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                                                    <HiOutlineBookOpen className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">
                                                        {pkg.name || pkg.id}
                                                    </p>
                                                    <p className="truncate text-[11px] font-medium text-muted-foreground font-sarabun">
                                                        {[pkg.versionName, pkg.gradeLevel || pkg.assignedGrades?.join(', ')]
                                                            .filter(Boolean)
                                                            .join(' · ') || '—'}
                                                        {current ? ' · ใช้อยู่' : ''}
                                                    </p>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black',
                                                        selected
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-border text-transparent',
                                                    )}
                                                    aria-hidden
                                                >
                                                    ✓
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            <Button
                                type="button"
                                disabled={!drawerCurriculumId || !selectedClassroomId}
                                onClick={() => void confirmAssignCurriculum()}
                                className="h-10 w-full rounded-xl font-bold"
                            >
                                {drawerCurriculumId ? 'มอบหมายหลักสูตร' : 'เลือกหลักสูตร'}
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
