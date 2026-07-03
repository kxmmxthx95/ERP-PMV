import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, CheckSquare, GraduationCap, LogOut,
    UserCheck, AlertCircle, Loader2, Search, MoreHorizontal,
    CheckCircle2, X, ChevronDown
} from 'lucide-react';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

type MobileTransitionView = 'source' | 'target';

// --- Grade Progression Maps ---
const GRADE_ORDER: Record<string, string[]> = {
    early: ['อ.1', 'อ.2', 'อ.3'],
    primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
    secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

// --- Capsule Select Component (matching StudentImportTab design) ---
function CapsuleSelect({
    value, onChange, options, placeholder, disabled = false, className = '', compact = false,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div className={cn(
            'relative flex items-center rounded-full border border-black/[0.05] bg-white/40 px-2 backdrop-blur-md shadow-sm transition-all',
            compact ? 'h-7' : 'h-9 px-3',
            disabled ? 'opacity-60' : 'hover:bg-white/60',
            className,
        )}>
            <select
                value={value}
                disabled={disabled}
                onChange={e => onChange(e.target.value)}
                className="appearance-none h-full w-full pr-5 bg-transparent text-[10px] font-black text-black/70 outline-none cursor-pointer disabled:cursor-not-allowed"
            >
                {placeholder && <option value="" className="text-slate-900">{placeholder}</option>}
                {options.map(o => (
                    <option key={o.value} value={o.value} className="text-slate-900">{o.label}</option>
                ))}
            </select>
            <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${disabled ? 'opacity-30' : 'text-black/35'}`} />
        </div>
    );
}



// --- Types ---
interface Student {
    id: string;
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    classroomId: string | null;
    currentStatus?: 'active' | 'graduated' | 'left';
    status?: string;
    academicYear?: string;
}

function isLeftStudent(student: Student): boolean {
    return student.currentStatus === 'left' || student.status === 'transferred';
}

interface Classroom {
    id: string;
    className: string;
    gradeLevel: string;
    roomNumber?: string;
    academicYear: string;
    academicYearId?: string;
    studentIds?: string[];
    track?: string;
}

type TransitionAction = 'promote' | 'graduate' | 'leave';

const YEARS = ['2565', '2566', '2567', '2568', '2569', '2570'];

export default function StudentTransitionTab() {
    // --- Source State ---
    const [sourceYear, setSourceYear] = useState<string>('2568');
    const [sourceDept, setSourceDept] = useState<string>('');
    const [sourceLevel, setSourceLevel] = useState<string>('');
    const [sourceClassroomId, setSourceClassroomId] = useState<string>('');

    // --- Target State ---
    const [transitionAction, setTransitionAction] = useState<TransitionAction>('promote');
    const [targetYear, setTargetYear] = useState<string>('2569');
    const [targetDept, setTargetDept] = useState<string>('');
    const [targetLevel, setTargetLevel] = useState<string>('');
    const [targetClassroomId, setTargetClassroomId] = useState<string>('');

    // --- Data State ---
    const [sourceClassrooms, setSourceClassrooms] = useState<Classroom[]>([]);
    const [targetClassrooms, setTargetClassrooms] = useState<Classroom[]>([]);
    const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
    const [stagedStudents, setStagedStudents] = useState<Student[]>([]);
    const [leftStudents, setLeftStudents] = useState<Student[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingLeftStudents, setLoadingLeftStudents] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    // --- Selection State ---
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
    const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileView, setMobileView] = useState<MobileTransitionView>('source');
    const [isMdOrBelow, setIsMdOrBelow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showSourcePanel = !isMdOrBelow || mobileView === 'source';
    const showTargetPanel = !isMdOrBelow || mobileView === 'target';

    const fetchLeftStudents = async () => {
        setLoadingLeftStudents(true);
        try {
            const stSnapshot = await getDocs(collection(db, 'students'));
            const stData = stSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Student))
                .filter(isLeftStudent)
                .filter((student) => {
                    if (sourceLevel && student.gradeLevel !== sourceLevel) return false;
                    if (sourceYear) {
                        const year = String(student.academicYear ?? '');
                        if (year && year !== sourceYear) return false;
                    }
                    return true;
                });
            setLeftStudents(stData);
        } catch (error) {
            console.error('Error fetching left students:', error);
        } finally {
            setLoadingLeftStudents(false);
        }
    };

    // --- Fetch Source Classrooms & Students ---
    useEffect(() => {
        const fetchSourceData = async () => {
            setLoading(true);
            try {
                const clSnapshot = await getDocs(collection(db, 'classes'));
                const clData = clSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Classroom))
                    .filter(c => (String(c.academicYear) === sourceYear || String(c.academicYearId) === sourceYear) && c.gradeLevel === sourceLevel);
                setSourceClassrooms(clData);

                if (sourceClassroomId) {
                    const stSnapshot = await getDocs(collection(db, 'students'));
                    let stData = stSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
                    stData = stData.filter(s => s.classroomId === sourceClassroomId && (s.currentStatus === 'active' || !s.currentStatus));
                    stData = stData.filter(s => !stagedStudents.find(st => st.id === s.id));
                    setSourceStudents(stData);
                } else {
                    setSourceStudents([]);
                }
                setSelectedSourceIds(new Set());
            } catch (error) {
                console.error('Error fetching source data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSourceData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceYear, sourceLevel, sourceClassroomId]);

    useEffect(() => {
        if (transitionAction !== 'leave') {
            setLeftStudents([]);
            return;
        }
        void fetchLeftStudents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionAction, sourceYear, sourceLevel]);

    // --- Fetch Target Classrooms ---
    useEffect(() => {
        const fetchTargetData = async () => {
            if (transitionAction !== 'promote') return;
            try {
                const clSnapshot = await getDocs(collection(db, 'classes'));
                const clData = clSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Classroom))
                    .filter(c => (String(c.academicYear) === targetYear || String(c.academicYearId) === targetYear) && c.gradeLevel === targetLevel);
                setTargetClassrooms(clData);
            } catch (error) {
                console.error('Error fetching target data:', error);
            }
        };
        fetchTargetData();
    }, [targetYear, targetLevel, transitionAction]);

    // --- Handlers ---
    const stageStudent = (id: string) => {
        const student = sourceStudents.find(s => s.id === id);
        if (!student) return;
        setStagedStudents(prev => [...prev, student]);
        setSourceStudents(prev => prev.filter(s => s.id !== id));
        setSelectedSourceIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        if (isMdOrBelow) setMobileView('target');
    };

    const stageSelectedStudents = () => {
        const toMove = sourceStudents.filter(s => selectedSourceIds.has(s.id));
        setStagedStudents(prev => [...prev, ...toMove]);
        setSourceStudents(prev => prev.filter(s => !selectedSourceIds.has(s.id)));
        setSelectedSourceIds(new Set());
        if (isMdOrBelow && toMove.length > 0) setMobileView('target');
    };

    const unstageSelected = () => {
        const toReturn = stagedStudents.filter(s => selectedStagedIds.has(s.id));
        setSourceStudents(prev => [...prev, ...toReturn]);
        setStagedStudents(prev => prev.filter(s => !selectedStagedIds.has(s.id)));
        setSelectedStagedIds(new Set());
    };

    const unstageStudent = (id: string) => {
        const student = stagedStudents.find(s => s.id === id);
        if (!student) return;
        setSourceStudents(prev => [...prev, student]);
        setStagedStudents(prev => prev.filter(s => s.id !== id));
        setSelectedStagedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const toggleAll = (isSource: boolean) => {
        if (isSource) {
            if (selectedSourceIds.size === filteredSourceStudents.length) setSelectedSourceIds(new Set());
            else setSelectedSourceIds(new Set(filteredSourceStudents.map(s => s.id)));
        } else {
            if (selectedStagedIds.size === stagedStudents.length) setSelectedStagedIds(new Set());
            else setSelectedStagedIds(new Set(stagedStudents.map(s => s.id)));
        }
    };

    const filteredSourceStudents = useMemo(() => {
        if (!searchQuery) return sourceStudents;
        return sourceStudents.filter(s =>
            s.firstName.includes(searchQuery) ||
            s.lastName.includes(searchQuery) ||
            s.studentCode?.includes(searchQuery)
        );
    }, [sourceStudents, searchQuery]);

    const filteredLeftStudents = useMemo(() => {
        const list = !searchQuery
            ? leftStudents
            : leftStudents.filter(s =>
                s.firstName.includes(searchQuery) ||
                s.lastName.includes(searchQuery) ||
                s.studentCode?.includes(searchQuery),
            );
        return [...list].sort(
            (a, b) =>
                (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
                || a.firstName.localeCompare(b.firstName, 'th'),
        );
    }, [leftStudents, searchQuery]);

    const commitTransition = async () => {
        if (stagedStudents.length === 0) return;
        if (transitionAction === 'promote' && !targetClassroomId) {
            alert('กรุณาเลือกห้องเรียนปลายทาง');
            return;
        }

        setIsCommitting(true);
        const batch = writeBatch(db);

        try {
            const studentIds = stagedStudents.map(s => s.id);

            // Get target classroom data if promoting (needed for enrollments)
            let targetClassData: any = null;
            if (transitionAction === 'promote' && targetClassroomId) {
                const targetClsSnap = await getDocs(collection(db, 'classes'));
                targetClassData = targetClsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .find(c => c.id === targetClassroomId);
            }

            stagedStudents.forEach(student => {
                const studentRef = doc(db, 'students', student.id);
                const updateData: any = {};
                const historyPayload = {
                    academicYear: transitionAction === 'promote' ? targetYear : sourceYear,
                    level: transitionAction === 'promote' ? targetLevel : student.gradeLevel,
                    classroomId: transitionAction === 'promote' ? targetClassroomId : null,
                    status: transitionAction === 'promote' ? 'active' : (transitionAction === 'graduate' ? 'graduated' : 'left'),
                    timestamp: new Date()
                };

                if (transitionAction === 'promote') {
                    updateData.gradeLevel = targetLevel;
                    updateData.classroomId = targetClassroomId;
                    updateData.academicYear = targetYear; // Current operational year
                    updateData.currentStatus = 'active';

                    // Auto-update prefix
                    if (['ม.4', 'ม.5', 'ม.6'].includes(targetLevel)) {
                        if (student.prefix === 'ด.ช.') updateData.prefix = 'นาย';
                        if (student.prefix === 'ด.ญ.') updateData.prefix = 'น.ส.';
                    }
                } else if (transitionAction === 'graduate') {
                    updateData.currentStatus = 'graduated';
                    updateData.status = 'graduated';
                    updateData.classroomId = null;
                } else if (transitionAction === 'leave') {
                    updateData.currentStatus = 'left';
                    updateData.status = 'transferred';
                    updateData.classroomId = null;
                }

                updateData.classHistory = arrayUnion(historyPayload);
                batch.update(studentRef, updateData);

                // Create enrollment record if promoting
                if (transitionAction === 'promote' && targetClassroomId && targetClassData) {
                    const enrollmentRef = doc(collection(db, 'enrollments'));
                    batch.set(enrollmentRef, {
                        studentId: student.id,
                        classId: targetClassroomId,
                        className: targetClassData.className || '',
                        academicYearId: targetYear,
                        departmentId: targetClassData.departmentId || '',
                        gradeLevel: targetLevel,
                        semester: 1, // Default to semester 1 on promotion
                        status: 'studying',
                        enrolledAt: new Date().toISOString().slice(0, 10),
                    });
                }
            });

            if (sourceClassroomId) {
                batch.update(doc(db, 'classes', sourceClassroomId), { studentIds: arrayRemove(...studentIds) });
            }
            if (transitionAction === 'promote' && targetClassroomId) {
                batch.update(doc(db, 'classes', targetClassroomId), { studentIds: arrayUnion(...studentIds) });
            }

            await batch.commit();
            setStagedStudents([]);
            setSelectedStagedIds(new Set());
            if (transitionAction === 'leave') {
                await fetchLeftStudents();
            }
            alert('อัปเดตสถานะและเลื่อนชั้นเสร็จสมบูรณ์');
        } catch (error) {
            console.error('Error committing transition:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsCommitting(false);
        }
    };

    // --- Student Card (List Style — matches ClassroomAssignmentTab) ---
    const StudentCard = ({
        student, isSelected, onToggle, colorScheme = 'blue',
        isFirstInSelection = false, isLastInSelection = false
    }: {
        student: Student;
        isSelected: boolean;
        onToggle: () => void;
        colorScheme?: 'blue' | 'emerald';
        isFirstInSelection?: boolean;
        isLastInSelection?: boolean;
    }) => {
        const selectedBg = colorScheme === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600';
        const selectedBorder = colorScheme === 'emerald' ? 'border-emerald-400/30' : 'border-blue-400/30';

        return (
            <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onToggle}
                className={`group relative flex items-center transition-all cursor-pointer ${isSelected
                    ? `${selectedBg} text-white z-10 px-4 py-2 ${isFirstInSelection ? 'rounded-t-xl mt-1' : ''} ${isLastInSelection ? 'rounded-b-xl mb-1' : `border-b ${selectedBorder}`}`
                    : 'px-4 py-2 border-b border-slate-100/60 hover:bg-slate-50/50'
                    }`}
            >
                <div className="flex-1 grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 min-w-0 lg:grid-cols-[40px_1.5fr_1fr_40px] lg:gap-4">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0 transition-transform duration-300 ${isSelected ? 'scale-90' : 'group-hover:scale-105'}`}>
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    {/* Name */}
                    <div className="min-w-0">
                        <span className={`text-[12px] font-bold truncate tracking-tight block ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {student.prefix}{student.firstName} {student.lastName}
                        </span>
                    </div>
                    {/* Code */}
                    <div className="min-w-0">
                        <span className={`text-[10px] font-medium truncate tracking-tight uppercase ${isSelected ? 'text-blue-100/80' : 'text-slate-400'}`}>
                            {student.studentCode || 'N/A'}
                        </span>
                    </div>
                    {/* Status — desktop only */}
                    <div className={`hidden justify-end transition-colors lg:flex ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'}`}>
                        <MoreHorizontal size={14} />
                    </div>
                </div>
            </motion.div>
        );
    };

    const ProcessedStudentRow = ({ student }: { student: Student }) => (
        <div className="flex items-center gap-3 border-b border-slate-100/70 px-4 py-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                    alt="avatar"
                    className="h-full w-full object-cover"
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-slate-800">
                    {student.prefix}{student.firstName} {student.lastName}
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-400">
                    {student.studentCode || 'N/A'} · {student.gradeLevel || 'ไม่ระบุชั้น'}
                </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">
                ย้ายออก
            </span>
        </div>
    );


    return (
        <div className="relative flex flex-1 min-w-0 h-full flex-col overflow-hidden font-sukhumvit">

            <div className={cn(
                'relative z-10 flex min-h-0 flex-1 gap-3 lg:gap-4',
                isMdOrBelow && 'pb-[4.5rem]',
            )}>
                <>
                    {/* LEFT PANEL — Source Students */}
                    <div className={cn(
                        'min-w-0 flex-col rounded-[1.5rem] border border-white/30 bg-white/30 p-3 shadow-sm lg:rounded-[2rem] lg:p-4',
                        showSourcePanel ? 'flex flex-1' : 'hidden',
                        'lg:flex lg:max-w-[calc(50%-8px)] lg:flex-1',
                    )}>

                        {/* Title Section */}
                        <div className="mb-2 shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-blue-600 rounded-full" />
                                    ต้นทาง (Source)
                                </h3>
                                {isMdOrBelow && stagedStudents.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setMobileView('target')}
                                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700"
                                    >
                                        คิว {stagedStudents.length} คน →
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search bar */}
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-4.5 left-[14px] top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input
                                    type="text"
                                    placeholder="ค้นหา..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="h-8 w-full rounded-full border border-slate-200 bg-white/70 pl-9 pr-4 text-[11px] font-bold shadow-sm outline-none backdrop-blur-md transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 lg:h-9 lg:focus:ring-4"
                                />
                            </div>
                        </div>

                        {/* Filters Section */}
                        <div className="mb-3 shrink-0 lg:mb-4">
                            <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
                                <CapsuleSelect
                                    compact
                                    value={sourceYear}
                                    onChange={e => { setSourceYear(e); setSourceClassroomId(''); }}
                                    options={YEARS.map(y => ({ value: y, label: `ปี ${y}` }))}
                                    className="min-w-0"
                                />
                                <CapsuleSelect
                                    compact
                                    value={sourceDept}
                                    onChange={e => { setSourceDept(e); setSourceLevel(''); setSourceClassroomId(''); }}
                                    options={[
                                        { value: 'early', label: 'ปฐมวัย' },
                                        { value: 'primary', label: 'ประถมฯ' },
                                        { value: 'secondary', label: 'มัธยมฯ' },
                                    ]}
                                    placeholder="แผนก"
                                    className="min-w-0"
                                />
                                <CapsuleSelect
                                    compact
                                    value={sourceLevel}
                                    onChange={e => { setSourceLevel(e); setSourceClassroomId(''); }}
                                    options={sourceDept ? GRADE_ORDER[sourceDept].map(g => ({ value: g, label: g })) : []}
                                    placeholder="ชั้น"
                                    disabled={!sourceDept}
                                    className="min-w-0"
                                />
                                <CapsuleSelect
                                    compact
                                    value={sourceClassroomId}
                                    onChange={e => setSourceClassroomId(e)}
                                    options={sourceClassrooms.map(c => ({ value: c.id, label: c.className }))}
                                    placeholder="ห้อง"
                                    disabled={!sourceLevel}
                                    className="min-w-0"
                                />
                                <div className="col-span-2 flex justify-end lg:col-span-1 lg:ml-auto">
                                    <div className="flex items-center rounded-full border border-white bg-white/80 p-0.5 shadow-lg shadow-black/5 backdrop-blur-xl">
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => toggleAll(true)}
                                            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-700 transition-colors lg:h-7"
                                            title="เลือกทั้งหมด"
                                        >
                                            <CheckSquare size={13} />
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-slate-400 gap-3 py-20">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-xs font-bold tracking-wider uppercase">กำลังโหลดข้อมูล...</span>
                                </div>
                            ) : !sourceClassroomId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 gap-2 py-20">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                                        <Search size={28} className="text-slate-400" />
                                    </div>
                                    <span className="text-sm font-bold">เลือกห้องเรียนต้นทางก่อน</span>
                                </div>
                            ) : (
                                <div className="flex flex-col pb-24">
                                    <AnimatePresence>
                                        {filteredSourceStudents
                                            .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                            .map((student, index, arr) => {
                                                const isSelected = selectedSourceIds.has(student.id);
                                                const prevSelected = index > 0 && selectedSourceIds.has(arr[index - 1].id);
                                                const nextSelected = index < arr.length - 1 && selectedSourceIds.has(arr[index + 1].id);
                                                return (
                                                    <StudentCard
                                                        key={student.id}
                                                        student={student}
                                                        isSelected={isSelected}
                                                        onToggle={() => stageStudent(student.id)}
                                                        colorScheme="blue"
                                                        isFirstInSelection={isSelected && !prevSelected}
                                                        isLastInSelection={isSelected && !nextSelected}
                                                    />
                                                );
                                            })}
                                        {filteredSourceStudents.length === 0 && (
                                            <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-300 rounded-2xl">
                                                <CheckCircle2 size={22} className="mb-2" />
                                                <span className="text-xs font-bold">ไม่มีนักเรียน</span>
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL — Staged Students */}
                    <div className={cn(
                        'min-w-0 flex-col rounded-[1.5rem] border border-white/30 bg-white/30 p-3 shadow-sm lg:rounded-[2rem] lg:p-4',
                        showTargetPanel ? 'flex flex-1' : 'hidden',
                        'lg:flex lg:max-w-[calc(50%-8px)] lg:flex-1',
                    )}>

                        {/* Title and Filters Section */}
                        <div className="mb-3 shrink-0 space-y-2.5 lg:mb-4 lg:space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-emerald-600 rounded-full" />
                                    ปลายทาง (Target / Action)
                                </h3>
                            </div>

                            {/* Row 1: Action Selector */}
                            <div className="flex w-full items-center gap-2">
                                <div className="flex h-8 w-full items-center gap-0.5 rounded-full border border-black/[0.05] bg-white/40 p-0.5 backdrop-blur-md shadow-sm lg:h-9 lg:gap-1">
                                    {([
                                        { id: 'promote', label: 'เลื่อนชั้น', short: 'เลื่อน', icon: UserCheck },
                                        { id: 'graduate', label: 'จบการศึกษา', short: 'จบ', icon: GraduationCap },
                                        { id: 'leave', label: 'ย้ายออก', short: 'ออก', icon: LogOut },
                                    ] as { id: TransitionAction; label: string; short: string; icon: React.ElementType }[]).map(action => {
                                        const Icon = action.icon;
                                        const isActive = transitionAction === action.id;
                                        return (
                                            <button
                                                key={action.id}
                                                type="button"
                                                onClick={() => setTransitionAction(action.id)}
                                                className={cn(
                                                    'flex h-full flex-1 items-center justify-center gap-1 rounded-full px-1 text-[9px] font-black transition-all lg:gap-1.5 lg:px-3 lg:text-[10px]',
                                                    isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-black/55 hover:bg-black/[0.04] hover:text-black/70',
                                                )}
                                            >
                                                <Icon size={12} className="shrink-0 lg:hidden" />
                                                <Icon size={13} className="hidden shrink-0 lg:block" />
                                                <span className="lg:hidden">{action.short}</span>
                                                <span className="hidden lg:inline">{action.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Row 2: Filters and Select All */}
                            <div className="flex w-full items-center gap-1.5 lg:gap-2">
                                <AnimatePresence mode="popLayout">
                                    {transitionAction === 'promote' ? (
                                        <motion.div
                                            key="promote-filters"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:items-center lg:gap-2"
                                        >
                                            <CapsuleSelect
                                                compact
                                                value={targetYear}
                                                onChange={e => setTargetYear(e)}
                                                options={YEARS.map(y => ({ value: y, label: `ปี ${y}` }))}
                                                className="min-w-0"
                                            />
                                            <CapsuleSelect
                                                compact
                                                value={targetDept}
                                                onChange={e => { setTargetDept(e); setTargetLevel(''); setTargetClassroomId(''); }}
                                                options={[
                                                    { value: 'early', label: 'ปฐมวัย' },
                                                    { value: 'primary', label: 'ประถมฯ' },
                                                    { value: 'secondary', label: 'มัธยมฯ' },
                                                ]}
                                                placeholder="แผนก"
                                                className="min-w-0"
                                            />
                                            <CapsuleSelect
                                                compact
                                                value={targetLevel}
                                                onChange={e => { setTargetLevel(e); setTargetClassroomId(''); }}
                                                options={targetDept ? GRADE_ORDER[targetDept].map(g => ({ value: g, label: g })) : []}
                                                placeholder="ชั้น"
                                                disabled={!targetDept}
                                                className="min-w-0"
                                            />
                                            <CapsuleSelect
                                                compact
                                                value={targetClassroomId}
                                                disabled={!targetLevel}
                                                onChange={e => setTargetClassroomId(e)}
                                                options={targetClassrooms.map(c => ({ value: c.id, label: c.className }))}
                                                placeholder="ห้อง"
                                                className="min-w-0"
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="action-alert"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="flex h-8 flex-1 items-center gap-2 rounded-full border border-amber-200/50 bg-amber-50/80 px-3 backdrop-blur-md shadow-sm lg:h-9 lg:px-4"
                                        >
                                            <AlertCircle className="shrink-0 text-amber-600" size={12} />
                                            <p className="text-[9px] font-bold leading-none text-amber-700 lg:text-[10px]">
                                                สถานะจะเปลี่ยนเป็น <strong className="font-black text-amber-800">{transitionAction === 'graduate' ? 'จบการศึกษา' : 'ย้ายออก'}</strong>
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex shrink-0 items-center rounded-full border border-white bg-white/80 p-0.5 shadow-lg shadow-black/5 backdrop-blur-xl">
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleAll(false)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-700 transition-colors"
                                        title="เลือกทั้งหมด"
                                    >
                                        <CheckSquare size={13} />
                                    </motion.button>
                                </div>
                            </div>
                        </div>



                        {/* Staged Students List */}
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-1 scrollbar-hide">
                            {stagedStudents.length === 0 && transitionAction !== 'leave' ? (
                                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200/60 py-20 text-slate-400 opacity-50">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
                                        <UserCheck size={28} className="text-slate-400" />
                                    </div>
                                    <span className="text-sm font-bold">รอประมวลผล</span>
                                    <span className="px-4 text-center text-[11px] font-medium text-slate-400">
                                        {isMdOrBelow ? 'แตะรายชื่อในแท็บต้นทางเพื่อย้ายมาคิว' : 'คลิกรายชื่อด้านซ้ายเพื่อย้ายมาคิว'}
                                    </span>
                                    {isMdOrBelow && (
                                        <button
                                            type="button"
                                            onClick={() => setMobileView('source')}
                                            className="mt-2 rounded-full bg-blue-600 px-4 py-1.5 text-[10px] font-black text-white shadow-sm"
                                        >
                                            ไปเลือกนักเรียน
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {stagedStudents.length > 0 && (
                                        <div className="mb-3 flex flex-col pb-2">
                                            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                                                คิวรอประมวลผล · {stagedStudents.length} คน
                                            </p>
                                            <AnimatePresence>
                                                {stagedStudents
                                                    .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                                    .map((student, index, arr) => {
                                                        const isSelected = selectedStagedIds.has(student.id);
                                                        const prevSelected = index > 0 && selectedStagedIds.has(arr[index - 1].id);
                                                        const nextSelected = index < arr.length - 1 && selectedStagedIds.has(arr[index + 1].id);
                                                        return (
                                                            <StudentCard
                                                                key={student.id}
                                                                student={student}
                                                                isSelected={isSelected}
                                                                onToggle={() => unstageStudent(student.id)}
                                                                colorScheme="emerald"
                                                                isFirstInSelection={isSelected && !prevSelected}
                                                                isLastInSelection={isSelected && !nextSelected}
                                                            />
                                                        );
                                                    })}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {transitionAction === 'leave' && (
                                        <div className={cn('flex min-h-0 flex-col', stagedStudents.length > 0 ? 'border-t border-slate-200/70 pt-3' : 'flex-1')}>
                                            <div className="mb-2 flex items-center justify-between px-1">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                                                    รายชื่อนักเรียนที่ย้ายออกแล้ว
                                                </p>
                                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                                    {filteredLeftStudents.length} คน
                                                </span>
                                            </div>

                                            {loadingLeftStudents ? (
                                                <div className="flex flex-1 items-center justify-center py-10 text-slate-400">
                                                    <Loader2 size={20} className="animate-spin" />
                                                </div>
                                            ) : filteredLeftStudents.length === 0 ? (
                                                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/40 px-4 py-12 text-center">
                                                    <LogOut size={24} className="mb-2 text-amber-300" />
                                                    <p className="text-sm font-bold text-slate-500">ยังไม่มีรายชื่อย้ายออก</p>
                                                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                                                        {sourceLevel ? `ในชั้น ${sourceLevel}` : 'เลือกชั้นเรียนที่ต้นทางเพื่อกรองรายชื่อ'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden rounded-2xl border border-amber-100/80 bg-white/55">
                                                    {filteredLeftStudents.map((student) => (
                                                        <ProcessedStudentRow key={student.id} student={student} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {transitionAction !== 'leave' && stagedStudents.length === 0 && (
                                        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200/60 py-20 text-slate-400 opacity-50">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
                                                <UserCheck size={28} className="text-slate-400" />
                                            </div>
                                            <span className="text-sm font-bold">รอประมวลผล</span>
                                            <span className="px-4 text-center text-[11px] font-medium text-slate-400">
                                                {isMdOrBelow ? 'แตะรายชื่อในแท็บต้นทางเพื่อย้ายมาคิว' : 'คลิกรายชื่อด้านซ้ายเพื่อย้ายมาคิว'}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            </div>

            {/* ── Mobile bottom navigation ── */}
            {isMdOrBelow && (
                <div className="fixed inset-x-3 bottom-[max(4.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
                    <div className="flex items-center gap-1 rounded-2xl border border-white/80 bg-white/90 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                        {([
                            { id: 'source' as const, label: 'ต้นทาง', count: filteredSourceStudents.length, icon: Search },
                            { id: 'target' as const, label: 'คิวดำเนินการ', count: stagedStudents.length, icon: UserCheck },
                        ]).map((tab) => {
                            const Icon = tab.icon;
                            const isActive = mobileView === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setMobileView(tab.id)}
                                    className={cn(
                                        'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all',
                                        isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50',
                                    )}
                                >
                                    <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                                    <span className="text-[10px] font-black leading-none">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={cn(
                                            'absolute right-3 top-1.5 min-w-[16px] rounded-full px-1 text-center text-[8px] font-black leading-4',
                                            isActive ? 'bg-white/20 text-white' : tab.id === 'target' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-600',
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

            {/* Bottom Action Bar — appears when students selected in source */}
            <AnimatePresence>
                {selectedSourceIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-[max(7.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-white bg-white/80 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:absolute lg:bottom-6 lg:mb-[max(0px,env(safe-area-inset-bottom))] lg:max-w-none lg:flex-nowrap lg:gap-4 lg:px-4 lg:scale-100"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white">
                                {selectedSourceIds.size}
                            </div>
                            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">รายการที่เลือก</span>
                        </div>

                        <div className="w-[1px] h-4 bg-slate-200" />

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={stageSelectedStudents}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <ArrowRight size={12} />
                            ย้ายมาคิว ({selectedSourceIds.size})
                        </motion.button>

                        <button
                            onClick={() => setSelectedSourceIds(new Set())}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Commit Bar — appears when staged students exist */}
            <AnimatePresence>
                {stagedStudents.length > 0 && selectedSourceIds.size === 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-[max(7.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-white bg-white/80 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:absolute lg:bottom-6 lg:mb-[max(0px,env(safe-area-inset-bottom))] lg:max-w-none lg:flex-nowrap lg:gap-4 lg:px-4 lg:scale-100"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-500 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white">
                                {stagedStudents.length}
                            </div>
                            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">รอประมวลผล</span>
                        </div>

                        <div className="w-[1px] h-4 bg-slate-200" />

                        {selectedStagedIds.size > 0 && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={unstageSelected}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight flex items-center gap-2 transition-all"
                            >
                                <X size={12} />
                                ถอดออก ({selectedStagedIds.size})
                            </motion.button>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isCommitting}
                            onClick={commitTransition}
                            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20"
                        >
                            {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
                            ยืนยัน
                        </motion.button>

                        <button
                            onClick={() => { setStagedStudents([]); setSelectedStagedIds(new Set()); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
