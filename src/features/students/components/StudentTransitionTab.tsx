import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, CheckSquare, LogOut,
    UserCheck, AlertCircle, Loader2, Search,
    CheckCircle2, X, Settings
} from 'lucide-react';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import StudentAvatar from '@/features/students/components/StudentAvatar';

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[12px] font-black text-slate-700 font-sukhumvit whitespace-nowrap';

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
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger
                className={cn(
                    'w-full rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black text-black/70 backdrop-blur-md shadow-sm transition-all',
                    compact ? 'h-7' : 'h-9',
                    !disabled && 'hover:bg-white/60',
                    className,
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
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
    photoURL?: string;
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
    departmentId?: string;
    studentIds?: string[];
    track?: string;
}

type TransitionAction = 'promote' | 'graduate' | 'leave';

const YEARS = ['2565', '2566', '2567', '2568', '2569', '2570'];

interface StudentTransitionTabProps {
    sourceYear: string;
    sourceLevel: string;
    sourceClassroomId: string;
    transitionAction: TransitionAction;
    onTransitionActionChange: (action: TransitionAction) => void;
}

export default function StudentTransitionTab({
    sourceYear,
    sourceLevel,
    sourceClassroomId,
    transitionAction,
    onTransitionActionChange,
}: StudentTransitionTabProps) {
    // --- Target State ---
    const [targetYear, setTargetYear] = useState<string>('2569');
    const [targetDept, setTargetDept] = useState<string>('');
    const [targetLevel, setTargetLevel] = useState<string>('');
    const [targetClassroomId, setTargetClassroomId] = useState<string>('');

    // --- Data State ---
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

    // --- Fetch Source Students (เฉพาะห้องที่เลือก) ---
    useEffect(() => {
        const fetchSourceStudents = async () => {
            if (!sourceClassroomId) {
                setSourceStudents([]);
                setSelectedSourceIds(new Set());
                return;
            }
            setLoading(true);
            try {
                const stSnapshot = await getDocs(collection(db, 'students'));
                let stData = stSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
                stData = stData.filter(s => s.classroomId === sourceClassroomId && (s.currentStatus === 'active' || !s.currentStatus));
                stData = stData.filter(s => !stagedStudents.find(st => st.id === s.id));
                setSourceStudents(stData);
                setSelectedSourceIds(new Set());
            } catch (error) {
                console.error('Error fetching source students:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSourceStudents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceClassroomId]);

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

    // --- Student Card (mobile cards / desktop table rows) ---
    const StudentCard = ({
        student, isSelected, onToggle, colorScheme = 'blue', index = 0,
    }: {
        student: Student;
        isSelected: boolean;
        onToggle: () => void;
        colorScheme?: 'blue' | 'emerald';
        index?: number;
    }) => {
        const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();

        if (isMdOrBelow) {
            return (
                <motion.div
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={onToggle}
                    className={cn(
                        'cursor-pointer rounded-2xl border border-border bg-card p-3 transition-colors active:scale-[0.99]',
                        isSelected
                            ? colorScheme === 'emerald'
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-blue-200 bg-blue-50'
                            : 'hover:bg-muted/40',
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
                        <div className="flex shrink-0 items-center justify-center">
                            {colorScheme === 'emerald' ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle();
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive"
                                    title="ถอดออกจากคิว"
                                    aria-label="ถอดออกจากคิว"
                                >
                                    <X size={14} />
                                </button>
                            ) : isSelected ? (
                                <CheckCircle2 size={16} className="text-blue-600" />
                            ) : null}
                        </div>
                    </div>
                </motion.div>
            );
        }

        return (
            <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onToggle}
                className={cn(
                    "grid items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors",
                    isSelected
                        ? colorScheme === 'emerald'
                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-950"
                            : "bg-blue-50 hover:bg-blue-100 text-blue-950"
                        : "hover:bg-muted/40 text-slate-700"
                )}
                style={{ gridTemplateColumns: 'minmax(4.5rem, 0.8fr) minmax(0, 2fr) 2rem' }}
            >
                <span className={cn(
                    "truncate text-[13px] font-black font-sukhumvit tabular-nums",
                    isSelected ? (colorScheme === 'emerald' ? 'text-emerald-700' : 'text-blue-700') : 'text-slate-500'
                )}>
                    {student.studentCode || '—'}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar
                        photoURL={student.photoURL}
                        studentId={student.id}
                        name={fullName}
                        className="h-9 w-9 shrink-0 rounded-full"
                    />
                    <span className="truncate text-[13px] font-bold font-sukhumvit">
                        {fullName}
                    </span>
                </div>

                <div className="flex justify-center shrink-0">
                    {colorScheme === 'emerald' ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="ถอดออกจากคิว"
                        >
                            <X size={14} />
                        </button>
                    ) : (
                        isSelected && (
                            <CheckCircle2 size={13} className="text-blue-600" />
                        )
                    )}
                </div>
            </motion.div>
        );
    };

    const ProcessedStudentRow = ({ student, index = 0 }: { student: Student; index?: number }) => {
        const fullName = `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim();

        if (isMdOrBelow) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="rounded-2xl border border-border bg-card p-3"
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
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 font-sukhumvit">
                            ย้ายออก
                        </span>
                    </div>
                </motion.div>
            );
        }

        return (
            <div
                className="grid items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-b-0 text-slate-700 hover:bg-muted/40 transition-colors"
                style={{ gridTemplateColumns: 'minmax(4.5rem, 0.8fr) minmax(0, 2fr) 4.5rem' }}
            >
                <span className="truncate text-[13px] font-black font-sukhumvit text-slate-500 tabular-nums">
                    {student.studentCode || '—'}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar
                        photoURL={student.photoURL}
                        studentId={student.id}
                        name={fullName}
                        className="h-9 w-9 shrink-0 rounded-full"
                    />
                    <span className="truncate text-[13px] font-bold font-sukhumvit text-slate-800">
                        {fullName}
                    </span>
                </div>
                <div className="flex justify-center shrink-0">
                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">
                        ย้ายออก
                    </span>
                </div>
            </div>
        );
    };

    const MobileListToolbar = ({
        onSelectAll,
        selectAllTitle,
    }: {
        onSelectAll: () => void;
        selectAllTitle: string;
    }) => (
        <div className="mb-1 flex items-center justify-between px-0.5 lg:hidden">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                รายชื่อนักเรียน
            </span>
            <button
                type="button"
                onClick={onSelectAll}
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-black text-muted-foreground transition-colors hover:bg-muted/60"
                title={selectAllTitle}
            >
                <CheckSquare size={13} />
                เลือกทั้งหมด
            </button>
        </div>
    );


    return (
        <div className="relative flex flex-1 min-w-0 h-full flex-col overflow-hidden font-sukhumvit pt-3">

            {/* ── Tab bar: เลื่อนชั้น | จบการศึกษา | ย้ายออก ── */}
            <div className="mb-4 shrink-0 border-b border-slate-200/80 px-2">
                <div className="flex w-full items-center gap-0 lg:gap-6">
                    {([
                        { id: 'promote', label: 'เลื่อนชั้น' },
                        { id: 'graduate', label: 'จบการศึกษา' },
                        { id: 'leave', label: 'ย้ายออก' },
                    ] as { id: TransitionAction; label: string }[]).map(action => {
                        const isActive = transitionAction === action.id;
                        return (
                            <button
                                key={action.id}
                                type="button"
                                onClick={() => onTransitionActionChange(action.id)}
                                className={cn(
                                    'relative flex-1 pb-2.5 text-center text-[12px] font-bold transition-all cursor-pointer lg:flex-none lg:text-left',
                                    isActive
                                        ? 'text-blue-600 font-black after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-blue-600 after:rounded-full'
                                        : 'text-slate-400 hover:text-slate-700',
                                )}
                            >
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 gap-3 lg:gap-4">
                <>
                    {/* Source Students */}
                    <div className={cn(
                        'min-w-0 flex-col px-2',
                        showSourcePanel ? 'flex flex-1' : 'hidden',
                        'lg:flex lg:max-w-[calc(50%-8px)] lg:flex-1',
                    )}>

                        {/* Title and Search Section (Same Line) */}
                        <div className="flex h-9 items-center justify-between gap-3 mb-3 shrink-0">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                ต้นทาง (Source)
                            </h3>
                            <div className="flex items-center gap-2 flex-1 max-w-md justify-end min-w-0">
                                <div className="relative flex-1 min-w-0 max-w-xs">
                                    <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                    <input
                                        type="text"
                                        placeholder="ค้นหา..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-8 w-full rounded-full border border-slate-200 bg-white/70 pl-9 pr-4 text-[11px] font-bold outline-none backdrop-blur-md transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 lg:h-9 lg:focus:ring-4"
                                    />
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
                                <div className={cn(
                                    'flex min-h-0 flex-1 flex-col mb-4',
                                    isMdOrBelow ? 'gap-2.5' : TABLE_SHELL,
                                )}>
                                    {!isMdOrBelow ? (
                                        <div className="border-b border-border bg-slate-100/90 shrink-0">
                                            <div className="grid gap-3 px-4 py-1.5 items-center" style={{ gridTemplateColumns: 'minmax(4.5rem, 0.8fr) minmax(0, 2fr) 2rem' }}>
                                                <span className={TABLE_HEADER_CELL}>รหัส</span>
                                                <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                                                <div className="flex justify-center shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAll(true)}
                                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                                                        title="เลือกทั้งหมด"
                                                    >
                                                        <CheckSquare size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <MobileListToolbar
                                            onSelectAll={() => toggleAll(true)}
                                            selectAllTitle="เลือกทั้งหมด"
                                        />
                                    )}
                                    <div className={cn(
                                        'flex flex-1 flex-col overflow-y-auto scrollbar-hide',
                                        isMdOrBelow && 'gap-2.5',
                                    )}>
                                        <AnimatePresence>
                                            {filteredSourceStudents
                                                .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                                .map((student, i) => {
                                                    const isSelected = selectedSourceIds.has(student.id);
                                                    return (
                                                        <StudentCard
                                                            key={student.id}
                                                            student={student}
                                                            isSelected={isSelected}
                                                            onToggle={() => stageStudent(student.id)}
                                                            colorScheme="blue"
                                                            index={i}
                                                        />
                                                    );
                                                })}
                                            {filteredSourceStudents.length === 0 && (
                                                <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 rounded-2xl m-3">
                                                    <CheckCircle2 size={22} className="mb-2" />
                                                    <span className="text-xs font-bold">ไม่มีนักเรียน</span>
                                                </div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL — Staged Students */}
                    <div className={cn(
                        'min-w-0 flex-col px-2',
                        showTargetPanel ? 'flex flex-1' : 'hidden',
                        'lg:flex lg:max-w-[calc(50%-8px)] lg:flex-1',
                    )}>

                        {/* Title and Filters Section (Same Line) */}
                        <div className="flex h-9 items-center justify-between gap-3 mb-3 shrink-0">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                ปลายทาง (Target)
                            </h3>

                            {/* Filters and Select All */}
                            <div className="flex items-center gap-2 flex-1 max-w-md justify-end min-w-0">
                                {transitionAction === 'promote' ? (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className={HEADER_ICON_BTN}
                                                title="ตั้งค่าปลายทาง"
                                            >
                                                <Settings size={16} className="text-slate-800" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-4 flex flex-col gap-3 font-sukhumvit rounded-2xl bg-white shadow-xl border border-slate-100" align="end">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">ปีการศึกษา</span>
                                                <CapsuleSelect
                                                    value={targetYear}
                                                    onChange={e => setTargetYear(e)}
                                                    options={YEARS.map(y => ({ value: y, label: `ปี ${y}` }))}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">แผนก</span>
                                                <CapsuleSelect
                                                    value={targetDept}
                                                    onChange={e => { setTargetDept(e); setTargetLevel(''); setTargetClassroomId(''); }}
                                                    options={[
                                                        { value: 'early', label: 'ปฐมวัย' },
                                                        { value: 'primary', label: 'ประถมฯ' },
                                                        { value: 'secondary', label: 'มัธยมฯ' },
                                                    ]}
                                                    placeholder="เลือกแผนก"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">ชั้นเรียน</span>
                                                <CapsuleSelect
                                                    value={targetLevel}
                                                    onChange={e => { setTargetLevel(e); setTargetClassroomId(''); }}
                                                    options={targetDept ? GRADE_ORDER[targetDept].map(g => ({ value: g, label: g })) : []}
                                                    placeholder="เลือกชั้นเรียน"
                                                    disabled={!targetDept}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">ห้องเรียน</span>
                                                <CapsuleSelect
                                                    value={targetClassroomId}
                                                    disabled={!targetLevel}
                                                    onChange={e => setTargetClassroomId(e)}
                                                    options={targetClassrooms.map(c => ({ value: c.id, label: c.className }))}
                                                    placeholder="เลือกห้องเรียน"
                                                />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                ) : (
                                    <div className="flex h-9 items-center gap-1.5 px-1 shrink-0">
                                        <AlertCircle className="shrink-0 text-rose-500 animate-pulse" size={13} />
                                        <p className="text-[10px] font-black text-rose-600 font-sukhumvit">
                                            สถานะ {transitionAction === 'graduate' ? 'จบการศึกษา' : 'ย้ายออก'}
                                        </p>
                                    </div>
                                )}
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
                                        <div className={cn(
                                            'flex min-h-0 flex-1 flex-col mb-4',
                                            isMdOrBelow ? 'gap-2.5' : TABLE_SHELL,
                                        )}>
                                            {!isMdOrBelow ? (
                                                <div className="border-b border-border bg-slate-100/90 shrink-0">
                                                    <div className="grid gap-3 px-4 py-1.5 items-center" style={{ gridTemplateColumns: 'minmax(4.5rem, 0.8fr) minmax(0, 2fr) 2rem' }}>
                                                        <span className={TABLE_HEADER_CELL}>รหัส</span>
                                                        <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                                                        <div className="flex justify-center shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAll(false)}
                                                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                                                                title="เลือกทั้งหมด"
                                                            >
                                                                <CheckSquare size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <MobileListToolbar
                                                    onSelectAll={() => toggleAll(false)}
                                                    selectAllTitle="เลือกทั้งหมดในคิว"
                                                />
                                            )}
                                            <div className={cn(
                                                'flex flex-1 flex-col overflow-y-auto scrollbar-hide',
                                                isMdOrBelow && 'gap-2.5',
                                            )}>
                                                <AnimatePresence>
                                                    {stagedStudents
                                                        .sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true }) || a.firstName.localeCompare(b.firstName))
                                                        .map((student, i) => {
                                                            const isSelected = selectedStagedIds.has(student.id);
                                                            return (
                                                                <StudentCard
                                                                    key={student.id}
                                                                    student={student}
                                                                    isSelected={isSelected}
                                                                    onToggle={() => unstageStudent(student.id)}
                                                                    colorScheme="emerald"
                                                                    index={i}
                                                                />
                                                            );
                                                        })}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    )}

                                    {transitionAction === 'leave' && stagedStudents.length === 0 && (
                                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
                                            {loadingLeftStudents ? (
                                                <div className="flex flex-1 items-center justify-center py-10 text-slate-400">
                                                    <Loader2 size={20} className="animate-spin" />
                                                </div>
                                            ) : filteredLeftStudents.length === 0 ? (
                                                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/60 py-20 text-slate-400 opacity-50">
                                                    <LogOut size={28} className="mb-2 text-slate-300" />
                                                    <p className="text-sm font-bold">ยังไม่มีรายชื่อย้ายออก</p>
                                                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                                                        {sourceLevel ? `ในชั้น ${sourceLevel}` : 'เลือกชั้นเรียนที่ต้นทางเพื่อกรองรายชื่อ'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    'flex min-h-0 flex-1 flex-col mb-4',
                                                    isMdOrBelow ? 'gap-2.5' : TABLE_SHELL,
                                                )}>
                                                    {!isMdOrBelow && (
                                                        <div className="border-b border-border bg-slate-100/90 shrink-0">
                                                            <div className="grid gap-3 px-4 py-1.5 items-center" style={{ gridTemplateColumns: 'minmax(4.5rem, 0.8fr) minmax(0, 2fr) 4.5rem' }}>
                                                                <span className={TABLE_HEADER_CELL}>รหัส</span>
                                                                <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                                                                <div className="flex h-6 items-center justify-center shrink-0">
                                                                    <span className={cn(TABLE_HEADER_CELL, "text-center whitespace-nowrap")}>สถานะ</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className={cn(
                                                        'flex flex-1 flex-col overflow-y-auto scrollbar-hide',
                                                        isMdOrBelow && 'gap-2.5',
                                                    )}>
                                                        {filteredLeftStudents.map((student, i) => (
                                                            <ProcessedStudentRow key={student.id} student={student} index={i} />
                                                        ))}
                                                    </div>
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

            {/* ── Mobile footer: action bars + source/target tabs ── */}
            {isMdOrBelow && (
                <div className="shrink-0 bg-transparent lg:hidden">
                    <AnimatePresence>
                        {selectedSourceIds.size > 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mx-2 mb-1.5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                                            {selectedSourceIds.size}
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            รายการที่เลือก
                                        </span>
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={stageSelectedStudents}
                                        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-tight text-white shadow-lg shadow-blue-600/20"
                                    >
                                        <ArrowRight size={12} />
                                        ย้ายมาคิว ({selectedSourceIds.size})
                                    </motion.button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSourceIds(new Set())}
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
                                        aria-label="ล้างการเลือก"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {stagedStudents.length > 0 && selectedSourceIds.size === 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mx-2 mb-1.5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                                            {stagedStudents.length}
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            รอประมวลผล
                                        </span>
                                    </div>
                                    {selectedStagedIds.size > 0 && (
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            type="button"
                                            onClick={unstageSelected}
                                            className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-[11px] font-black uppercase tracking-tight text-secondary-foreground"
                                        >
                                            <X size={12} />
                                            ถอดออก ({selectedStagedIds.size})
                                        </motion.button>
                                    )}
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        disabled={isCommitting}
                                        onClick={commitTransition}
                                        className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-[11px] font-black uppercase tracking-tight text-primary-foreground shadow-lg disabled:opacity-50"
                                    >
                                        {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
                                        ยืนยัน
                                    </motion.button>
                                    <button
                                        type="button"
                                        onClick={() => { setStagedStudents([]); setSelectedStagedIds(new Set()); }}
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
                                        aria-label="ล้างคิว"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mb-[max(0.25rem,env(safe-area-inset-bottom))] flex w-full items-stretch gap-1 px-2 pt-1.5">
                        {([
                            { id: 'source' as const, label: 'ต้นทาง', icon: Search },
                            { id: 'target' as const, label: 'คิวดำเนินการ', icon: UserCheck },
                        ]).map((tab) => {
                            const Icon = tab.icon;
                            const isActive = mobileView === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setMobileView(tab.id)}
                                    className={cn(
                                        'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 transition-all',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted/40',
                                    )}
                                >
                                    <Icon size={14} className={isActive ? 'text-primary-foreground' : 'text-muted-foreground'} />
                                    <span className="text-[10px] font-black leading-none">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Bottom Action Bar — desktop only */}
            <AnimatePresence>
                {selectedSourceIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 left-1/2 z-50 hidden max-w-none -translate-x-1/2 flex-nowrap items-center justify-center gap-4 rounded-full border border-white bg-white/80 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:flex lg:mb-[max(0px,env(safe-area-inset-bottom))]"
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

            {/* Bottom Commit Bar — desktop only */}
            <AnimatePresence>
                {stagedStudents.length > 0 && selectedSourceIds.size === 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 left-1/2 z-50 hidden max-w-none -translate-x-1/2 flex-nowrap items-center justify-center gap-4 rounded-full border border-white bg-white/80 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:flex lg:mb-[max(0px,env(safe-area-inset-bottom))]"
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
