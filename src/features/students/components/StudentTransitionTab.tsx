import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, CheckSquare, GraduationCap, LogOut,
    UserCheck, AlertCircle, Loader2, Search, MoreHorizontal,
    CheckCircle2, X, ListFilter
} from 'lucide-react';
import { collection, doc, writeBatch, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
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
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    classroomId: string | null;
    currentStatus: 'active' | 'graduated' | 'left';
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

    const [loading, setLoading] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    // --- Selection State ---
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
    const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

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
    const stageSelectedStudents = () => {
        const toMove = sourceStudents.filter(s => selectedSourceIds.has(s.id));
        setStagedStudents(prev => [...prev, ...toMove]);
        setSourceStudents(prev => prev.filter(s => !selectedSourceIds.has(s.id)));
        setSelectedSourceIds(new Set());
    };

    const unstageSelected = () => {
        const toReturn = stagedStudents.filter(s => selectedStagedIds.has(s.id));
        setSourceStudents(prev => [...prev, ...toReturn]);
        setStagedStudents(prev => prev.filter(s => !selectedStagedIds.has(s.id)));
        setSelectedStagedIds(new Set());
    };

    const toggleSelection = (id: string, isSource: boolean) => {
        const set = isSource ? new Set(selectedSourceIds) : new Set(selectedStagedIds);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        isSource ? setSelectedSourceIds(set) : setSelectedStagedIds(set);
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
                    updateData.classroomId = null;
                } else if (transitionAction === 'leave') {
                    updateData.currentStatus = 'left';
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
                <div className="flex-1 grid grid-cols-[40px_1.5fr_1fr_40px] items-center gap-4 min-w-0">
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
                    <div className="min-w-0 hidden sm:block">
                        <span className={`text-[10px] font-medium truncate tracking-tight uppercase ${isSelected ? 'text-blue-100/80' : 'text-slate-400'}`}>
                            {student.studentCode || 'N/A'}
                        </span>
                    </div>
                    {/* Status */}
                    <div className={`flex justify-end transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'}`}>
                        <MoreHorizontal size={14} />
                    </div>
                </div>
            </motion.div>
        );
    };

    const sourceClassroomName = sourceClassrooms.find(c => c.id === sourceClassroomId)?.className || '';

    return (
        <div className="min-h-full w-full p-0 pb-6 lg:pb-8 font-sukhumvit relative overflow-hidden flex flex-col">

            <div className="flex-1 min-h-0 relative z-10 flex gap-0">
                {loading && !sourceClassroomId ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="font-bold tracking-wider uppercase">Loading Data...</span>
                    </div>
                ) : (<>

                    {/* LEFT PANEL — Source Students */}
                    <div className="flex-1 min-w-0 flex flex-col pr-4">

                        {/* Apple Music style header */}
                        <div className="flex flex-col md:flex-row gap-8 p-2 shrink-0 items-start mb-8">
                            {/* Album Art */}
                            <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-[0_8px_25px_-10px_rgba(0,0,0,0.25)] shrink-0 group relative flex flex-col font-sukhumvit transition-all duration-500 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1">
                                <div className="h-[60%] bg-[#cce5ff] p-4 flex items-end">
                                    <span className="text-[28px] md:text-[34px] font-black text-[#003580] tracking-tight leading-none">
                                        Transition
                                    </span>
                                </div>
                                <div className="h-[40%] bg-[#1971c2] p-4 flex items-start justify-start">
                                    <span className="text-[64px] md:text-[84px] font-black text-[#cce5ff] tracking-tighter leading-[0.8] select-none">
                                        {(parseInt(sourceYear) - 543).toString().slice(-2)}s
                                    </span>
                                </div>
                                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                            </div>

                            {/* Info & Source Filters */}
                            <div className="flex flex-col h-48 md:h-56 justify-between py-1">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight mb-1">
                                        เลื่อนชั้น / เปลี่ยนสถานะ
                                    </h2>
                                    <p className="text-lg font-bold text-blue-600 mb-2">
                                        ปีการศึกษาต้นทาง {sourceYear}
                                    </p>
                                    <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest opacity-60">
                                        {sourceClassroomName ? `ห้อง ${sourceClassroomName}` : 'เลือกห้องเรียนต้นทาง'}
                                    </p>
                                </div>

                                {/* Cascading Source Filters */}
                                <div className="flex items-center bg-[#f2f2f7] rounded-full p-1 overflow-hidden w-fit">
                                    {/* Year */}
                                    <div className="relative group/filter">
                                        <select
                                            value={sourceYear}
                                            onChange={e => { setSourceYear(e.target.value); setSourceClassroomId(''); }}
                                            className="appearance-none pl-6 pr-10 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[13px] outline-none cursor-pointer border-r border-slate-200"
                                        >
                                            {YEARS.map(y => <option key={y} value={y}>ปี {y}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                            <ListFilter size={13} />
                                        </div>
                                    </div>
                                    {/* Department */}
                                    <div className="relative group/filter">
                                        <select
                                            value={sourceDept}
                                            onChange={e => { setSourceDept(e.target.value); setSourceLevel(''); setSourceClassroomId(''); }}
                                            className="appearance-none pl-6 pr-10 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[13px] outline-none cursor-pointer border-r border-slate-200"
                                        >
                                            <option value="">แผนก</option>
                                            <option value="early">ปฐมวัย</option>
                                            <option value="primary">ประถมฯ</option>
                                            <option value="secondary">มัธยมฯ</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                            <ListFilter size={13} />
                                        </div>
                                    </div>
                                    {/* Grade Level */}
                                    <div className="relative group/filter">
                                        <select
                                            value={sourceLevel}
                                            disabled={!sourceDept}
                                            onChange={e => { setSourceLevel(e.target.value); setSourceClassroomId(''); }}
                                            className="appearance-none pl-6 pr-10 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[13px] outline-none cursor-pointer border-r border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <option value="">ชั้น</option>
                                            {sourceDept && GRADE_ORDER[sourceDept]?.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                            <ListFilter size={13} />
                                        </div>
                                    </div>
                                    {/* Classroom */}
                                    <div className="relative group/filter">
                                        <select
                                            value={sourceClassroomId}
                                            disabled={!sourceLevel}
                                            onChange={e => setSourceClassroomId(e.target.value)}
                                            className="appearance-none pl-6 pr-10 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[13px] outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <option value="">-- เลือกห้อง --</option>
                                            {sourceClassrooms.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                            <ListFilter size={13} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100/80 mb-6" />

                        {/* Search + Select All bar */}
                        <div className="flex items-center gap-2 mb-3 shrink-0">
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
                            <div className="flex items-center bg-white/80 backdrop-blur-xl border border-white shadow-lg shadow-black/5 rounded-full p-0.5 shrink-0">
                                <motion.button
                                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleAll(true)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-700 transition-colors"
                                    title="เลือกทั้งหมด"
                                >
                                    <CheckSquare size={14} />
                                </motion.button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100/80 mb-2" />

                        {/* Student List */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1 pb-24">
                            {!sourceClassroomId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 gap-2 py-20">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                                        <Search size={28} className="text-slate-400" />
                                    </div>
                                    <span className="text-sm font-bold">เลือกห้องเรียนต้นทางก่อน</span>
                                </div>
                            ) : (
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
                                                    onToggle={() => toggleSelection(student.id, true)}
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
                            )}
                        </div>
                    </div>

                    {/* DIVIDER */}
                    <div className="w-px bg-slate-200/80 shrink-0 self-stretch" />

                    {/* RIGHT PANEL — Staging & Target Config */}
                    <div className="w-[20%] lg:w-[250px] xl:w-[320px] shrink-0 flex flex-col pl-4 pt-1">

                        {/* Action Selector */}
                        <div className="flex gap-1 p-1 bg-[#f2f2f7] rounded-2xl mb-3">
                            {([
                                { id: 'promote', label: 'เลื่อนชั้น', icon: UserCheck },
                                { id: 'graduate', label: 'จบการศึกษา', icon: GraduationCap },
                                { id: 'leave', label: 'ย้ายออก', icon: LogOut },
                            ] as { id: TransitionAction; label: string; icon: React.ElementType }[]).map(action => {
                                const Icon = action.icon;
                                const isActive = transitionAction === action.id;
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => setTransitionAction(action.id)}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all ${isActive ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-white/40'}`}
                                    >
                                        <Icon size={13} />
                                        <span className="hidden lg:inline">{action.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Target Config (promote only) */}
                        {transitionAction === 'promote' && (
                            <AnimatePresence>
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex flex-col gap-2 mb-4"
                                >
                                    {/* Row 1: Year, Dept, Level */}
                                    <div className="flex items-center bg-[#f2f2f7] rounded-full p-1 overflow-x-auto scrollbar-hide">
                                        <div className="relative shrink-0 group/filter">
                                            <select
                                                value={targetYear}
                                                onChange={e => setTargetYear(e.target.value)}
                                                className="appearance-none pl-6 pr-8 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer border-r border-slate-200"
                                            >
                                                {YEARS.map(y => <option key={y} value={y}>ปี {y}</option>)}
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                                <ListFilter size={11} />
                                            </div>
                                        </div>
                                        <div className="relative shrink-0 group/filter">
                                            <select
                                                value={targetDept}
                                                onChange={e => { setTargetDept(e.target.value); setTargetLevel(''); setTargetClassroomId(''); }}
                                                className="appearance-none pl-6 pr-8 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer border-r border-slate-200"
                                            >
                                                <option value="">แผนก</option>
                                                <option value="early">ปฐมวัย</option>
                                                <option value="primary">ประถมฯ</option>
                                                <option value="secondary">มัธยมฯ</option>
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                                <ListFilter size={11} />
                                            </div>
                                        </div>
                                        <div className="relative shrink-0 group/filter">
                                            <select
                                                value={targetLevel}
                                                disabled={!targetDept}
                                                onChange={e => { setTargetLevel(e.target.value); setTargetClassroomId(''); }}
                                                className="appearance-none pl-6 pr-8 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <option value="" disabled>ชั้น</option>
                                                {targetDept && GRADE_ORDER[targetDept]?.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                                                <ListFilter size={11} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Classroom Selection */}
                                    <div className="relative group/filter bg-blue-600 rounded-2xl p-1 shadow-lg shadow-blue-600/10">
                                        <select
                                            value={targetClassroomId}
                                            disabled={!targetLevel}
                                            onChange={e => setTargetClassroomId(e.target.value)}
                                            className="appearance-none w-full pl-6 pr-10 py-2.5 bg-transparent text-white placeholder:text-blue-100 transition-all font-bold text-[13px] outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="" className="text-slate-900">-- เลือกห้องเรียนปลายทาง --</option>
                                            {targetClassrooms.map(c => <option key={c.id} value={c.id} className="text-slate-900">{c.className}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-200 group-hover/filter:text-white transition-colors">
                                            <ListFilter size={14} />
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {transitionAction !== 'promote' && (
                            <div className="bg-amber-50/80 rounded-xl p-2.5 flex items-start gap-2 mb-3">
                                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={14} />
                                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                    สถานะจะเปลี่ยนเป็น <strong>{transitionAction === 'graduate' ? 'จบการศึกษา' : 'ย้ายออก'}</strong>
                                </p>
                            </div>
                        )}

                        {/* Staged list header */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="relative flex-1 min-w-0" />
                            <div className="flex items-center bg-white/80 backdrop-blur-xl border border-white shadow-lg shadow-black/5 rounded-full p-0.5 shrink-0">
                                <motion.button
                                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleAll(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-700 transition-colors"
                                    title="เลือกทั้งหมด"
                                >
                                    <CheckSquare size={14} />
                                </motion.button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100/80 mb-2" />

                        {/* Staged Students List */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
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
                                                onToggle={() => toggleSelection(student.id, false)}
                                                colorScheme="emerald"
                                                isFirstInSelection={isSelected && !prevSelected}
                                                isLastInSelection={isSelected && !nextSelected}
                                            />
                                        );
                                    })}
                                {stagedStudents.length === 0 && (
                                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl">
                                        <UserCheck size={22} className="mb-2" />
                                        <span className="text-xs font-bold">รอประมวลผล</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </>)}
            </div>

            {/* Bottom Action Bar — appears when students selected in source */}
            <AnimatePresence>
                {selectedSourceIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-2xl text-slate-900 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-4 border border-white scale-90 sm:scale-100"
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
                            ย้ายมาคิว
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
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-2xl text-slate-900 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-4 border border-white scale-90 sm:scale-100"
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
                                ถอดออก
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
