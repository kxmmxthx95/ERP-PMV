import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckSquare, Search, ArrowRight,
    Loader2, CheckCircle2, Plus, X, MoreHorizontal, ListFilter, Trash2, Pencil, Check,
    BookOpen, UserCheck, ChevronDown
} from 'lucide-react';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
}

interface Classroom {
    id: string;
    className: string;          // "ม.4/1" format (gradeLevel/roomNumber)
    gradeLevel: string;
    roomNumber: string;
    departmentId?: string;
    academicYearId?: string;
    capacity?: number;          // optional for compatibility
    studentIds?: string[];      // optional
    track?: string;             // optional
    trackColor?: string;        // optional
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

export default function ClassroomAssignmentTab() {
    // --- State ---
    const [selectedYear, setSelectedYear] = useState<string>('2567');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoom, setNewRoom] = useState({
        name: '',
        gradeLevel: 'ม.4',
        departmentId: 'secondary',
        capacity: '40',
        track: TRACK_OPTIONS[0].label,
        trackColor: TRACK_OPTIONS[0].color,
        academicYearId: selectedYear,
        curriculumPackageId: '',
        homeroomTeacherIds: [] as string[],
    });
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deptFilter, setDeptFilter] = useState<string>('');
    const [gradeFilter, setGradeFilter] = useState<string>('');
    const [classroomFilter, setClassroomFilter] = useState<string>('');
    const [curriculumFilter, setCurriculumFilter] = useState<string>('');
    const [curriculumSearch, setCurriculumSearch] = useState('');

    const [sidebarDeptFilter, setSidebarDeptFilter] = useState<string>('');
    const [sidebarGradeFilter, setSidebarGradeFilter] = useState<string>('');
    const [unassignedDeptFilter, setUnassignedDeptFilter] = useState<string>('');
    const [unassignedGradeFilter, setUnassignedGradeFilter] = useState<string>('');
    const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);

    const [students, setStudents] = useState<Student[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    

    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [curriculumPackages, setCurriculumPackages] = useState<CurriculumPackage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Bulk Select State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [bulkTargetClass, setBulkTargetClass] = useState<string>('');

    // --- Fetch Data ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all students then compute effective grade for selected year
                const stSnapshot = await getDocs(collection(db, 'students'));
                const stData = stSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

                // Fetch Classrooms (Flexible filtering for academicYearId OR academicYear)
                const clSnapshot = await getDocs(collection(db, 'classes'));
                let clData = clSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Classroom))
                    .filter(c => 
                        String(c.academicYearId) === selectedYear || 
                        String((c as any).academicYear) === selectedYear
                    );

                // Fetch Enrollments to support new data structure
                const enSnapshot = await getDocs(collection(db, 'enrollments'));
                const enData = enSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                // Merge enrollment data into students
                const mergedStudents = stData.map(student => {
                    // Find enrollment for the selected year
                    const enrollment = enData.find(e => e.studentId === student.id && String(e.academicYearId) === selectedYear);
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

                // Fetch teachers (once, not year-dependent)
                const tcSnapshot = await getDocs(collection(db, 'teachers'));
                const tcData = tcSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
                setTeachers(tcData);

                // Fetch curriculum packages (using 'curriculums' collection)
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
    }, [selectedYear]);

    // --- Derived State ---
    const sidebarClassrooms = useMemo(() => {
        return classrooms.filter(cls => {
            const matchYear = String(cls.academicYearId) === selectedYear;
            const matchDept = !deptFilter || cls.departmentId === deptFilter;
            return matchYear && matchDept;
        });
    }, [classrooms, selectedYear, deptFilter]);

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

    const filteredStudents = useMemo(() => {
        let result = students;

        // 1. Filter by Academic Year logic
        if (selectedYear) {
            result = result.filter(s => {
                // Priority 1: If assigned to a classroom, show if that classroom is in the current year
                if (s.classroomId) {
                    const cls = classrooms.find(c => c.id === s.classroomId);
                    return !!cls; // If found in our current year's classroom list, show them
                }
                
                // Priority 2: If unassigned, show if their Current Year or Enrollment Year matches
                const studentCurrentYear = (s as any).academicYear || s.academicYearId;
                return String(studentCurrentYear) === selectedYear;
            });
        }

        // 2. Filter by Search Query
        if (!searchQuery) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(s =>
            s.firstName.toLowerCase().includes(q) ||
            s.lastName.toLowerCase().includes(q) ||
            s.nationalId.includes(q) ||
            s.studentCode?.toLowerCase().includes(q)
        );
    }, [students, searchQuery, selectedYear, classrooms]);
    
    const filteredCurriculumPackages = useMemo(() => {
        return curriculumPackages
            .filter(pkg => {
                const name = pkg.name?.toLowerCase() || '';
                const matchSearch = name.includes(curriculumSearch.toLowerCase());
                return matchSearch;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [curriculumPackages, curriculumSearch]);



    // Group students by classroom
    const studentsByClass = useMemo(() => {
        const groups: Record<string, Student[]> = { 'unassigned': [] };
        classrooms.forEach(c => groups[c.id] = []);

        filteredStudents.forEach(student => {
            if (student.classroomId && groups[student.classroomId]) {
                groups[student.classroomId].push(student);
            } else {
                groups['unassigned'].push(student);
            }
        });
        return groups;
    }, [filteredStudents, classrooms]);

    // Derived State: Filtered Unassigned Students
    const filteredUnassignedStudents = useMemo(() => {
        return (studentsByClass['unassigned'] || [])
            .filter(s => {
                if (unassignedDeptFilter) {
                    const expectedGrades = GRADE_ORDER[unassignedDeptFilter] || [];
                    if (!expectedGrades.includes(s.gradeLevel)) return false;
                }
                if (unassignedGradeFilter) {
                    if (s.gradeLevel !== unassignedGradeFilter) return false;
                }
                return true;
            })
            .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName));
    }, [studentsByClass, unassignedDeptFilter, unassignedGradeFilter]);

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

                // Legacy update directly on student doc
                const studentRef = doc(db, 'students', studentId);
                batch.update(studentRef, {
                    classroomId: targetClassroomId === 'unassigned' ? null : targetClassroomId,
                    currentTrack: targetClass ? targetClass.track : null
                });
            });

            // Update enrollments too
            const enrollmentsRef = collection(db, 'enrollments');
            const enrollmentsSnap = await getDocs(enrollmentsRef);
            enrollmentsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (studentIdsToMove.includes(data.studentId) && String(data.academicYearId) === selectedYear) {
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
            if (selectedClassroomId === classroomId) {
                setSelectedClassroomId(null);
            }
        } catch (error) {
            console.error("Delete classroom error:", error);
            alert('เกิดข้อผิดพลาดในการลบห้องเรียน');
        }
    };

    const handleCurriculumAssign = async (curriculumId: string, classroomId: string) => {
        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'classes', classroomId), {
                curriculumPackageId: curriculumId
            });
            setClassrooms(prev => prev.map(c => c.id === classroomId ? { ...c, curriculumPackageId: curriculumId } : c));
            setCurriculumFilter(''); // Clear selection after assign
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
            await updateDoc(doc(db, 'classes', classroomId), {
                curriculumPackageId: null
            });
            setClassrooms(prev => prev.map(c => 
                c.id === classroomId ? { ...c, curriculumPackageId: undefined } : c
            ));
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
            
            // Use manually selected departmentId if available, otherwise guess
            const departmentId = (newRoom as any).departmentId || 
                                (newRoom.gradeLevel.startsWith('อ') ? 'early' : 
                                 newRoom.gradeLevel.startsWith('ป') ? 'primary' : 'secondary');

            const roomData = {
                className: className,
                gradeLevel: newRoom.gradeLevel,
                roomNumber: roomNumber,
                departmentId: departmentId,
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
                const created: Classroom = {
                    id: docRef.id,
                    ...roomData,
                    studentIds: [],
                };
                setClassrooms(prev => [...prev, created]);
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
                academicYearId: selectedYear,
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
            const classRef = doc(db, 'classes', classroomId);
            await updateDoc(classRef, { curriculumPackageId: curriculumId });
            
            setClassrooms(prev => prev.map(c => 
                c.id === classroomId ? { ...c, curriculumPackageId: curriculumId } : c
            ));
        } catch (error) {
            console.error("Error assigning curriculum:", error);
            alert('ไม่สามารถมอบหมายหลักสูตรได้');
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetClassroomId: string) => {
        e.preventDefault();
        const studentId = e.dataTransfer.getData('studentId');
        const curriculumId = e.dataTransfer.getData('curriculumId');

        if (studentId) {
            moveStudents([studentId], targetClassroomId);
        } else if (curriculumId && targetClassroomId !== 'unassigned') {
            assignCurriculumToClass(curriculumId, targetClassroomId);
        }
    };

    const StudentCard = ({
        student,
        isList = false,
        isFirstInSelection = false,
        isLastInSelection = false
    }: {
        student: Student,
        isList?: boolean,
        isFirstInSelection?: boolean,
        isLastInSelection?: boolean
    }) => {
        const isSelected = selectedStudentIds.has(student.id);

        if (isList) {
            return (
                <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    draggable
                    onDragStart={(e: any) => handleDragStart(e, student.id)}
                    onClick={() => toggleStudentSelection(student.id)}
                    className={`group relative flex items-center transition-all cursor-pointer ${isSelected
                        ? `bg-blue-600 text-white z-10 px-1.5 py-1.5 ${isFirstInSelection ? 'rounded-t-md mt-1' : ''} ${isLastInSelection ? 'rounded-b-md mb-1' : 'border-b border-blue-400/30'}`
                        : 'px-1.5 py-1.5 border-b border-slate-100/60 hover:bg-slate-50/50'
                        }`}
                >
                    {/* List Grid Layout */}
                    <div className="flex-1 grid grid-cols-[36px_1.5fr_1fr_32px] items-center gap-3 min-w-0">
                        {/* 1. Photo/Icon */}
                        <div className={`w-8 h-8 rounded overflow-hidden bg-slate-100 shrink-0 transition-transform duration-300 ${isSelected ? 'scale-90' : 'group-hover:scale-105'}`}>
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`} alt="avatar" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex flex-col min-w-0">
                            <span className={`text-[12px] font-bold truncate tracking-tight block ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                {student.prefix}{student.firstName}
                            </span>
                            <span className={`text-[10px] font-medium truncate tracking-tight block -mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                {student.lastName}
                            </span>
                        </div>

                        {/* 3. ID (Middle column like Artist) */}
                        <div className="min-w-0 hidden sm:block">
                            <span className={`text-[10px] font-medium truncate tracking-tight uppercase ${isSelected ? 'text-blue-100/80' : 'text-slate-400'}`}>
                                {student.studentCode || 'N/A'}
                            </span>
                        </div>

                        {/* 4. Actions (Right like Time) */}
                        <div className={`flex justify-end transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'}`}>
                            <MoreHorizontal size={14} />
                        </div>
                    </div>
                </motion.div>
            );
        }

        // GRID MODE (Classroom Cards)
        return (
            <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                draggable
                onDragStart={(e: any) => handleDragStart(e, student.id)}
                onClick={() => toggleStudentSelection(student.id)}
                className={`group flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer relative ${isSelected
                    ? 'bg-blue-600 text-white border-transparent shadow-md z-10'
                    : 'bg-white/60 border-slate-200/60 shadow-sm hover:bg-white hover:shadow'
                    }`}
            >
                <div className={`w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 transition-transform duration-300 ${isSelected ? 'scale-90' : 'group-hover:scale-105'}`}>
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`} alt="avatar" />
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-[13px] font-bold truncate tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {student.prefix}{student.firstName} {student.lastName}
                    </span>
                    <span className={`text-[10px] font-medium tracking-tight uppercase ${isSelected ? 'text-blue-100/80' : 'text-slate-500 opacity-60'}`}>
                        {student.studentCode ? `ID: ${student.studentCode}` : `NID: ${student.nationalId?.slice(0, 4) || '----'}...${student.nationalId?.slice(-4) || '----'}`}
                    </span>
                </div>

                <div className={`shrink-0 transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'} flex items-center`}>
                    {student.classroomId ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                moveStudents([student.id], 'unassigned');
                            }}
                            className={`p-1.5 rounded-full transition-colors ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-50 hover:text-rose-500 text-slate-300'}`}
                            title="นำออกจากห้องเรียน"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    ) : (
                        <MoreHorizontal size={18} />
                    )}
                </div>
            </motion.div>
        );
    };


    return (
        <div className="min-h-full w-full p-0 pb-6 lg:pb-8 font-sukhumvit relative overflow-hidden flex flex-col">

            <div className="flex-1 min-h-0 relative z-10 flex gap-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="font-bold tracking-wider uppercase">Loading Data...</span>
                    </div>
                ) : (<>
                    {/* 1. LEFT COLUMN — Classroom Navigator (22%) */}
                    <div className="w-[22%] min-w-[260px] flex flex-col border-r border-slate-100/80 pr-4 overflow-y-auto scrollbar-hide">
                        <div className="p-2 shrink-0 mb-4">
                            {/* Curriculum Filter Row 1: Search */}
                            <div className="relative mb-3 group/search">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-blue-500 transition-colors" size={12} />
                                <input
                                    type="text"
                                    placeholder="ค้นหาหลักสูตร..."
                                    value={curriculumSearch}
                                    onChange={e => setCurriculumSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-100/50 hover:bg-slate-200/50 focus:bg-white border border-transparent focus:border-blue-200 rounded-xl text-[11px] font-bold outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>

                            {/* Curriculum Filter Row 2: Year, Dept, Grade */}
                            <div className="flex flex-col gap-2 mb-4">
                                <div className="flex gap-2">
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(e.target.value)}
                                        className="flex-1 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                                    >
                                        {['2565', '2566', '2567', '2568', '2569', '2570'].map(y => (
                                            <option key={y} value={y}>ปี {y}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={sidebarDeptFilter}
                                        onChange={e => {
                                            setSidebarDeptFilter(e.target.value);
                                            setSidebarGradeFilter('');
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                                    >
                                        <option value="">ทุกแผนก</option>
                                        <option value="early">ปฐมวัย</option>
                                        <option value="primary">ประถมศึกษา</option>
                                        <option value="secondary">มัธยมศึกษา</option>
                                    </select>
                                </div>
                                <select
                                    value={sidebarGradeFilter}
                                    disabled={!sidebarDeptFilter}
                                    onChange={e => setSidebarGradeFilter(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <option value="">ทุกชั้น</option>
                                    {sidebarDeptFilter && GRADE_ORDER[sidebarDeptFilter]?.map(g => (
                                        <option key={g} value={g}>ชั้น {g}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                {filteredCurriculumPackages.map(pkg => {
                                    const isAssigned = classrooms.some(c => c.curriculumPackageId === pkg.id);
                                    return (
                                        <button
                                            key={pkg.id}
                                            draggable
                                            onDragStart={(e) => handleCurriculumDragStart(e, pkg.id)}
                                            onClick={() => setCurriculumFilter(pkg.id === curriculumFilter ? '' : pkg.id)}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all cursor-grab active:cursor-grabbing group relative ${
                                                curriculumFilter === pkg.id 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                                : 'text-slate-600 hover:bg-slate-100/80'
                                            }`}
                                            title={pkg.name}
                                        >
                                            <div className={`w-7 h-7 shrink-0 rounded flex items-center justify-center ${
                                                curriculumFilter === pkg.id ? 'bg-white/20' : 'bg-blue-50 text-blue-500'
                                            }`}>
                                                <BookOpen size={14} className={curriculumFilter === pkg.id ? 'text-white' : 'text-blue-600'} />
                                            </div>
                                            <div className="flex flex-col min-w-0 text-left flex-1">
                                                <span className={`text-[12px] font-bold truncate ${curriculumFilter === pkg.id ? 'text-white' : 'text-slate-800'}`}>
                                                    {pkg.name}
                                                </span>
                                                <span className={`text-[9px] font-black uppercase tracking-wider ${curriculumFilter === pkg.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    หลักสูตรปี {pkg.name?.match(/\d{4}/)?.[0] || '-'}
                                                </span>
                                            </div>
                                            {isAssigned && (
                                                <CheckCircle2 
                                                    size={14} 
                                                    className={curriculumFilter === pkg.id ? 'text-white' : 'text-emerald-500'} 
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                                {filteredCurriculumPackages.length === 0 && (
                                    <p className="text-[10px] text-center py-4 text-slate-400 font-bold">ไม่พบหลักสูตร</p>
                                )}
                            </div>
                        </div>


                    </div>

                    {/* 2. MIDDLE COLUMN — Classroom Workspace (42%) */}
                    <div className="flex-1 min-w-0 flex flex-col px-6">
                        <div className="p-2 shrink-0 mb-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                                        การจัดการห้องเรียน
                                    </h2>
                                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest opacity-80">
                                        ปีการศึกษา {selectedYear}
                                    </p>
                                </div>

                            </div>

                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="relative group/filter">
                                    <select
                                        value={deptFilter}
                                        onChange={e => {
                                            setDeptFilter(e.target.value);
                                            setGradeFilter('');
                                            setClassroomFilter('');
                                        }}
                                        className="w-full appearance-none pl-10 pr-4 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-slate-700 transition-all font-bold text-[10px] outline-none cursor-pointer focus:ring-2 focus:ring-blue-300"
                                    >
                                        <option value="">ทุกแผนก</option>
                                        <option value="early">ปฐมวัย</option>
                                        <option value="primary">ประถมศึกษา</option>
                                        <option value="secondary">มัธยมศึกษา</option>
                                    </select>
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ListFilter size={14} />
                                    </div>
                                </div>

                                <div className="relative group/filter">
                                    <select
                                        value={gradeFilter}
                                        disabled={!deptFilter}
                                        onChange={e => {
                                            setGradeFilter(e.target.value);
                                            setClassroomFilter('');
                                        }}
                                        className="w-full appearance-none pl-10 pr-4 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-slate-700 transition-all font-bold text-[10px] outline-none cursor-pointer focus:ring-2 focus:ring-blue-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <option value="">ทุกระดับชั้น</option>
                                        {deptFilter && GRADE_ORDER[deptFilter]?.map(g => (
                                            <option key={g} value={g}>ชั้น {g}</option>
                                        ))}
                                    </select>
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ListFilter size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedClassroomId ? (
                            <div className="flex flex-col h-full">
                                {(() => {
                                    const cls = classrooms.find(c => c.id === selectedClassroomId);
                                    if (!cls) return null;
                                    const count = studentsByClass[cls.id]?.length || 0;
                                    return (
                                        <>
                                            {/* Workspace Header */}
                                            <div className="flex items-center justify-between mb-8 shrink-0">
                                                <div className="flex items-center gap-4">
                                                    <motion.button
                                                        whileHover={{ scale: 1.1, x: -2 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => setSelectedClassroomId(null)}
                                                        className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all mr-2"
                                                        title="กลับไปหน้าภาพรวม"
                                                    >
                                                        <ArrowRight size={16} className="rotate-180" />
                                                    </motion.button>
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br ${cls.trackColor || 'from-blue-500 to-blue-600'} shadow-lg shadow-blue-500/20`}>
                                                        <span className="text-lg font-black text-white">{cls.gradeLevel}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">ห้อง {cls.className}</h3>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[12px] font-bold text-slate-500">{cls.track || 'ไม่มีแผนการเรียน'}</span>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span className="text-[12px] font-bold text-blue-600">{count} นักเรียน</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
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
                                                                academicYearId: cls.academicYearId || selectedYear,
                                                                curriculumPackageId: cls.curriculumPackageId || '',
                                                                homeroomTeacherIds: cls.homeroomTeacherIds || [],
                                                            });
                                                            setShowCreateModal(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-blue-500 transition-all"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteClassroom(cls.id, count)}
                                                        className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-rose-500 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Teacher Banner (if any) */}
                                            {cls.homeroomTeacherIds && cls.homeroomTeacherIds.length > 0 && (
                                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                        <UserCheck size={20} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ครูประจำชั้น</span>
                                                        <span className="text-sm font-bold text-emerald-900">
                                                            {cls.homeroomTeacherIds.map(tid => {
                                                                const t = teachers.find(tc => tc.id === tid);
                                                                return t ? (t.displayName || `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim()) : tid;
                                                            }).join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, cls.id)}>
                                                    <AnimatePresence>
                                                        {(studentsByClass[cls.id] || [])
                                                            .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                                            .map(student => (
                                                                <StudentCard key={student.id} student={student} />
                                                            ))}
                                                        {count === 0 && (
                                                            <div className="col-span-full h-48 flex flex-col items-center justify-center text-slate-400 opacity-60 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/30">
                                                                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-sm">
                                                                    <ArrowRight size={20} />
                                                                </div>
                                                                <span className="text-sm font-bold">ลากนักเรียนจากด้านขวามาวางที่นี่</span>
                                                                <span className="text-[11px] mt-1">เพื่อเพิ่มนักเรียนเข้าห้อง {cls.className}</span>
                                                            </div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pt-0">
                                <div className="flex flex-col gap-1 pb-24">
                                    {/* List Header (Apple Music Style) */}
                                    <div className="grid grid-cols-[48px_1fr_200px_120px_80px_48px] gap-4 px-4 py-2 border-b border-slate-100/50 mb-1">
                                        <div /> {/* Icon space */}
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ห้องเรียน</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">แผนการเรียน</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">หลักสูตร</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">นักเรียน</span>
                                    </div>

                                    {filteredClassrooms.map((cls) => {
                                        const count = studentsByClass[cls.id]?.length || 0;
                                        const curriculum = curriculumPackages.find(p => p.id === cls.curriculumPackageId);
                                        const isAssignMode = selectedStudentIds.size > 0 || !!curriculumFilter;
                                        const isSelected = selectedClassroomId === cls.id;
                                        
                                        return (
                                            <motion.div
                                                key={cls.id}
                                                whileHover={{ backgroundColor: isSelected ? "#2563eb" : "rgba(241, 245, 249, 0.5)" }}
                                                onClick={() => handleClassCardClick(cls.id)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, cls.id)}
                                                className={`group grid grid-cols-[48px_1fr_200px_120px_80px_48px] gap-4 items-center px-2 py-1.5 rounded-md transition-all cursor-pointer relative ${
                                                    isSelected && !isAssignMode
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 z-10'
                                                    : isAssignMode
                                                    ? 'bg-blue-50/50 border border-dashed border-blue-300'
                                                    : 'hover:bg-slate-100/50'
                                                }`}
                                            >
                                                <div className="flex justify-center">
                                                    <div className={`w-9 h-9 shrink-0 rounded flex items-center justify-center font-sukhumvit shadow-sm ${
                                                        isSelected ? 'bg-white/20' : `bg-gradient-to-br ${cls.trackColor || 'from-blue-500 to-blue-600'}`
                                                    }`}>
                                                        <span className={`text-[13px] font-black ${isSelected ? 'text-white' : 'text-white'}`}>
                                                            {cls.gradeLevel.replace(/\D/g, '')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 2. Classroom Name & Info */}
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[14px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                            {cls.className}
                                                        </span>
                                                        {isAssignMode && (
                                                            <span className="flex items-center gap-1 text-[8px] font-black text-blue-600 bg-white px-1.5 py-0.5 rounded shadow-sm uppercase">
                                                                <Plus size={8} />
                                                                ASSIGN
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 3. Track (Artist Style) */}
                                                <div className="min-w-0">
                                                    <span className={`text-[13px] font-medium truncate block ${isSelected ? 'text-blue-50' : 'text-slate-500'}`}>
                                                        {cls.track || '-'}
                                                    </span>
                                                </div>

                                                {/* 4. Curriculum (Album Style) */}
                                                <div className="min-w-0 group/curr relative">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[13px] font-medium truncate block ${isSelected ? 'text-blue-50' : 'text-slate-500'}`}>
                                                            {curriculum ? curriculum.name : 'ไม่มีหลักสูตร'}
                                                        </span>
                                                        {curriculum && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveCurriculum(cls.id, curriculum.name || '');
                                                                }}
                                                                className={`p-1 rounded-full transition-all flex-shrink-0 ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'}`}
                                                            >
                                                                <X size={10} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 5. Student Count (Duration Style) */}
                                                <div className="text-center">
                                                    <span className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                                        {count}
                                                    </span>
                                                </div>

                                                {/* 6. Actions (Menu Style) */}
                                                <div className="flex justify-end pr-1">
                                                    <div className="flex items-center gap-0.5 opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingClassroom(cls);
                                                                setShowCreateModal(true);
                                                            }}
                                                            className={`p-1.5 rounded-md transition-all ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-white hover:shadow-sm text-slate-400 hover:text-blue-500'}`}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteClassroom(cls.id, count);
                                                            }}
                                                            className={`p-1.5 rounded-md transition-all ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-white hover:shadow-sm text-slate-400 hover:text-rose-500'}`}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. RIGHT COLUMN — Unassigned Pool (320px) */}
                    <div
                        className="w-[320px] shrink-0 flex flex-col bg-slate-50/50 backdrop-blur-md border-l border-slate-200/60 p-4"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'unassigned')}
                    >
                        {/* Row 1: Year, Search & Actions */}
                        <div className="flex items-center gap-2 mb-2">
                            {/* Year Picker (Small) */}
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(e.target.value)}
                                className="w-[75px] px-2 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 shrink-0 cursor-pointer"
                            >
                                {['2565', '2566', '2567', '2568', '2569', '2570'].map(y => (
                                    <option key={y} value={y}>ปี {y}</option>
                                ))}
                            </select>

                            {/* Search Input */}
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input
                                    type="text"
                                    placeholder="ค้นหา..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all w-full outline-none placeholder:text-slate-400 shadow-sm"
                                />
                            </div>

                            {/* Action Capsule */}
                            <div className="flex items-center bg-white/80 backdrop-blur-xl border border-white shadow-lg shadow-black/5 rounded-full p-0.5 shrink-0 gap-0.5">
                                <motion.button
                                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSelectAllUnassigned}
                                    className="p-1.5 rounded-full text-slate-600 hover:text-blue-600 transition-colors"
                                    title="เลือกนักเรียนทั้งหมด"
                                >
                                    <CheckSquare size={14} />
                                </motion.button>
                                <div className="w-[1px] h-3 bg-slate-200 mx-0.5" />
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowCreateModal(true)}
                                    className="p-1.5 rounded-full text-blue-500 hover:text-blue-600 transition-colors"
                                    title="เพิ่มห้องเรียน"
                                >
                                    <Plus size={14} />
                                </motion.button>
                            </div>
                        </div>

                        {/* Row 2: Dept & Grade Pickers */}
                        <div className="flex gap-2 mb-4">
                            <select
                                value={unassignedDeptFilter}
                                onChange={e => {
                                    setUnassignedDeptFilter(e.target.value);
                                    setUnassignedGradeFilter('');
                                }}
                                className="flex-1 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                            >
                                <option value="">ทุกแผนก</option>
                                <option value="early">ปฐมวัย</option>
                                <option value="primary">ประถมศึกษา</option>
                                <option value="secondary">มัธยมศึกษา</option>
                            </select>
                            
                            <select
                                value={unassignedGradeFilter}
                                disabled={!unassignedDeptFilter}
                                onChange={e => setUnassignedGradeFilter(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <option value="">ทุกชั้น</option>
                                {unassignedDeptFilter && GRADE_ORDER[unassignedDeptFilter]?.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>


                        {/* Divider */}
                        <div className="h-px bg-slate-100/80 mb-2" />



                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
                            <AnimatePresence>
                                {filteredUnassignedStudents
                                    .map((student, index, arr) => {
                                        const isSelected = selectedStudentIds.has(student.id);
                                        const prevSelected = index > 0 && selectedStudentIds.has(arr[index - 1].id);
                                        const nextSelected = index < arr.length - 1 && selectedStudentIds.has(arr[index + 1].id);

                                        return (
                                            <StudentCard
                                                key={student.id}
                                                student={student}
                                                isList={true}
                                                isFirstInSelection={isSelected && !prevSelected}
                                                isLastInSelection={isSelected && !nextSelected}
                                            />
                                        );
                                    })}
                                {filteredUnassignedStudents.length === 0 && (
                                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-md">
                                        <CheckCircle2 size={22} className="mb-2" />
                                        <span className="text-xs font-bold">ไม่มีนักเรียนตกค้างตามตัวกรองนี้</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </>)}
            </div>

            {/* --- Create Classroom Modal --- */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-slate-900">{editingClassroom ? 'แก้ไขห้องเรียน' : 'สร้างห้องเรียนใหม่'}</h2>
                                <button onClick={() => { setShowCreateModal(false); setEditingClassroom(null); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4">


                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">แผนก (Department) *</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                                        {[
                                            { id: 'early', label: 'ปฐมวัย' },
                                            { id: 'primary', label: 'ประถม' },
                                            { id: 'secondary', label: 'มัธยม' }
                                        ].map(dept => {
                                            const isActive = (newRoom as any).departmentId === dept.id;
                                            return (
                                                <button
                                                    key={dept.id}
                                                    type="button"
                                                    onClick={() => setNewRoom(p => ({ ...p, departmentId: dept.id, gradeLevel: '' }))}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                                        isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {dept.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">ปีการศึกษา *</label>
                                    <input
                                        type="text"
                                        placeholder="เช่น 2567"
                                        value={newRoom.academicYearId}
                                        onChange={e => setNewRoom(p => ({ ...p, academicYearId: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">ระดับชั้น</label>
                                    <select
                                        value={newRoom.gradeLevel}
                                        onChange={e => setNewRoom(p => ({ ...p, gradeLevel: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all appearance-none bg-white"
                                    >
                                        <option value="" disabled>-- เลือกระดับชั้น --</option>
                                        {GRADE_ORDER[(newRoom as any).departmentId || 'secondary']?.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">ชื่อห้องเรียน (ทับ)</label>
                                    <input
                                        type="text"
                                        placeholder={`เช่น 1 (สำหรับห้อง ${newRoom.gradeLevel || 'ม.4'}/1)`}
                                        value={newRoom.name}
                                        onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">แผนการเรียน / ชื่อแผนก</label>
                                    <input
                                        type="text"
                                        placeholder="พิมพ์ชื่อแผนกการเรียนที่นี่..."
                                        value={newRoom.track}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const match = TRACK_OPTIONS.find(t => t.label === val);
                                            setNewRoom(p => ({
                                                ...p,
                                                track: val,
                                                trackColor: match ? match.color : 'bg-slate-500 shadow-slate-500/40'
                                            }));
                                        }}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!newRoom.name.trim() || !newRoom.academicYearId || isCreating}
                                    onClick={createClassroom}
                                    className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : (editingClassroom ? <Check size={16} /> : <Plus size={16} />)}
                                    {editingClassroom ? 'บันทึกการแก้ไข' : 'สร้างห้องเรียน'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {(selectedStudentIds.size > 0 || !!curriculumFilter) && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full flex items-center gap-4 transition-all"
                        style={{
                            background: 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(24px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                            border: '1px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] text-white shadow-lg shadow-blue-600/30">
                                {selectedStudentIds.size > 0 ? selectedStudentIds.size : 1}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-[9px] uppercase tracking-[0.1em] text-slate-400 leading-none mb-0.5">รายการที่เลือก</span>
                                <span className="font-bold text-[12px] text-slate-700 leading-none">
                                    {selectedStudentIds.size > 0 ? 'นักเรียน' : 'หลักสูตร'}
                                </span>
                            </div>
                        </div>

                        <div className="w-[1px] h-5 bg-black/10" />

                        <div className="flex items-center gap-2.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.05em] text-slate-400">ย้ายไปที่</span>
                            <div className="relative group">
                                <select
                                    value={bulkTargetClass}
                                    onChange={(e) => setBulkTargetClass(e.target.value)}
                                    className="bg-slate-100 hover:bg-slate-200/70 border border-slate-200/50 rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none min-w-[150px] cursor-pointer transition-all pr-8"
                                >
                                    <option value="" className="text-black">-- เลือกห้องเรียน --</option>
                                    {([...classrooms].sort((a, b) => {
                                        const flatGrades = Object.values(GRADE_ORDER).flat();
                                        const gradeIndexA = flatGrades.indexOf(a.gradeLevel);
                                        const gradeIndexB = flatGrades.indexOf(b.gradeLevel);
                                        if (gradeIndexA !== gradeIndexB) {
                                            return (gradeIndexA === -1 ? 999 : gradeIndexA) - (gradeIndexB === -1 ? 999 : gradeIndexB);
                                        }
                                        return a.className.localeCompare(b.className, undefined, { numeric: true });
                                    }).map(c => (
                                        <option key={c.id} value={c.id} className="text-black">
                                            {c.className} {c.roomNumber ? `(${c.roomNumber})` : ''}
                                        </option>
                                    )))}
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98, y: 0 }}
                            disabled={!bulkTargetClass || isProcessing}
                            onClick={() => {
                                if (selectedStudentIds.size > 0) {
                                    moveStudents(Array.from(selectedStudentIds), bulkTargetClass);
                                } else if (curriculumFilter) {
                                    assignCurriculumToClass(curriculumFilter, bulkTargetClass);
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                        >
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                            ยืนยัน
                        </motion.button>

                        <div className="w-[1px] h-5 bg-black/10" />

                        <button
                            onClick={() => {
                                setSelectedStudentIds(new Set());
                                setCurriculumFilter('');
                                setBulkTargetClass('');
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                            title="ยกเลิกการเลือก"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}