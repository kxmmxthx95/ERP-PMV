import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiMagnifyingGlass, HiArrowRight, HiPlus, HiXMark,
    HiCheckCircle, HiBookOpen, HiCheck, HiArrowLeft,
    HiUsers, HiUserCircle, HiPencil, HiTrash,
    HiChevronDown, HiSquares2X2, HiExclamationTriangle, HiAcademicCap,
} from 'react-icons/hi2';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { invalidateStudentSummaryCache } from '@/lib/firestoreShared/studentSummaryStore';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { cn } from '@/lib/utils';

type MobileClassView = 'rooms' | 'unassigned' | 'curriculum';

// --- Grade Progression Maps ---
const GRADE_ORDER: Record<string, string[]> = {
    early: ['อ.1', 'อ.2', 'อ.3'],
    primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
    secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

const DEPT_CONFIG: Record<string, { label: string; gradient: string; badge: string }> = {
    early: { label: 'ปฐมวัย', gradient: 'from-rose-400 to-pink-500', badge: 'bg-rose-100 text-rose-600' },
    primary: { label: 'ประถม', gradient: 'from-sky-400 to-blue-500', badge: 'bg-sky-100 text-sky-600' },
    secondary: { label: 'มัธยม', gradient: 'from-violet-500 to-indigo-600', badge: 'bg-violet-100 text-violet-600' },
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
}

interface Teacher {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    prefix?: string;
    employeeCode?: string;
    position?: string;
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
        <div className="relative flex items-center w-full">
            <select
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none pl-3.5 pr-7 h-8 bg-transparent text-[11px] font-bold text-slate-800 outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <HiChevronDown
                size={10}
                className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${disabled ? 'opacity-30' : 'text-slate-400'}`}
            />
        </div>
    );
}

export default function ClassroomAssignmentTab() {
    const { year: activeYear } = useActiveAcademicYear();
    const panelCardClass = 'rounded-[2rem] border border-white/30 bg-white/30 backdrop-blur-xl shadow-sm';
    const panelHeaderClass = 'px-3 py-3 space-y-2 z-10 border-b border-white/30';

    // --- State ---
    const [curriculumYear, setCurriculumYear] = useState<string>(activeYear);
    const [classroomYear, setClassroomYear] = useState<string>(activeYear);
    const [studentYear, setStudentYear] = useState<string>(activeYear);
    const [searchQuery, setSearchQuery] = useState('');
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
    const [classroomFilter] = useState<string>('');
    const [curriculumFilter, setCurriculumFilter] = useState<string>('');
    const [curriculumSearch, setCurriculumSearch] = useState('');

    const [unassignedDeptFilter, setUnassignedDeptFilter] = useState<string>('');
    const [unassignedGradeFilter, setUnassignedGradeFilter] = useState<string>('');
    const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<MobileClassView>('rooms');
    const [isMdOrBelow, setIsMdOrBelow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showCurriculumPanel = !isMdOrBelow || (mobileView === 'curriculum' && !selectedClassroomId);
    const showClassroomPanel = !isMdOrBelow || mobileView === 'rooms' || !!selectedClassroomId;
    const showUnassignedPanel = !isMdOrBelow || (mobileView === 'unassigned' && !selectedClassroomId);

    const [students, setStudents] = useState<Student[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [curriculumPackages, setCurriculumPackages] = useState<CurriculumPackage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Bulk Select State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [bulkTargetClass, setBulkTargetClass] = useState<string>('');

    useEffect(() => {
        if (!editingClassroom) {
            setNewRoom(prev => ({ ...prev, academicYearId: classroomYear }));
        }
    }, [classroomYear, editingClassroom]);

    // --- Fetch Data ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const stSnapshot = await getDocs(collection(db, 'students'));
                const stData = stSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

                const clSnapshot = await getDocs(collection(db, 'classes'));
                let clData = clSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Classroom))
                    .filter(c =>
                        String(c.academicYearId) === classroomYear ||
                        String((c as any).academicYear) === classroomYear
                    );

                const enSnapshot = await getDocs(collection(db, 'enrollments'));
                const enData = enSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                const mergedStudents = stData.map(student => {
                    const enrollment = enData.find(
                        e => e.studentId === student.id && enrollmentMatchesYear(e, classroomYear),
                    );
                    if (enrollment) {
                        return {
                            ...student,
                            academicYearId: String(enrollment.academicYearId),
                            gradeLevel: enrollment.gradeLevel || student.gradeLevel,
                            classroomId: enrollment.classId || student.classroomId || null
                        };
                    }
                    return student;
                });

                setStudents(mergedStudents);
                setClassrooms(clData);
                setSelectedStudentIds(new Set());

                const tcSnapshot = await getDocs(collection(db, 'teachers'));
                const tcData = tcSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
                setTeachers(tcData);

                const pkSnapshot = await getDocs(collection(db, 'curriculums'));
                const pkData = pkSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
                setCurriculumPackages(pkData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classroomYear]);

    // --- Derived State ---
    const sidebarClassrooms = useMemo(() => {
        return classrooms.filter(cls => {
            const matchYear = String(cls.academicYearId) === classroomYear;
            const matchDept = !deptFilter || cls.departmentId === deptFilter;
            return matchYear && matchDept;
        });
    }, [classrooms, classroomYear, deptFilter]);

    const filteredClassrooms = useMemo(() => {
        return sidebarClassrooms
            .filter(cls => {
                const matchGrade = !gradeFilter || cls.gradeLevel === gradeFilter;
                const matchClassroom = !classroomFilter || cls.id === classroomFilter;
                return matchGrade && matchClassroom;
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
    }, [sidebarClassrooms, gradeFilter, classroomFilter]);

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

    const filteredCurriculumPackages = useMemo(() => {
        return curriculumPackages
            .filter(pkg => {
                const name = pkg.name?.toLowerCase() || '';
                const pkgYear = String(pkg.year || pkg.academicYearId || '').trim();
                const matchSearch = name.includes(curriculumSearch.toLowerCase());
                const matchYear = !curriculumYear || !pkgYear || pkgYear === curriculumYear;
                return matchSearch && matchYear;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [curriculumPackages, curriculumSearch, curriculumYear]);

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

    const filteredUnassignedStudents = useMemo(() => {
        return (studentsByClass['unassigned'] || [])
            .filter(s => {
                const studentCurrentYear = String((s as any).academicYear || s.academicYearId || '');
                if (!studentYear) return true;
                return studentCurrentYear ? studentCurrentYear === studentYear : true;
            })
            .filter(s => {
                if (unassignedDeptFilter) {
                    const expectedGrades = GRADE_ORDER[unassignedDeptFilter] || [];
                    if (!expectedGrades.includes(s.gradeLevel)) return false;
                }
                if (unassignedGradeFilter) {
                    if (s.gradeLevel !== unassignedGradeFilter) return false;
                }
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
                    const studentCode = (s.studentCode || '').toLowerCase();
                    const nationalId = (s.nationalId || '').toLowerCase();
                    if (!fullName.includes(q) && !studentCode.includes(q) && !nationalId.includes(q)) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName));
    }, [studentsByClass, studentYear, unassignedDeptFilter, unassignedGradeFilter, searchQuery]);

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

            setStudents(prev => prev.map(s => {
                if (studentIdsToMove.includes(s.id)) {
                    return {
                        ...s,
                        classroomId: targetClassroomId === 'unassigned' ? null : targetClassroomId,
                        currentTrack: targetClass ? targetClass.track : undefined
                    };
                }
                return s;
            }));

            setClassrooms(prev => prev.map((cls) => {
                const changes = classUpdates[cls.id];
                if (!changes) return cls;
                const ids = new Set(cls.studentIds ?? []);
                changes.remove.forEach((sid) => ids.delete(sid));
                changes.add.forEach((sid) => ids.add(sid));
                return { ...cls, studentIds: [...ids] };
            }));

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
            setClassrooms(prev => prev.filter(c => c.id !== classroomId));
            if (selectedClassroomId === classroomId) setSelectedClassroomId(null);
        } catch (error) {
            console.error("Delete classroom error:", error);
            alert('เกิดข้อผิดพลาดในการลบห้องเรียน');
        }
    };

    const handleCurriculumAssign = async (curriculumId: string, classroomId: string) => {
        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'classes', classroomId), { curriculumPackageId: curriculumId });
            setClassrooms(prev => prev.map(c => c.id === classroomId ? { ...c, curriculumPackageId: curriculumId } : c));
            setCurriculumFilter('');
        } catch (error) {
            console.error("Assign curriculum error:", error);
            alert('เกิดข้อผิดพลาดในการมอบหมายหลักสูตร');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveCurriculum = async (classroomId: string, curriculumName: string) => {
        if (!confirm(`ยืนยันการเอาหลักสูตร "${curriculumName}" ออกจากห้องเรียนนี้?`)) return;
        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'classes', classroomId), { curriculumPackageId: null });
            setClassrooms(prev => prev.map(c => c.id === classroomId ? { ...c, curriculumPackageId: undefined } : c));
        } catch (error) {
            console.error("Remove curriculum error:", error);
            alert('เกิดข้อผิดพลาดในการนำหลักสูตรออก');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClassCardClick = async (classId: string) => {
        if (selectedStudentIds.size > 0) {
            await moveStudents(Array.from(selectedStudentIds), classId);
            return;
        }
        if (curriculumFilter) {
            await handleCurriculumAssign(curriculumFilter, classId);
            return;
        }
        setSelectedClassroomId(classId);
    };
    const handleSelectAllUnassigned = () => {
        if (filteredUnassignedStudents.length === 0) return;
        const allSelected = filteredUnassignedStudents.every(s => selectedStudentIds.has(s.id));
        const newSelection = new Set(selectedStudentIds);
        if (allSelected) {
            filteredUnassignedStudents.forEach(s => newSelection.delete(s.id));
        } else {
            filteredUnassignedStudents.forEach(s => newSelection.add(s.id));
        }
        setSelectedStudentIds(newSelection);
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
                setClassrooms(prev => prev.map(c => c.id === editingClassroom.id ? { ...c, ...roomData } : c));
            } else {
                const docRef = await addDoc(collection(db, 'classes'), { ...roomData, studentIds: [] });
                setClassrooms(prev => [...prev, { id: docRef.id, ...roomData, studentIds: [] }]);
            }

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

    const handleCurriculumDragStart = (e: React.DragEvent, curriculumId: string) => {
        e.dataTransfer.setData('curriculumId', curriculumId);
    };

    const assignCurriculumToClass = async (curriculumId: string, classroomId: string) => {
        try {
            await updateDoc(doc(db, 'classes', classroomId), { curriculumPackageId: curriculumId });
            setClassrooms(prev => prev.map(c => c.id === classroomId ? { ...c, curriculumPackageId: curriculumId } : c));
        } catch (error) {
            console.error("Error assigning curriculum:", error);
            alert('ไม่สามารถมอบหมายหลักสูตรได้');
        }
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = (e: React.DragEvent, targetClassroomId: string) => {
        e.preventDefault();
        const studentId = e.dataTransfer.getData('studentId');
        const curriculumId = e.dataTransfer.getData('curriculumId');
        if (studentId) moveStudents([studentId], targetClassroomId);
        else if (curriculumId && targetClassroomId !== 'unassigned') assignCurriculumToClass(curriculumId, targetClassroomId);
    };

    const isAssignMode = selectedStudentIds.size > 0 || !!curriculumFilter;

    // ── Classroom Card (grid) ──────────────────────────────────────────────────
    function ClassroomCard({ cls }: { cls: Classroom }) {
        const count = studentsByClass[cls.id]?.length || 0;
        const curriculum = curriculumPackages.find(p => p.id === cls.curriculumPackageId);
        const dept = DEPT_CONFIG[cls.departmentId || 'secondary'] ?? DEPT_CONFIG.secondary;
        const isSelected = selectedClassroomId === cls.id;

        return (
            <motion.div
                layout
                whileTap={{ scale: 0.98 }}
                onClick={() => handleClassCardClick(cls.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, cls.id)}
                className={`group relative cursor-pointer select-none rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg border backdrop-blur-sm ${
                    isSelected
                        ? 'bg-blue-50/95 border-blue-300'
                        : 'bg-white/70 hover:bg-white/90 border-black/[0.04] hover:border-black/[0.08]'
                }`}
            >
                {/* Gradient header */}
                <div className={`relative h-24 bg-gradient-to-br ${dept.gradient}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                    {/* Grade level big */}
                    <div className="absolute top-3 left-3 text-white text-xl font-black drop-shadow z-10">
                        {cls.gradeLevel}
                    </div>

                    {/* Room number */}
                    <div className="absolute top-[3rem] left-3 text-white/70 text-sm font-bold z-10">
                        /{cls.roomNumber}
                    </div>

                    {/* Dept badge */}
                    <div className="absolute top-3 right-3 z-10">
                        <span className="px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-white text-[9px] font-black uppercase tracking-wider">
                            {dept.label}
                        </span>
                    </div>

                    {/* Edit/delete actions */}
                    {!isAssignMode && (
                        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    setEditingClassroom(cls);
                                    const deptId = Object.entries(GRADE_ORDER).find(([_, grades]) =>
                                        grades.includes(cls.gradeLevel)
                                    )?.[0] || 'secondary';
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
                                }}
                                className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-slate-600 hover:bg-white hover:text-blue-600 transition-all shadow"
                            >
                                <HiPencil className="w-3 h-3" />
                            </button>
                            <button
                                onClick={e => { e.stopPropagation(); deleteClassroom(cls.id, count); }}
                                className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-slate-600 hover:bg-white hover:text-rose-500 transition-all shadow"
                            >
                                <HiTrash className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Card body */}
                <div className="p-3">
                    {/* Track */}
                    <p className="text-[11px] font-bold text-slate-500 truncate mb-1">
                        {cls.track || 'ไม่มีแผนการเรียน'}
                    </p>

                    {/* Curriculum */}
                    <div className="flex items-center gap-1 mb-2">
                        <HiBookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {curriculum ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200/60 truncate flex-1 shadow-sm">
                                <HiExclamationTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="truncate">{curriculum.name}</span>
                            </span>
                        ) : (
                            <span className="text-[10px] text-slate-400 font-medium truncate flex-1">
                                ยังไม่มีหลักสูตร
                            </span>
                        )}
                        {curriculum && (
                            <button
                                onClick={e => { e.stopPropagation(); handleRemoveCurriculum(cls.id, curriculum.name || ''); }}
                                className="p-0.5 rounded hover:text-rose-500 text-slate-300 transition-colors shrink-0"
                            >
                                <HiXMark className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Student count */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <HiUsers className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[12px] font-black text-slate-700">{count}</span>
                            <span className="text-[10px] text-slate-400 font-medium">คน</span>
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); setSelectedClassroomId(cls.id); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
                        >
                            ดูนักเรียน
                            <HiArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Assign mode overlay */}
                {isAssignMode && (
                    <div className={`absolute inset-0 flex items-center justify-center z-20 transition-all duration-300 backdrop-blur-[2px] ${
                        curriculum && !!curriculumFilter
                            ? 'bg-amber-600/35 group-hover:bg-amber-600/40'
                            : 'bg-blue-600/35 group-hover:bg-blue-600/40'
                    }`}>
                        {curriculum && !!curriculumFilter ? (
                            <div className="bg-white rounded-full px-3 py-1 flex items-center gap-1.5 shadow-md transform scale-100 group-hover:scale-105 transition-transform duration-300 border border-amber-200">
                                <HiExclamationTriangle className="w-3.5 h-3.5 text-amber-500 font-bold" />
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wide">มีหลักสูตรแล้ว</span>
                            </div>
                        ) : (
                            <div className="bg-white rounded-full px-3 py-1 flex items-center gap-1.5 shadow-md transform scale-100 group-hover:scale-105 transition-transform duration-300">
                                <HiPlus className="w-3.5 h-3.5 text-blue-600 font-bold" />
                                <span className="text-[11px] font-black text-blue-600 uppercase tracking-wide">Assign</span>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        );
    }

    return (
        <div className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col font-sukhumvit">

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 gap-3 h-64">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    <span className="font-bold text-sm">กำลังโหลดข้อมูล...</span>
                </div>
            ) : (
                <div className={cn('flex-1 min-h-0 flex gap-3', isMdOrBelow && 'pb-[4.5rem]')}>

                    {/* ── LEFT SIDEBAR — Curriculum List ── */}
                    <div className={cn(
                        'shrink-0 flex-col overflow-hidden',
                        panelCardClass,
                        showCurriculumPanel ? 'flex' : 'hidden',
                        'w-full lg:w-[230px] lg:flex',
                    )}>
                        {/* Year + search */}
                        <div className={panelHeaderClass}>
                            <div className="flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1 shadow-sm">
                                <PanelCapsuleSelect
                                    value={curriculumYear}
                                    onChange={setCurriculumYear}
                                    options={ACADEMIC_YEARS.map((y) => ({
                                        value: y,
                                        label: `ปีการศึกษา ${y}`,
                                    }))}
                                />
                            </div>
                            {/* Curriculum search */}
                            <div className="relative">
                                <HiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาหลักสูตร..."
                                    value={curriculumSearch}
                                    onChange={e => setCurriculumSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-100 rounded-xl text-[11px] font-bold outline-none placeholder:text-slate-400 text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Curriculum list */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pt-1 pb-4 space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 pb-2">หลักสูตร ({filteredCurriculumPackages.length})</p>
                            {filteredCurriculumPackages.map(pkg => {
                                const isAssigned = classrooms.some(c => c.curriculumPackageId === pkg.id);
                                const isActive = curriculumFilter === pkg.id;
                                return (
                                    <button
                                        key={pkg.id}
                                        draggable
                                        onDragStart={(e) => handleCurriculumDragStart(e, pkg.id)}
                                        onClick={() => setCurriculumFilter(isActive ? '' : pkg.id)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all cursor-grab active:cursor-grabbing group ${
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${
                                            isActive ? 'bg-white/20' : 'bg-blue-50'
                                        }`}>
                                            <HiBookOpen className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                                        </div>
                                        <div className="flex flex-col min-w-0 text-left flex-1">
                                            <span className={`text-[11px] font-bold truncate leading-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                                                {pkg.name}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                                ปี {pkg.year || pkg.name?.match(/\d{4}/)?.[0] || '—'}
                                            </span>
                                        </div>
                                        {isAssigned && (
                                            <HiCheckCircle className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                                        )}
                                    </button>
                                );
                            })}
                            {filteredCurriculumPackages.length === 0 && (
                                <p className="text-[10px] text-center py-6 text-slate-400 font-bold">ไม่พบหลักสูตร</p>
                            )}
                        </div>
                    </div>

                    {/* ── MIDDLE — Classroom Workspace ── */}
                    <div className={cn(
                        'min-w-0 flex-col overflow-hidden',
                        panelCardClass,
                        'px-3 lg:px-5',
                        showClassroomPanel ? 'flex flex-1' : 'hidden',
                        'lg:flex lg:flex-1',
                    )}>

                        {selectedClassroomId ? (
                            // ── Classroom Detail View ──
                            (() => {
                                const cls = classrooms.find(c => c.id === selectedClassroomId);
                                if (!cls) return null;
                                const count = studentsByClass[cls.id]?.length || 0;
                                const dept = DEPT_CONFIG[cls.departmentId || 'secondary'] ?? DEPT_CONFIG.secondary;
                                const curriculum = curriculumPackages.find(p => p.id === cls.curriculumPackageId);

                                return (
                                    <div className="flex flex-col h-full">
                                        {/* Detail header */}
                                        <div className="flex items-center justify-between border-b border-black/[0.05] py-3 mb-4 lg:py-4 lg:mb-5 shrink-0 gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                {/* Back button */}
                                                <button
                                                    onClick={() => setSelectedClassroomId(null)}
                                                    className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white hover:bg-slate-50 border border-black/[0.06] shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shrink-0 active:scale-95"
                                                    title="ย้อนกลับ"
                                                >
                                                    <HiArrowLeft size={16} className="text-slate-600 lg:hidden" />
                                                    <HiArrowLeft size={18} className="text-slate-600 hidden lg:block" />
                                                </button>

                                                {/* Class Badge */}
                                                <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br ${dept.gradient} flex items-center justify-center shadow-sm shrink-0 border border-white/20`}>
                                                    <span className="text-white text-[12px] lg:text-[13px] font-black">{cls.gradeLevel}</span>
                                                </div>

                                                {/* Text Info */}
                                                <div className="min-w-0 flex flex-col justify-center">
                                                    <h2 className="text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight truncate">ห้อง {cls.className}</h2>
                                                    <p className="text-[10px] lg:text-[10.5px] text-slate-400 font-bold mt-0.5 truncate">
                                                        {dept.label} · {count} คน
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {curriculum && (
                                                    <span className="hidden sm:inline-flex items-center gap-1 max-w-[120px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-100/80 shadow-sm truncate">
                                                        <span className="truncate">{curriculum.name}</span>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                handleRemoveCurriculum(cls.id, curriculum.name || '');
                                                            }}
                                                            className="p-0.5 rounded-full hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-all duration-200 shrink-0"
                                                            title="ยกเลิกหลักสูตร"
                                                        >
                                                            <HiXMark className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingClassroom(cls);
                                                        const deptId = Object.entries(GRADE_ORDER).find(([_, grades]) =>
                                                            grades.includes(cls.gradeLevel)
                                                        )?.[0] || 'secondary';
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
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-black/[0.06] shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all active:scale-95"
                                                    title="แก้ไขห้องเรียน"
                                                >
                                                    <HiPencil size={16} className="text-slate-600" />
                                                </button>
                                                <button
                                                    onClick={() => deleteClassroom(cls.id, count)}
                                                    className="w-10 h-10 rounded-full bg-white hover:bg-rose-50 border border-black/[0.06] shadow-sm flex items-center justify-center text-slate-500 hover:text-rose-600 transition-all active:scale-95"
                                                    title="ลบห้องเรียน"
                                                >
                                                    <HiTrash size={16} className="text-slate-600" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Teacher banner */}
                                        {cls.homeroomTeacherIds && cls.homeroomTeacherIds.length > 0 && (
                                            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4 shrink-0">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                    <HiUserCircle className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">ครูประจำชั้น</p>
                                                    <p className="text-[13px] font-bold text-emerald-900">
                                                        {cls.homeroomTeacherIds.map(tid => {
                                                            const t = teachers.find(tc => tc.id === tid);
                                                            return t ? (t.displayName || `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim()) : tid;
                                                        }).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Student grid */}
                                        <div
                                            className="flex-1 overflow-y-auto scrollbar-hide"
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, cls.id)}
                                        >
                                            {count === 0 ? (
                                                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 gap-2">
                                                    <HiArrowRight className="w-8 h-8" />
                                                    <p className="text-sm font-bold">ลากนักเรียนมาวางที่นี่</p>
                                                    <p className="text-[11px]">เพื่อเพิ่มนักเรียนเข้าห้อง {cls.className}</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-10">
                                                    <AnimatePresence>
                                                        {(studentsByClass[cls.id] || [])
                                                            .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                                            .map(student => {
                                                                const isSelected = selectedStudentIds.has(student.id);
                                                                return (
                                                                    <motion.div
                                                                        key={student.id}
                                                                        layout
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        exit={{ opacity: 0 }}
                                                                        draggable
                                                                        onDragStart={(e: any) => handleDragStart(e, student.id)}
                                                                        onClick={() => toggleStudentSelection(student.id)}
                                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                                                            isSelected
                                                                                ? 'bg-blue-600 text-white'
                                                                                : 'bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                                        }`}
                                                                    >
                                                                        <div className={`w-8 h-8 rounded-xl overflow-hidden shrink-0 ${isSelected ? 'ring-2 ring-white/40' : ''}`}>
                                                                            <img
                                                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                                                                                alt="avatar"
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`text-[12px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                                                {student.prefix}{student.firstName} {student.lastName}
                                                                            </p>
                                                                            <p className={`text-[10px] font-medium uppercase tracking-tight ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                                {student.studentCode || 'N/A'}
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); moveStudents([student.id], 'unassigned'); }}
                                                                            className={`p-1.5 rounded-full transition-colors shrink-0 ${
                                                                                isSelected ? 'hover:bg-white/20 text-white/70' : 'hover:bg-rose-50 hover:text-rose-500 text-slate-300'
                                                                            }`}
                                                                        >
                                                                            <HiXMark className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            // ── Classroom Grid Overview ──
                            <div className="flex flex-col h-full">
                                {/* Header + filters */}
                                <div className="shrink-0 pt-2 pb-2 lg:pt-3 lg:pb-3">
                                    {/* Step Filters & Actions */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-3 lg:gap-2 lg:mb-4">
                                        {/* Step 1: Year */}
                                        <div className="flex items-center h-7 lg:h-9 bg-white/80 border border-black/[0.07] rounded-full px-0.5 lg:px-1 shadow-sm shrink-0">
                                            <PanelCapsuleSelect
                                                value={classroomYear}
                                                onChange={setClassroomYear}
                                                options={ACADEMIC_YEARS.map((y) => ({
                                                    value: y,
                                                    label: `ปีการศึกษา ${y}`,
                                                }))}
                                            />
                                        </div>

                                        <HiChevronDown className="w-3 h-3 lg:w-4 lg:h-4 text-slate-300 shrink-0 -rotate-90 hidden sm:block" />

                                        {/* Step 2: Department */}
                                        <div className="flex items-center h-7 lg:h-9 bg-white/80 border border-black/[0.07] rounded-full px-0.5 lg:px-1 shadow-sm shrink-0">
                                            <PanelCapsuleSelect
                                                value={deptFilter}
                                                onChange={(v) => { setDeptFilter(v); setGradeFilter(''); }}
                                                options={[
                                                    { value: '', label: 'ทุกแผนก' },
                                                    { value: 'early', label: 'ปฐมวัย' },
                                                    { value: 'primary', label: 'ประถม' },
                                                    { value: 'secondary', label: 'มัธยม' },
                                                ]}
                                            />
                                        </div>

                                        {deptFilter && (
                                            <>
                                                <HiChevronDown className="w-3 h-3 lg:w-4 lg:h-4 text-slate-300 shrink-0 -rotate-90 hidden sm:block" />
                                                {/* Step 3: Grade */}
                                                <div className="flex items-center h-7 lg:h-9 bg-white/80 border border-black/[0.07] rounded-full px-0.5 lg:px-1 shadow-sm shrink-0">
                                                    <PanelCapsuleSelect
                                                        value={gradeFilter}
                                                        onChange={setGradeFilter}
                                                        options={[
                                                            { value: '', label: 'ทุกระดับชั้น' },
                                                            ...(GRADE_ORDER[deptFilter] || []).map(g => ({
                                                                value: g,
                                                                label: g
                                                            }))
                                                        ]}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="flex items-center gap-2 ml-auto lg:gap-4">
                                            <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                <HiSquares2X2 className="w-3.5 h-3.5" />
                                                {filteredClassrooms.length} ห้อง
                                            </div>

                                            <button
                                                onClick={() => { setEditingClassroom(null); setShowCreateModal(true); }}
                                                className="flex items-center gap-1 px-3 py-1.5 lg:gap-1.5 lg:px-4 lg:py-2 rounded-full bg-slate-900 text-white text-[10px] lg:text-[11px] font-black hover:bg-slate-700 active:scale-95 transition-all shadow-sm shrink-0"
                                            >
                                                <HiPlus className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                                                เพิ่มห้อง
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Card grid */}
                                <div className="flex-1 overflow-y-auto scrollbar-hide p-1.5">
                                    {filteredClassrooms.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <HiAcademicCap className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-bold">ไม่พบห้องเรียน</p>
                                            <button
                                                onClick={() => { setDeptFilter(''); setGradeFilter(''); }}
                                                className="px-4 py-2 bg-slate-900 text-white text-[11px] font-black rounded-full shadow hover:bg-slate-800 transition-all"
                                            >
                                                ล้างตัวกรอง
                                            </button>
                                        </div>
                                    ) : (
                                        <motion.div
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 lg:gap-3 pb-10"
                                            initial="hidden"
                                            animate="show"
                                            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
                                        >
                                            {filteredClassrooms.map(cls => (
                                                <motion.div
                                                    key={cls.id}
                                                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                                                >
                                                    <ClassroomCard cls={cls} />
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT PANEL — Unassigned Pool ── */}
                    <div
                        className={cn(
                            'shrink-0 flex-col overflow-hidden',
                            panelCardClass,
                            showUnassignedPanel ? 'flex' : 'hidden',
                            'w-full lg:w-[280px] lg:flex',
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'unassigned')}
                    >
                        {/* Panel header */}
                        <div className={panelHeaderClass}>
                            <div className="flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1 shadow-sm">
                                <PanelCapsuleSelect
                                    value={studentYear}
                                    onChange={setStudentYear}
                                    options={ACADEMIC_YEARS.map((y) => ({
                                        value: y,
                                        label: `ปีการศึกษา ${y}`,
                                    }))}
                                />
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <HiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อ รหัส..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none placeholder:text-slate-300 text-slate-700"
                                />
                            </div>

                            {/* Dept + grade filter */}
                            <div className="flex gap-1.5">
                                <div className="flex-1 flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1 shadow-sm">
                                    <PanelCapsuleSelect
                                        value={unassignedDeptFilter}
                                        onChange={(v) => {
                                            setUnassignedDeptFilter(v);
                                            setUnassignedGradeFilter('');
                                        }}
                                        options={[
                                            { value: '', label: 'ทุกแผนก' },
                                            { value: 'early', label: 'ปฐมวัย' },
                                            { value: 'primary', label: 'ประถม' },
                                            { value: 'secondary', label: 'มัธยม' },
                                        ]}
                                    />
                                </div>
                                <div className="flex-1 flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1 shadow-sm">
                                    <PanelCapsuleSelect
                                        value={unassignedGradeFilter}
                                        disabled={!unassignedDeptFilter}
                                        onChange={setUnassignedGradeFilter}
                                        options={[
                                            { value: '', label: 'ทุกชั้น' },
                                            ...((unassignedDeptFilter && GRADE_ORDER[unassignedDeptFilter]) || []).map((g) => ({
                                                value: g,
                                                label: g,
                                            })),
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Student count badge */}
                        <div className="px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {filteredUnassignedStudents.length} คน
                            </span>
                            {isMdOrBelow && filteredUnassignedStudents.length > 0 && (
                                <span className="text-[9px] font-bold text-slate-400 lg:hidden">
                                    แตะเลือก → ย้ายห้องด้านล่าง
                                </span>
                            )}
                            {filteredUnassignedStudents.length > 0 && (
                                <button
                                    onClick={handleSelectAllUnassigned}
                                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    {selectedStudentIds.size > 0 
                                        ? `เลือก ${selectedStudentIds.size} คน (ล้าง)` 
                                        : 'เลือกทั้งหมด'}
                                </button>
                            )}
                        </div>


                        {/* Student list */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pt-1 pb-20 space-y-0.5">
                            <AnimatePresence>
                                {filteredUnassignedStudents.map((student, index, arr) => {
                                    const isSelected = selectedStudentIds.has(student.id);
                                    const prevSelected = index > 0 && selectedStudentIds.has(arr[index - 1].id);
                                    const nextSelected = index < arr.length - 1 && selectedStudentIds.has(arr[index + 1].id);

                                    return (
                                        <motion.div
                                            key={student.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            draggable
                                            onDragStart={(e: any) => handleDragStart(e, student.id)}
                                            onClick={() => toggleStudentSelection(student.id)}
                                            className={`flex items-center gap-2.5 py-2 px-2 cursor-pointer transition-all ${
                                                isSelected
                                                    ? `bg-blue-600 text-white z-10 ${prevSelected ? '' : 'rounded-t-xl mt-1'} ${nextSelected ? 'border-b border-blue-400/30' : 'rounded-b-xl mb-1'}`
                                                    : 'hover:bg-slate-50 rounded-xl'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 ${isSelected ? 'ring-2 ring-white/30' : ''}`}>
                                                <img
                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[12px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                    {student.prefix}{student.firstName}
                                                </p>
                                                <p className={`text-[10px] font-medium truncate -mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                    {student.lastName}
                                                </p>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {student.studentCode || '—'}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                                {filteredUnassignedStudents.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl mt-2">
                                        <HiCheckCircle className="w-6 h-6" />
                                        <span className="text-xs font-bold text-center px-4">ไม่มีนักเรียนตกค้างตามตัวกรองนี้</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                </div>
            )}

            {/* ── Mobile bottom navigation ── */}
            {isMdOrBelow && !selectedClassroomId && !loading && (
                <div className="fixed inset-x-3 bottom-[max(4.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
                    <div className="flex items-center gap-1 rounded-2xl border border-white/80 bg-white/90 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                        {([
                            { id: 'rooms' as const, label: 'ห้องเรียน', icon: HiSquares2X2, count: filteredClassrooms.length },
                            { id: 'unassigned' as const, label: 'ตกค้าง', icon: HiUsers, count: filteredUnassignedStudents.length },
                            { id: 'curriculum' as const, label: 'หลักสูตร', icon: HiBookOpen, count: filteredCurriculumPackages.length },
                        ]).map((tab) => {
                            const Icon = tab.icon;
                            const isActive = mobileView === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setMobileView(tab.id);
                                        setSelectedStudentIds(new Set());
                                    }}
                                    className={cn(
                                        'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all',
                                        isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50',
                                    )}
                                >
                                    <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400')} />
                                    <span className="text-[10px] font-black leading-none">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={cn(
                                            'absolute right-2 top-1.5 min-w-[16px] rounded-full px-1 text-center text-[8px] font-black leading-4',
                                            isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                                        )}>
                                            {tab.count > 99 ? '99+' : tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Create/Edit Classroom Modal ── */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                        onClick={() => { setShowCreateModal(false); setEditingClassroom(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-[92vw] sm:max-w-md rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
                            style={{
                                background: 'rgba(255,255,255,0.70)',
                                backdropFilter: 'blur(24px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                            }}
                        >
                            <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex items-center justify-between bg-transparent">
                                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                                    {editingClassroom ? 'แก้ไขข้อมูลห้องเรียน' : 'สร้างห้องเรียนใหม่'}
                                </h2>
                                <button
                                    onClick={() => { setShowCreateModal(false); setEditingClassroom(null); }}
                                    className="w-8 h-8 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
                                >
                                    <HiXMark className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                {/* Dept */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">แผนก *</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                        {[{ id: 'early', label: 'ปฐมวัย' }, { id: 'primary', label: 'ประถม' }, { id: 'secondary', label: 'มัธยม' }].map(d => (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => setNewRoom(p => ({ ...p, departmentId: d.id, gradeLevel: '' }))}
                                                className={`flex-1 h-9 text-xs font-bold rounded-lg transition-all ${
                                                    (newRoom as any).departmentId === d.id
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Year */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">ปีการศึกษา *</label>
                                        <input
                                            type="text"
                                            placeholder="เช่น 2567"
                                            value={newRoom.academicYearId}
                                            onChange={e => setNewRoom(p => ({ ...p, academicYearId: e.target.value }))}
                                            className="w-full h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4 outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">ระดับชั้น *</label>
                                        <select
                                            value={newRoom.gradeLevel}
                                            onChange={e => setNewRoom(p => ({ ...p, gradeLevel: e.target.value }))}
                                            className="w-full h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4 outline-none appearance-none focus:ring-2 focus:ring-blue-100"
                                        >
                                            <option value="" disabled>เลือกชั้น</option>
                                            {GRADE_ORDER[(newRoom as any).departmentId || 'secondary']?.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">ชื่อห้อง (ทับ) *</label>
                                        <input
                                            type="text"
                                            placeholder="เช่น 1"
                                            value={newRoom.name}
                                            onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))}
                                            className="w-full h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4 outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">แผนการเรียน</label>
                                        <input
                                            type="text"
                                            placeholder="เช่น วิทย์-คณิต"
                                            value={newRoom.track}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const match = TRACK_OPTIONS.find(t => t.label === val);
                                                setNewRoom(p => ({ ...p, track: val, trackColor: match ? match.color : 'bg-slate-500 shadow-slate-500/40' }));
                                            }}
                                            className="w-full h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4 outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-end">
                                    <button
                                        disabled={!newRoom.name.trim() || !newRoom.academicYearId || isCreating}
                                        onClick={createClassroom}
                                        className="rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold h-10 px-8 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition-colors"
                                    >
                                        {isCreating ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : editingClassroom ? (
                                            <HiCheck className="w-4 h-4" />
                                        ) : (
                                            <HiPlus className="w-4 h-4" />
                                        )}
                                        บันทึก
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                            <div className="relative">
                                <select
                                    value={bulkTargetClass}
                                    onChange={e => setBulkTargetClass(e.target.value)}
                                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200/50 rounded-full pl-4 pr-7 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none appearance-none min-w-[140px] cursor-pointer transition-all"
                                >
                                    <option value="">-- เลือกห้อง --</option>
                                    {([...classrooms].sort((a, b) => {
                                        const flatGrades = Object.values(GRADE_ORDER).flat();
                                        const idxA = flatGrades.indexOf(a.gradeLevel);
                                        const idxB = flatGrades.indexOf(b.gradeLevel);
                                        if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                                        return a.className.localeCompare(b.className, undefined, { numeric: true });
                                    })).map(c => (
                                        <option key={c.id} value={c.id}>{c.className}</option>
                                    ))}
                                </select>
                                <HiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>
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
        </div>
    );
}
