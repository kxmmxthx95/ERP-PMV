import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileSpreadsheet, Link, AlertCircle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

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
}

interface Props {
    open: boolean;
    onClose: () => void;
    onImport: (students: ParsedStudent[]) => void;
}

const TEMPLATE_COLUMNS = [
    'studentCode',
    'prefix',
    'firstName',
    'lastName',
    'phone',
    'email',
];

const FIELD_DOCS = [
    { field: 'studentCode', desc: 'เลขประจำตัวนักเรียน', example: '67001', required: true },
    { field: 'prefix', desc: 'คำนำหน้าชื่อ', example: 'ด.ช. / ด.ญ. / นาย / น.ส.', required: true },
    { field: 'firstName', desc: 'ชื่อจริง', example: 'สมชาย', required: true },
    { field: 'lastName', desc: 'นามสกุล', example: 'สายเสมอ', required: true },
    { field: 'phone', desc: 'เบอร์โทรศัพท์', example: '0812345678', required: false },
    { field: 'email', desc: 'อีเมล', example: 'somchai@email.com', required: true },
];

function buildCsvContent(): string {
    const header = TEMPLATE_COLUMNS.join(',');
    const sampleRows = [
        ['67001', 'ด.ช.', 'สมชาย', 'สายเสมอ', '0812345678', 'somchai@email.com'],
        ['67002', 'ด.ญ.', 'สมหญิง', 'มิ่งขวัญ', '0898765432', 'somying@email.com'],
    ];
    const rows = sampleRows.map(r => r.join(','));
    return [header, ...rows].join('\n');
}

function downloadTemplate() {
    const blob = new Blob(['\ufeff' + buildCsvContent()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function parseCsv(text: string): ParsedStudent[] {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (นอกจาก header)');

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const students: ParsedStudent[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

        if (!row.studentCode || !row.firstName || !row.lastName) continue;

        students.push({
            id: Math.random().toString(36).substring(2, 9),
            studentCode: String(row.studentCode).trim(),
            prefix: row.prefix || '',
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone || '',
            email: row.email || '',
            status: 'ready'
        });
    }

    if (students.length === 0) throw new Error('ไม่พบข้อมูลนักเรียนที่ถูกต้องในไฟล์');
    return students;
}

async function fetchGoogleSheet(sheetUrl: string): Promise<ParsedStudent[]> {
    const match = sheetUrl.match(/\/d\/([\w-]+)/);
    if (!match) throw new Error('URL Google Sheet ไม่ถูกต้อง');
    const sheetId = match[1];

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ — ตรวจสอบว่า Sheet ตั้งค่าเป็น "ทุกคนที่มีลิงก์" และ "ผู้ชม"');
    const text = await res.text();
    return parseCsv(text);
}

export default function StudentGoogleSheetModal({ open, onClose, onImport }: Props) {
    const [tab, setTab] = useState<'template' | 'sheet'>('template');
    const [sheetUrl, setSheetUrl] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ParsedStudent[] | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const reset = () => {
        setSheetUrl('');
        setCsvFile(null);
        setPreview(null);
        setError('');
        setLoading(false);
    };

    const handleClose = () => { reset(); onClose(); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        setError('');
        setPreview(null);
        try {
            const text = await file.text();
            const students = parseCsv(text);
            setPreview(students);
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาด');
        }
    };

    const handleFetchSheet = async () => {
        if (!sheetUrl.trim()) return;
        setLoading(true);
        setError('');
        setPreview(null);
        try {
            const students = await fetchGoogleSheet(sheetUrl.trim());
            setPreview(students);
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (!preview) return;
        onImport(preview);
        handleClose();
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/90 backdrop-blur-2xl border border-white"
                    >
                        <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-100">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                                <FileSpreadsheet size={20} className="text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-black text-slate-800">นำเข้าจาก Google Sheet / CSV</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">เชื่อมต่อข้อมูลนักเรียนจากภายนอก</p>
                            </div>
                            <button onClick={handleClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="flex items-center bg-slate-50 rounded-2xl p-1.5 gap-1">
                                {[
                                    { id: 'template' as const, label: 'อัปโหลด CSV', icon: Download },
                                    { id: 'sheet' as const, label: 'Google Sheet URL', icon: Link },
                                ].map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => { setTab(id); setPreview(null); setError(''); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${tab === id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Icon size={14} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'template' && (
                                <div className="space-y-4">
                                    <div
                                        className="rounded-[2rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                                        onClick={() => document.getElementById('csv-file-input')?.click()}
                                    >
                                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                                            <FileSpreadsheet size={32} className="text-slate-300" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-black text-slate-700">{csvFile ? csvFile.name : 'คลิกเพื่อเลือกไฟล์ CSV'}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">รองรับไฟล์ .csv เท่านั้น</p>
                                        </div>
                                        <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                                    </div>

                                    <button
                                        onClick={downloadTemplate}
                                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-600 transition-all"
                                    >
                                        <Download size={14} />
                                        ดาวน์โหลด Template CSV
                                    </button>
                                </div>
                            )}

                            {tab === 'sheet' && (
                                <div className="space-y-6">
                                    <div className="rounded-[2rem] p-6 bg-blue-50/50 border border-blue-100/50 space-y-3">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <AlertCircle size={16} />
                                            <span className="text-xs font-black uppercase tracking-widest">วิธีเตรียม Google Sheet</span>
                                        </div>
                                        <ol className="list-decimal list-inside space-y-2 text-[11px] font-bold text-slate-500 leading-relaxed">
                                            <li>สร้าง Google Sheet และตั้งหัวข้อคอลัมน์ตาม Template</li>
                                            <li>กดปุ่ม <span className="text-blue-600">"แชร์" (Share)</span></li>
                                            <li>เปลี่ยนสิทธิ์เข้าถึงเป็น <span className="text-blue-600">"ทุกคนที่มีลิงก์" (Anyone with the link)</span></li>
                                            <li>คัดลอก URL มาวางในช่องด้านล่าง</li>
                                        </ol>
                                        <a
                                            href="https://docs.google.com/spreadsheets/create"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-blue-500 hover:underline text-[11px] font-black pt-2"
                                        >
                                            <ExternalLink size={12} />
                                            สร้าง Google Sheet ใหม่
                                        </a>
                                    </div>

                                    <div className="flex gap-3">
                                        <input
                                            type="url"
                                            value={sheetUrl}
                                            onChange={e => setSheetUrl(e.target.value)}
                                            placeholder="วางลิงก์ Google Sheet ที่นี่..."
                                            className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50/50 bg-white/50 transition-all"
                                        />
                                        <button
                                            onClick={handleFetchSheet}
                                            disabled={!sheetUrl.trim() || loading}
                                            className="px-6 py-4 rounded-2xl bg-blue-600 text-white text-xs font-black disabled:opacity-40 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                                            {loading ? 'ดึงข้อมูล...' : 'ดึงข้อมูล'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100">
                                    <AlertCircle size={18} className="text-rose-500 shrink-0" />
                                    <p className="text-xs font-bold text-rose-600 leading-relaxed">{error}</p>
                                </div>
                            )}

                            {preview && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ตัวอย่างข้อมูล ({preview.length} รายการ)</p>
                                        <div className="flex items-center gap-1.5 text-emerald-500">
                                            <CheckCircle2 size={12} />
                                            <span className="text-[10px] font-black uppercase">พร้อมนำเข้า</span>
                                        </div>
                                    </div>
                                    <div className="rounded-[1.5rem] border border-slate-100 overflow-hidden bg-white/50">
                                        <div className="overflow-x-auto max-h-60 scrollbar-hide">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50/50 sticky top-0">
                                                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                        <th className="px-4 py-3 text-center">สถานะ</th>
                                                        <th className="px-4 py-3">เลขบัตรฯ</th>
                                                        <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                                                        <th className="px-4 py-3 text-right pr-4">หัวตาราง</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[11px] font-bold text-slate-600">
                                                    {preview.slice(0, 10).map((s, i) => (
                                                        <tr key={i} className="border-b border-slate-50/50">
                                                            <td className="px-4 py-3 font-mono text-slate-400">{s.studentCode}</td>
                                                            <td className="px-4 py-3">{s.prefix}{s.firstName} {s.lastName}</td>
                                                        </tr>
                                                    ))}
                                                    {preview.length > 10 && (
                                                        <tr>
                                                            <td colSpan={2} className="px-4 py-3 text-center text-slate-400 italic">... และอีก {preview.length - 10} รายการ</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <details className="group">
                                <summary className="cursor-pointer text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest list-none flex items-center gap-2 select-none">
                                    <span className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] group-open:rotate-90 transition-transform">▶</span>
                                    ข้อกำหนดหัวตาราง (Template Fields)
                                </summary>
                                <div className="mt-4 rounded-2xl border border-slate-100 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50">
                                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="px-4 py-3">Field Name</th>
                                                <th className="px-4 py-3">คำอธิบาย</th>
                                                <th className="px-4 py-3">ตัวอย่าง</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[10px] font-bold text-slate-500">
                                            {FIELD_DOCS.map(f => (
                                                <tr key={f.field} className="border-b border-slate-50/50">
                                                    <td className="px-4 py-2.5 font-mono text-blue-600">{f.field}</td>
                                                    <td className="px-4 py-2.5">{f.desc}</td>
                                                    <td className="px-4 py-2.5 font-mono text-slate-400">{f.example}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        </div>

                        <div className="flex items-center justify-end gap-3 px-8 py-6 border-t border-slate-100 bg-slate-50/30">
                            <button onClick={handleClose} className="px-6 py-3 rounded-full text-xs font-black text-slate-400 hover:bg-white hover:text-slate-600 transition-all">ยกเลิก</button>
                            <button
                                onClick={handleConfirm}
                                disabled={!preview || preview.length === 0}
                                className="px-10 py-3 rounded-full bg-slate-900 text-white text-xs font-black disabled:opacity-30 hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                ยืนยันการนำเข้า {preview?.length || 0} รายการ
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
