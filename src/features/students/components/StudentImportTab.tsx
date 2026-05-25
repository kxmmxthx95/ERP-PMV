import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, AlertCircle, FileSpreadsheet,
    Loader2, X, Link, Plus, Search, Calendar, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import StudentGoogleSheetModal from './StudentGoogleSheetModal';

// --- Types ---
interface ParsedStudent {
    id: string;
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    status: 'pending' | 'ready' | 'error' | 'success';
    errorMessage?: string;
    isEditing?: boolean;
}

const STATUS_DOT: Record<string, React.ReactNode> = {
    ready: <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]" />,
    success: <CheckCircle2 className="text-emerald-500" size={16} />,
    error: <AlertCircle className="text-rose-500" size={16} />,
    pending: <Loader2 className="text-slate-300 animate-spin" size={16} />,
};

export default function StudentImportTab() {
    // --- Form State ---
    const [academicYear, setAcademicYear] = useState('');
    const [department, setDepartment] = useState('');
    const [gradeLevel, setLevel] = useState('');
    const [searchQuery] = useState('');

    // --- Data State ---
    const [students, setStudents] = useState<ParsedStudent[]>([]);
    const [, setIsProcessingFile] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
    const [existingStudents, setExistingStudents] = useState<any[]>([]);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    const isContextLocked = academicYear !== '' && department !== '' && gradeLevel !== '';

    // Fetch existing students when context is locked
    useEffect(() => {
        const fetchExisting = async () => {
            if (!academicYear || !department || !gradeLevel) {
                setExistingStudents([]);
                return;
            }
            
            setIsLoadingExisting(true);
            try {
                const q = query(
                    collection(db, 'students'),
                    where('academicYear', '==', academicYear),
                    where('department', '==', department),
                    where('gradeLevel', '==', gradeLevel)
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setExistingStudents(docs.sort((a: any, b: any) => (b.studentCode || '').localeCompare(a.studentCode || '')));
            } catch (err) {
                console.error("Error fetching existing students:", err);
            } finally {
                setIsLoadingExisting(false);
            }
        };

        if (isContextLocked) fetchExisting();
    }, [academicYear, department, gradeLevel, isContextLocked, importSuccess]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readyCount = students.filter(s => s.status === 'ready').length;

    const filteredStudents = searchQuery
        ? students.filter(s =>
            s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.studentCode.includes(searchQuery)
        )
        : students;

    // --- Handlers ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true);
        setStudents([]);
        setImportSuccess(false);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json<any>(ws);
                const parsed: ParsedStudent[] = data.map((row, index) => ({
                    id: `temp-${index}`,
                    studentCode: String(row['เลขประจำตัวนักเรียน'] || row['studentCode'] || '').trim(),
                    prefix: String(row['คำนำหน้า'] || row['prefix'] || '').trim(),
                    firstName: String(row['ชื่อ'] || row['firstName'] || '').trim(),
                    lastName: String(row['นามสกุล'] || row['lastName'] || '').trim(),
                    phone: String(row['เบอร์โทร'] || row['phone'] || '').trim(),
                    email: String(row['อีเมล'] || row['email'] || '').trim(),
                    status: 'pending',
                }));
                const validated: ParsedStudent[] = parsed.map(s => {
                    if (!s.studentCode) return { ...s, status: 'error', errorMessage: 'เลขประจำตัวไม่ถูกต้อง' } as ParsedStudent;
                    if (!s.firstName || !s.lastName) return { ...s, status: 'error', errorMessage: 'ข้อมูลชื่อ-สกุลไม่ครบ' } as ParsedStudent;
                    return { ...s, status: 'ready' } as ParsedStudent;
                });
                setStudents(validated);
                setIsProcessingFile(false);
            };
            reader.readAsBinaryString(file);
        } catch {
            setIsProcessingFile(false);
        }
    };

    const handleAddManualRow = () => {
        setStudents(prev => [{
            id: `manual-${Date.now()}`,
            studentCode: '', prefix: '', firstName: '', lastName: '',
            phone: '', email: '',
            status: 'error', errorMessage: 'กรุณากรอกข้อมูลให้ครบถ้วน', isEditing: true
        }, ...prev]);
    };

    const handleStudentChange = (id: string, field: keyof ParsedStudent, value: string) => {
        setStudents(prev => prev.map(s => {
            if (s.id !== id) return s;
            const updated = { ...s, [field]: value };
            if (updated.isEditing) {
                if (!updated.studentCode) { updated.status = 'error'; updated.errorMessage = 'เลขประจำตัวไม่ถูกต้อง'; }
                else if (!updated.firstName || !updated.lastName || !updated.prefix) { updated.status = 'error'; updated.errorMessage = 'ข้อมูลชื่อ-สกุลไม่ครบ'; }
                else { updated.status = 'ready'; updated.errorMessage = undefined; }
            }
            return updated;
        }));
    };

    const commitImport = async () => {
        const validStudents = students.filter(s => s.status === 'ready');
        if (validStudents.length === 0) return;
        setIsCommitting(true);
        try {
            const batch = writeBatch(db);
            const studentsRef = collection(db, 'students');
            const studentCodes = validStudents.map(s => s.studentCode);
            const duplicateIds = new Set<string>();
            for (let i = 0; i < studentCodes.length; i += 30) {
                const chunk = studentCodes.slice(i, i + 30);
                const snap = await getDocs(query(studentsRef, where('studentCode', 'in', chunk)));
                snap.docs.forEach(d => duplicateIds.add(d.data().studentCode));
            }
            const studentIdsForClassroom: string[] = [];
            let hasNewData = false;
            const processed: ParsedStudent[] = students.map(student => {
                if (student.status !== 'ready' || duplicateIds.has(student.studentCode)) {
                    if (duplicateIds.has(student.studentCode))
                        return { ...student, status: 'error', errorMessage: 'เลขประจำตัวนี้มีอยู่ในระบบแล้ว' } as ParsedStudent;
                    return student;
                }
                const newDocRef = doc(studentsRef);
                studentIdsForClassroom.push(newDocRef.id);
                batch.set(newDocRef, {
                    studentCode: student.studentCode, prefix: student.prefix,
                    firstName: student.firstName, lastName: student.lastName,
                    phone: student.phone || '', email: student.email || '',
                    academicYear: academicYear,
                    academicYearId: academicYear,
                    gradeLevel,
                    createdAt: new Date(), status: 'active'
                });
                hasNewData = true;
                return { ...student, status: 'success' } as ParsedStudent;
            });
            if (hasNewData) await batch.commit();
            setStudents(processed);
            setImportSuccess(true);
        } catch (error) {
            console.error('Batch commit error:', error);
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <>
            <div className="min-h-full w-full p-0 pb-6 lg:pb-8 font-sukhumvit relative overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 relative z-10 flex gap-8">

                    {/* LEFT COLUMN — Import Preview */}
                    <div className="flex-[1.8] min-w-0 flex flex-col">



                        {/* Context Lock Overlay */}
                        {!isContextLocked && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-60">
                                <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                                    <AlertCircle size={28} className="text-rose-400" />
                                </div>
                                <span className="text-sm font-bold text-rose-500">กรุณากำหนดปีการศึกษา แผนก และระดับชั้นก่อน</span>
                            </div>
                        )}

                        {/* Empty State */}
                        {isContextLocked && students.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                                <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                                    <FileSpreadsheet size={28} className="text-slate-400" />
                                </div>
                                <span className="text-sm font-bold">รอรับข้อมูลเพื่อพรีวิว</span>
                                <span className="text-xs">นำเข้าไฟล์หรือเพิ่มข้อมูลด้วยตนเอง</span>
                            </div>
                        )}

                        {/* Preview List */}
                        {isContextLocked && students.length > 0 && (
                            <div className="flex flex-col flex-1 min-h-0">
                                {/* List Header */}
                                <div className="grid grid-cols-[20px_120px_1fr_100px_120px_32px] items-center gap-4 px-4 pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <span />
                                    <span>เลขประจำตัว</span>
                                    <span>ชื่อ-นามสกุล</span>
                                    <span>เบอร์โทร</span>
                                    <span>อีเมล</span>
                                    <span />
                                </div>

                                <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                                    <AnimatePresence>
                                        {filteredStudents.map(student => (
                                            <motion.div
                                                key={student.id}
                                                layout
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -8 }}
                                                className="group flex items-center gap-4 px-4 py-3 border-b border-slate-100/60 hover:bg-slate-50/50 transition-colors"
                                            >
                                                {student.isEditing ? (
                                                    <>
                                                        {/* Status */}
                                                        <div className="w-5 flex items-center justify-center">
                                                            {STATUS_DOT[student.status]}
                                                        </div>
                                                        {/* Student Code */}
                                                        <input
                                                            type="text"
                                                            value={student.studentCode}
                                                            onChange={e => handleStudentChange(student.id, 'studentCode', e.target.value)}
                                                            placeholder="เลขประจำตัว"
                                                            className={`w-[120px] bg-white/60 border ${student.status === 'error' && !student.studentCode ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-blue-400 transition-colors shadow-sm`}
                                                        />
                                                        {/* Name */}
                                                        <div className="flex-1 flex gap-2 items-start min-w-0">
                                                            <select
                                                                value={student.prefix}
                                                                onChange={e => handleStudentChange(student.id, 'prefix', e.target.value)}
                                                                className={`bg-white/60 border ${!student.prefix ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1.5 text-xs outline-none w-20 shrink-0 appearance-none cursor-pointer`}
                                                            >
                                                                <option value="">คำนำหน้า</option>
                                                                <option value="ด.ช.">ด.ช.</option>
                                                                <option value="ด.ญ.">ด.ญ.</option>
                                                                <option value="นาย">นาย</option>
                                                                <option value="นางสาว">นางสาว</option>
                                                            </select>
                                                            <input
                                                                type="text"
                                                                value={student.firstName}
                                                                onChange={e => handleStudentChange(student.id, 'firstName', e.target.value)}
                                                                placeholder="ชื่อ"
                                                                className={`flex-1 bg-white/60 border ${!student.firstName ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1.5 text-xs outline-none min-w-0`}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={student.lastName}
                                                                onChange={e => handleStudentChange(student.id, 'lastName', e.target.value)}
                                                                placeholder="นามสกุล"
                                                                className={`flex-1 bg-white/60 border ${!student.lastName ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1.5 text-xs outline-none min-w-0`}
                                                            />
                                                        </div>
                                                        {/* Phone */}
                                                        <input
                                                            type="text"
                                                            value={student.phone || ''}
                                                            onChange={e => handleStudentChange(student.id, 'phone', e.target.value)}
                                                            placeholder="เบอร์โทร"
                                                            className="w-[100px] bg-white/60 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                        />
                                                        {/* Email */}
                                                        <input
                                                            type="email"
                                                            value={student.email || ''}
                                                            onChange={e => handleStudentChange(student.id, 'email', e.target.value)}
                                                            placeholder="อีเมล"
                                                            className="w-[120px] bg-white/60 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                        />
                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => setStudents(prev => prev.filter(s => s.id !== student.id))}
                                                            className="w-8 h-8 flex items-center justify-center rounded-full text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                                        >
                                                            <X size={14} strokeWidth={2.5} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-5 flex items-center justify-center">
                                                            {STATUS_DOT[student.status]}
                                                        </div>
                                                        <span className="w-[120px] font-mono text-slate-400 text-[11px] tracking-tighter truncate">
                                                            {student.studentCode}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[13px] font-bold text-slate-800 truncate">
                                                                {student.prefix}{student.firstName} {student.lastName}
                                                            </p>
                                                            {student.errorMessage && (
                                                                <p className="text-[10px] text-rose-500 font-bold">{student.errorMessage}</p>
                                                            )}
                                                        </div>
                                                        <span className="w-[100px] text-[11px] text-slate-500 font-medium truncate">
                                                            {student.phone || '—'}
                                                        </span>
                                                        <span className="w-[120px] text-[11px] text-slate-400 truncate">
                                                            {student.email || '—'}
                                                        </span>
                                                        <button
                                                            onClick={() => setStudents(prev => prev.filter(s => s.id !== student.id))}
                                                            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                        >
                                                            <X size={14} strokeWidth={2.5} />
                                                        </button>
                                                    </>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                {/* Footer */}
                                {students.length > 0 && (
                                    <div className="pt-3 flex items-center justify-between px-4">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {filteredStudents.length} รายการ
                                        </span>
                                        <button
                                            onClick={() => { setStudents([]); setImportSuccess(false); }}
                                            className="text-[10px] font-bold text-rose-400 hover:text-rose-600 uppercase tracking-wider transition-colors"
                                        >
                                            ล้างข้อมูลทั้งหมด
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN — Recently Imported / Existing */}
                    <div className="flex-1 min-w-0 flex flex-col border-l border-slate-100 pl-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">รายชื่อล่าสุดในระบบ</h3>
                            {existingStudents.length > 0 && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[9px] font-bold">
                                    {existingStudents.length} คน
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {!isContextLocked ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-40">
                                    <Search size={24} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-center">รอเลือกแผนกและระดับชั้น</span>
                                </div>
                            ) : isLoadingExisting ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 size={20} className="animate-spin text-slate-300" />
                                </div>
                            ) : existingStudents.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-40">
                                    <FileSpreadsheet size={24} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-center">ไม่พบข้อมูลในระบบ</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {existingStudents.map((st, idx) => (
                                        <div key={st.id || idx} className="group flex items-center gap-3 p-3 bg-white/40 hover:bg-white/80 border border-transparent hover:border-slate-100 rounded-2xl transition-all">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                {st.studentCode?.slice(-2) || '??'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold text-slate-700 truncate">
                                                    {st.prefix}{st.firstName} {st.lastName}
                                                </p>
                                                <p className="text-[10px] font-medium text-slate-400 font-mono">
                                                    {st.studentCode}
                                                </p>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* BOTTOM FLOATING CAPSULE BAR — Compact Version */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-fit max-w-[95%]">
                    <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-full p-1.5 shadow-[0_15px_40px_-12px_rgba(0,0,0,0.15)] flex items-center gap-1.5 ring-1 ring-black/[0.03]">
                        
                        {/* Year Input */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50/50 rounded-full border border-slate-100 focus-within:border-blue-300 focus-within:bg-white transition-all group">
                            <Calendar size={12} className="text-slate-400 group-focus-within:text-blue-500" />
                            <input
                                type="text"
                                placeholder="รุ่น..."
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 w-16 placeholder:text-slate-300"
                            />
                        </div>

                        <div className="w-px h-4 bg-slate-200/60 mx-0.5" />

                        {/* Department Chips */}
                        <div className="flex items-center gap-1">
                            {Object.entries(DEPARTMENT_CONFIG).map(([id, cfg]) => {
                                const isActive = department === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setDepartment(id)}
                                        className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all ${
                                            isActive 
                                                ? 'bg-[#1a1f2e] text-white shadow-md' 
                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="w-px h-4 bg-slate-200/60 mx-0.5" />

                        {/* Grade Level Select */}
                        <div className="relative group">
                            <select
                                value={gradeLevel}
                                onChange={e => setLevel(e.target.value)}
                                className="pl-3 pr-7 py-1.5 bg-slate-50/50 hover:bg-slate-100 border border-slate-100 rounded-full text-[11px] font-black text-slate-600 outline-none appearance-none cursor-pointer transition-all min-w-[100px]"
                            >
                                <option value="">ระดับชั้น</option>
                                {department && DEPARTMENT_CONFIG[department as keyof typeof DEPARTMENT_CONFIG]?.grades.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Action Group */}
                        <div className="flex items-center gap-0.5 ml-2 border-l border-slate-100 pl-2">
                            <button
                                onClick={handleAddManualRow}
                                disabled={!isContextLocked}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all disabled:opacity-20"
                                title="เพิ่มด้วยตนเอง"
                            >
                                <Plus size={18} strokeWidth={3} />
                            </button>
                            <button
                                onClick={() => setIsSheetModalOpen(true)}
                                disabled={!isContextLocked}
                                className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all disabled:opacity-20"
                                title="นำเข้าจาก Google Sheet"
                            >
                                <Link size={18} strokeWidth={3} />
                            </button>
                            
                            {students.length > 0 && !importSuccess && (
                                <button
                                    onClick={commitImport}
                                    disabled={isCommitting || readyCount === 0}
                                    className="ml-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[11px] font-black shadow-md transition-all disabled:opacity-40"
                                >
                                    {isCommitting ? <Loader2 size={12} className="animate-spin" /> : 'ยืนยันนำเข้า'}
                                </button>
                            )}

                            {importSuccess && (
                                <div className="ml-1.5 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[11px] font-black">สำเร็จ</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <StudentGoogleSheetModal
                open={isSheetModalOpen}
                onClose={() => setIsSheetModalOpen(false)}
                onImport={(newStudents) => setStudents(newStudents)}
            />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />
        </>
    );
}
