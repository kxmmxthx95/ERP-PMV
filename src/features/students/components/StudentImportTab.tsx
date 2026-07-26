import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiCheckCircle, HiExclamationCircle,
    HiArrowPath, HiXMark, HiLink, HiPlus, HiArrowUpTray, HiChevronRight,
    HiArrowRight
} from 'react-icons/hi2';
import { loadXlsx } from '@/lib/lazyXlsx';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import StudentGoogleSheetModal from './StudentGoogleSheetModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    success: <HiCheckCircle className="text-emerald-500" size={15} />,
    error: <HiExclamationCircle className="text-rose-400" size={15} />,
    pending: <HiArrowPath className="text-slate-300 animate-spin" size={15} />,
};

// ─── Mini select helper ───────────────────────────────────────────────────────
function CapsuleSelect({
    value, onChange, options, placeholder, disabled = false,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-8 border-none bg-transparent px-3.5 text-[11px] font-bold text-slate-800 shadow-none">
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

export default function StudentImportTab() {
    const [academicYear, setAcademicYear] = useState('');
    const [department, setDepartment] = useState('');
    const [gradeLevel, setLevel] = useState('');

    const [students, setStudents] = useState<ParsedStudent[]>([]);
    const [, setIsProcessingFile] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const isContextLocked = academicYear !== '' && department !== '' && gradeLevel !== '';
    const readyCount = students.filter(s => s.status === 'ready').length;
    const errorCount = students.filter(s => s.status === 'error').length;

    const parseFile = (file: File) => {
        setIsProcessingFile(true);
        setStudents([]);
        setImportSuccess(false);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const XLSX = await loadXlsx();
            const wb = XLSX.read(evt.target?.result, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
            const parsed: ParsedStudent[] = data.map((row, i) => {
                const s: ParsedStudent = {
                    id: `temp-${i}`,
                    studentCode: String(row['เลขประจำตัวนักเรียน'] || row['studentCode'] || '').trim(),
                    prefix: String(row['คำนำหน้า'] || row['prefix'] || '').trim(),
                    firstName: String(row['ชื่อ'] || row['firstName'] || '').trim(),
                    lastName: String(row['นามสกุล'] || row['lastName'] || '').trim(),
                    phone: String(row['เบอร์โทร'] || row['phone'] || '').trim(),
                    email: String(row['อีเมล'] || row['email'] || '').trim(),
                    status: 'pending',
                };
                if (!s.studentCode) return { ...s, status: 'error', errorMessage: 'เลขประจำตัวไม่ถูกต้อง' } as ParsedStudent;
                if (!s.firstName || !s.lastName) return { ...s, status: 'error', errorMessage: 'ชื่อ-สกุลไม่ครบ' } as ParsedStudent;
                return { ...s, status: 'ready' } as ParsedStudent;
            });
            setStudents(parsed);
            setIsProcessingFile(false);
        };
        reader.readAsBinaryString(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && isContextLocked) parseFile(file);
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
            const u = { ...s, [field]: value };
            if (u.isEditing) {
                if (!u.studentCode) { u.status = 'error'; u.errorMessage = 'เลขประจำตัวไม่ถูกต้อง'; }
                else if (!u.firstName || !u.lastName || !u.prefix) { u.status = 'error'; u.errorMessage = 'ชื่อ-สกุลไม่ครบ'; }
                else { u.status = 'ready'; u.errorMessage = undefined; }
            }
            return u;
        }));
    };

    const commitImport = async () => {
        const valid = students.filter(s => s.status === 'ready');
        if (!valid.length) return;
        setIsCommitting(true);
        try {
            const ref = collection(db, 'students');
            const codes = valid.map(s => s.studentCode);
            const dupes = new Set<string>();
            for (let i = 0; i < codes.length; i += 30) {
                const snap = await getDocs(query(ref, where('studentCode', 'in', codes.slice(i, i + 30))));
                snap.docs.forEach(d => dupes.add(d.data().studentCode));
            }
            const batch = writeBatch(db);
            let hasNew = false;
            const processed = students.map(s => {
                if (s.status !== 'ready') return s;
                if (dupes.has(s.studentCode)) return { ...s, status: 'error' as const, errorMessage: 'เลขประจำตัวนี้มีอยู่แล้ว' };
                batch.set(doc(ref), {
                    studentCode: s.studentCode, prefix: s.prefix,
                    firstName: s.firstName, lastName: s.lastName,
                    phone: s.phone || '', email: s.email || '',
                    academicYear, academicYearId: academicYear,
                    department, gradeLevel,
                    createdAt: new Date(), status: 'active'
                });
                hasNew = true;
                return { ...s, status: 'success' as const };
            });
            if (hasNew) await batch.commit();
            setStudents(processed);
            setImportSuccess(true);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCommitting(false);
        }
    };

    const gradeOptions = department
        ? (DEPARTMENT_CONFIG[department as keyof typeof DEPARTMENT_CONFIG]?.grades ?? []).map(g => ({ value: g, label: g }))
        : [];

    return (
        <>
            <div className="h-full w-full flex flex-col gap-0 font-sukhumvit overflow-hidden">

                {/* ── TOP FILTER BAR — step capsules ── */}
                <div className="flex items-center gap-1.5 mb-5 shrink-0 flex-wrap">

                    {/* Step 1: Year */}
                    <motion.div layout className="flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-3 shadow-sm shrink-0 gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">รุ่น</span>
                        <input
                            type="text"
                            placeholder="2568"
                            value={academicYear}
                            onChange={e => { setAcademicYear(e.target.value); setStudents([]); setImportSuccess(false); }}
                            className="bg-transparent outline-none text-[11px] font-bold text-slate-800 w-12 placeholder:text-slate-300"
                        />
                    </motion.div>

                    {/* Arrow */}
                    <HiChevronRight size={12} className="text-slate-300 shrink-0" />

                    {/* Step 2: Department */}
                    <motion.div layout className="flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1.5 shadow-sm shrink-0 gap-1">
                        {Object.entries(DEPARTMENT_CONFIG).map(([id, cfg]) => (
                            <button
                                key={id}
                                onClick={() => { setDepartment(id === department ? '' : id); setLevel(''); setStudents([]); setImportSuccess(false); }}
                                className={`h-7 px-3 rounded-full text-[11px] font-black transition-all ${
                                    department === id
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:bg-black/5'
                                }`}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </motion.div>

                    {/* Step 3: Grade — shows when dept selected */}
                    <AnimatePresence>
                        {department && (
                            <>
                                <motion.span
                                    key="arrow-grade"
                                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                                >
                                    <HiChevronRight size={12} className="text-slate-300 shrink-0" />
                                </motion.span>
                                <motion.div
                                    key="grade-capsule"
                                    layout
                                    initial={{ opacity: 0, x: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -8, scale: 0.95 }}
                                    className="flex items-center h-9 bg-white/80 border border-black/[0.07] rounded-full px-1 shadow-sm shrink-0"
                                >
                                    <CapsuleSelect
                                        value={gradeLevel}
                                        onChange={v => { setLevel(v); setStudents([]); setImportSuccess(false); }}
                                        options={gradeOptions}
                                        placeholder="ระดับชั้น"
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── MAIN BODY ── */}
                <div className="flex flex-1 min-h-0">

                    {/* Preview / drop zone */}
                    <div className="flex-1 min-w-0 flex flex-col min-h-0">
                        <AnimatePresence mode="wait">

                            {/* Not configured yet */}
                            {!isContextLocked && (
                                <motion.div
                                    key="not-configured"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex-1 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                                        <HiArrowRight size={20} className="text-slate-400" />
                                    </div>
                                    <p className="text-[12px] font-bold text-slate-400">กำหนด รุ่น · แผนก · ระดับชั้น ก่อน</p>
                                </motion.div>
                            )}

                            {/* Drop zone — no students yet */}
                            {isContextLocked && students.length === 0 && (
                                <motion.div
                                    key="dropzone"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    className={`flex-1 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed transition-all cursor-pointer ${
                                        isDragging
                                            ? 'border-blue-400 bg-blue-50/60 scale-[1.01]'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-white/40'
                                    }`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                        <HiArrowUpTray size={24} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-black text-slate-600">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">.xlsx, .xls, .csv</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleAddManualRow(); }}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                                        >
                                            <HiPlus size={13} />
                                            เพิ่มเอง
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); setIsSheetModalOpen(true); }}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm"
                                        >
                                            <HiLink size={13} />
                                            Google Sheet
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Preview table */}
                            {isContextLocked && students.length > 0 && (
                                <motion.div
                                    key="preview"
                                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex-1 min-h-0 flex flex-col"
                                >
                                    {/* Table header + toolbar */}
                                    <div className="flex items-center justify-between mb-3 shrink-0">
                                        <div className="flex items-center gap-2">
                                            {readyCount > 0 && (
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[11px] font-black rounded-full border border-blue-200">
                                                    {readyCount} พร้อมนำเข้า
                                                </span>
                                            )}
                                            {errorCount > 0 && (
                                                <span className="px-3 py-1 bg-rose-100 text-rose-700 text-[11px] font-black rounded-full border border-rose-200">
                                                    {errorCount} ผิดพลาด
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-sm">
                                            <button
                                                onClick={handleAddManualRow}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-slate-700 hover:bg-slate-100 transition-all"
                                            >
                                                <HiPlus size={12} />เพิ่มแถว
                                            </button>
                                            <div className="w-px h-3 bg-slate-200" />
                                            <button
                                                onClick={() => setIsSheetModalOpen(true)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-emerald-700 hover:bg-emerald-50 transition-all"
                                            >
                                                <HiLink size={12} />Sheet
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-blue-700 hover:bg-blue-50 transition-all"
                                            >
                                                <HiArrowUpTray size={12} />ไฟล์
                                            </button>
                                            <div className="w-px h-3 bg-slate-200" />
                                            <button
                                                onClick={() => { setStudents([]); setImportSuccess(false); }}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-rose-600 hover:bg-rose-50 transition-all"
                                            >
                                                <HiXMark size={12} />ล้าง
                                            </button>
                                        </div>
                                    </div>

                                    {/* Column headers */}
                                    <div className="grid grid-cols-[20px_100px_1fr_100px_140px_28px] items-center gap-3 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 rounded-xl mb-1 shrink-0">
                                        <span />
                                        <span>รหัสนักเรียน</span>
                                        <span>ชื่อ-นามสกุล</span>
                                        <span>เบอร์โทร</span>
                                        <span>อีเมล</span>
                                        <span />
                                    </div>

                                    {/* Rows */}
                                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-0.5">
                                        <AnimatePresence initial={false}>
                                            {students.map((student, idx) => (
                                                <motion.div
                                                    key={student.id}
                                                    layout
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className={`group grid grid-cols-[20px_100px_1fr_100px_140px_28px] items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                                                        student.status === 'error'
                                                            ? 'bg-rose-50 hover:bg-rose-100/70'
                                                            : student.status === 'success'
                                                            ? 'bg-emerald-50 hover:bg-emerald-100/70'
                                                            : idx % 2 === 0
                                                            ? 'bg-white hover:bg-slate-50'
                                                            : 'bg-slate-50/60 hover:bg-slate-100/60'
                                                    }`}>
                                                        <div className="flex items-center justify-center">{STATUS_DOT[student.status]}</div>

                                                        {student.isEditing ? (
                                                            <>
                                                                <input
                                                                    value={student.studentCode}
                                                                    onChange={e => handleStudentChange(student.id, 'studentCode', e.target.value)}
                                                                    placeholder="รหัส"
                                                                    className={`w-full bg-white border ${!student.studentCode ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1 text-[11px] font-mono text-slate-800 outline-none focus:border-blue-400`}
                                                                />
                                                                <div className="flex gap-1.5 min-w-0">
                                                                    <Select
                                                                        value={student.prefix}
                                                                        onValueChange={v => handleStudentChange(student.id, 'prefix', v)}
                                                                    >
                                                                        <SelectTrigger
                                                                            className={`h-auto w-[72px] shrink-0 bg-white border ${!student.prefix ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-1.5 py-1 text-[10px] text-slate-800 shadow-none`}
                                                                        >
                                                                            <SelectValue placeholder="คำนำหน้า" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="เด็กชาย">เด็กชาย</SelectItem>
                                                                            <SelectItem value="เด็กหญิง">เด็กหญิง</SelectItem>
                                                                            <SelectItem value="นาย">นาย</SelectItem>
                                                                            <SelectItem value="นางสาว">นางสาว</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <input value={student.firstName} onChange={e => handleStudentChange(student.id, 'firstName', e.target.value)} placeholder="ชื่อ" className={`flex-1 bg-white border ${!student.firstName ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1 text-[11px] text-slate-800 outline-none min-w-0`} />
                                                                    <input value={student.lastName} onChange={e => handleStudentChange(student.id, 'lastName', e.target.value)} placeholder="นามสกุล" className={`flex-1 bg-white border ${!student.lastName ? 'border-rose-300' : 'border-slate-200'} rounded-lg px-2 py-1 text-[11px] text-slate-800 outline-none min-w-0`} />
                                                                </div>
                                                                <input value={student.phone || ''} onChange={e => handleStudentChange(student.id, 'phone', e.target.value)} placeholder="เบอร์" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 outline-none" />
                                                                <input value={student.email || ''} onChange={e => handleStudentChange(student.id, 'email', e.target.value)} placeholder="อีเมล" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 outline-none" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-[11px] font-mono font-bold text-slate-600 truncate">{student.studentCode}</span>
                                                                <div className="min-w-0">
                                                                    <p className="text-[13px] font-bold text-slate-900 truncate">{student.prefix}{student.firstName} {student.lastName}</p>
                                                                    {student.errorMessage && <p className="text-[10px] text-rose-600 font-bold">{student.errorMessage}</p>}
                                                                    {student.status === 'success' && <p className="text-[10px] text-emerald-600 font-bold">นำเข้าสำเร็จ</p>}
                                                                </div>
                                                                <span className="text-[12px] font-medium text-slate-600 truncate">{student.phone || '—'}</span>
                                                                <span className="text-[11px] font-medium text-slate-500 truncate">{student.email || '—'}</span>
                                                            </>
                                                        )}

                                                        <button
                                                            onClick={() => setStudents(prev => prev.filter(s => s.id !== student.id))}
                                                            className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-100 transition-all"
                                                        >
                                                            <HiXMark size={12} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {/* Bottom action row */}
                                    <div className="pt-3 shrink-0 flex items-center justify-between border-t border-slate-200">
                                        <span className="text-[12px] font-bold text-slate-600">{students.length} รายการ</span>
                                        <AnimatePresence mode="wait">
                                            {importSuccess ? (
                                                <motion.div
                                                    key="success"
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100"
                                                >
                                                    <HiCheckCircle size={13} />
                                                    <span className="text-[11px] font-black">นำเข้าสำเร็จ {students.filter(s => s.status === 'success').length} คน</span>
                                                </motion.div>
                                            ) : (
                                                <motion.button
                                                    key="commit"
                                                    onClick={commitImport}
                                                    disabled={isCommitting || readyCount === 0}
                                                    className="flex items-center gap-2 px-5 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-full text-[11px] font-black shadow-sm transition-all disabled:opacity-30"
                                                >
                                                    {isCommitting
                                                        ? <><HiArrowPath size={12} className="animate-spin" />กำลังบันทึก...</>
                                                        : <><HiCheckCircle size={12} />ยืนยันนำเข้า {readyCount} คน</>
                                                    }
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                accept=".xlsx,.xls,.csv"
                className="hidden"
            />
        </>
    );
}
