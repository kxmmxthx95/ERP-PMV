import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedUser {
  id: string;
  rowNumber: number;
  email: string;
  prefix: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher' | 'staff' | 'admin' | 'sysadmin' | 'parent';
  department: string;
  studentCode?: string;
  phone?: string;
  password?: string;
  status: 'ready' | 'error' | 'success';
  errorMessage?: string;
}

interface UserImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportTab = 'upload' | 'sheet';

const TEMPLATE_COLUMNS = [
  'email',
  'prefix',
  'firstName',
  'lastName',
  'role',
  'department',
  'studentCode',
  'phone',
  'password'
];

const FIELD_DOCS = [
  { field: 'email', desc: 'อีเมล (ใช้เป็น Username)', example: 'user@pmv.com', required: true },
  { field: 'prefix', desc: 'คำนำหน้า', example: 'นาย / นางสาว / ครู', required: true },
  { field: 'firstName', desc: 'ชื่อจริง (ไทย)', example: 'สมชาย', required: true },
  { field: 'lastName', desc: 'นามสกุล (ไทย)', example: 'ใจดี', required: true },
  { field: 'role', desc: 'บทบาท (student/teacher/staff/admin/sysadmin/parent)', example: 'student', required: true },
  { field: 'department', desc: 'แผนก (preschool/primary/secondary)', example: 'secondary', required: true },
  { field: 'studentCode', desc: 'เลขประจำตัว (สำหรับนักเรียน)', example: '67001', required: false },
  { field: 'phone', desc: 'เบอร์โทรศัพท์', example: '0812345678', required: false },
  { field: 'password', desc: 'รหัสผ่าน (ถ้าไม่ใส่จะใช้ Pmv@ + รหัสประจำตัว)', example: 'MyPass123', required: false },
];

const VALID_ROLES = ['student', 'teacher', 'staff', 'admin', 'sysadmin', 'parent'] as const;
const VALID_DEPARTMENTS = ['preschool', 'primary', 'secondary'] as const;

const ROLE_ALIASES: Record<string, ParsedUser['role']> = {
  student: 'student',
  teacher: 'teacher',
  staff: 'staff',
  admin: 'admin',
  sysadmin: 'sysadmin',
  parent: 'parent',
  'นักเรียน': 'student',
  'ครู': 'teacher',
  'เจ้าหน้าที่': 'staff',
  'ผู้บริหาร': 'admin',
  'ผู้ปกครอง': 'parent',
};

const DEPARTMENT_ALIASES: Record<string, ParsedUser['department']> = {
  preschool: 'preschool',
  early: 'preschool',
  'early-childhood': 'preschool',
  ปฐมวัย: 'preschool',
  primary: 'primary',
  ประถม: 'primary',
  ประถมศึกษา: 'primary',
  secondary: 'secondary',
  มัธยม: 'secondary',
  มัธยมศึกษา: 'secondary',
};

const HEADER_ALIASES: Record<string, string> = {
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  อีเมล: 'email',
  prefix: 'prefix',
  title: 'prefix',
  คำนำหน้า: 'prefix',
  firstname: 'firstName',
  'first name': 'firstName',
  ชื่อ: 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  นามสกุล: 'lastName',
  role: 'role',
  บทบาท: 'role',
  department: 'department',
  แผนก: 'department',
  studentcode: 'studentCode',
  'student code': 'studentCode',
  รหัสนักเรียน: 'studentCode',
  เลขประจำตัว: 'studentCode',
  phone: 'phone',
  telephone: 'phone',
  เบอร์โทร: 'phone',
  password: 'password',
  รหัสผ่าน: 'password',
};

export default function UserImportModal({ open, onClose, onImportComplete }: UserImportModalProps) {
  const [tab, setTab] = useState<ImportTab>('upload');
  const [sheetUrl, setSheetUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedUser[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  };

  const previewStats = useMemo(() => {
    if (!preview) return { ready: 0, error: 0, success: 0 };
    return preview.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { ready: 0, error: 0, success: 0 },
    );
  }, [preview]);

  const reset = () => {
    setSheetUrl('');
    setCsvFile(null);
    setPreview(null);
    setError('');
    setLoading(false);
    setImporting(false);
    setProgress(0);
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const header = TEMPLATE_COLUMNS.join(',');
    const sampleRows = [
      ['student01@pmv.com', 'นาย', 'สมชาย', 'ใจดี', 'student', 'secondary', '67001', '0812345678', ''],
      ['teacher01@pmv.com', 'ครู', 'วิชัย', 'สอนดี', 'teacher', 'primary', '', '0898765432', 'WelcomePmv'],
    ];
    const csvContent = '\ufeff' + [header, ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const normalizeHeader = (raw: string) => {
    const key = raw.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[_-]/g, ' ').trim();
    return HEADER_ALIASES[key] || raw.trim();
  };

  const parseCsvLine = (line: string, delimiter: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells.map(cell => cell.replace(/^"|"$/g, '').trim());
  };

  const detectDelimiter = (headerLine: string) => {
    const comma = (headerLine.match(/,/g) || []).length;
    const semi = (headerLine.match(/;/g) || []).length;
    return semi > comma ? ';' : ',';
  };

  const parseCsv = (text: string): ParsedUser[] => {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('ไฟล์ต้องมีอย่างน้อย 1 แถวข้อมูล');

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
    const users: ParsedUser[] = [];
    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

      const email = (row.email || '').trim().toLowerCase();
      const prefix = (row.prefix || '').trim();
      const firstName = (row.firstName || '').trim();
      const lastName = (row.lastName || '').trim();
      const rawRole = (row.role || '').trim().toLowerCase();
      const rawDepartment = (row.department || '').trim().toLowerCase();
      const studentCode = (row.studentCode || '').trim();
      const phone = (row.phone || '').trim();
      const password = (row.password || '').trim();

      if (!email && !prefix && !firstName && !lastName && !rawRole && !rawDepartment) continue;

      const role = ROLE_ALIASES[rawRole] || (rawRole as ParsedUser['role']);
      const department = DEPARTMENT_ALIASES[rawDepartment] || rawDepartment;

      const errors: string[] = [];
      if (!email) errors.push('ไม่มีอีเมล');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('อีเมลไม่ถูกต้อง');
      if (!prefix) errors.push('ไม่มีคำนำหน้า');
      if (!firstName) errors.push('ไม่มีชื่อ');
      if (!lastName) errors.push('ไม่มีนามสกุล');
      if (!role || !VALID_ROLES.includes(role)) errors.push('role ไม่ถูกต้อง');
      if ((role === 'student' || role === 'teacher') && !department) errors.push('ไม่มีแผนก');
      if (department && !VALID_DEPARTMENTS.includes(department as (typeof VALID_DEPARTMENTS)[number])) {
        errors.push('แผนกไม่ถูกต้อง');
      }
      if (seenEmails.has(email)) errors.push('อีเมลซ้ำในไฟล์เดียวกัน');

      if (email) seenEmails.add(email);

      users.push({
        id: Math.random().toString(36).substring(2, 9),
        rowNumber: i + 1,
        email,
        prefix,
        firstName,
        lastName,
        role: (role || 'staff') as ParsedUser['role'],
        department,
        studentCode,
        phone,
        password,
        status: errors.length ? 'error' : 'ready',
        errorMessage: errors.join(', ') || undefined,
      });
    }

    if (users.length === 0) throw new Error('ไม่พบข้อมูลที่สามารถนำเข้าได้');
    return users;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setCsvFile(file);
    try {
      const text = await file.text();
      setPreview(parseCsv(text));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleFetchSheet = async () => {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([\w-]+)/) || sheetUrl.match(/\/d\/([\w-]+)/);
    if (!match && !sheetUrl.includes('format=csv')) {
      setError('URL Google Sheet ไม่ถูกต้อง');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const gid = sheetUrl.match(/[?&]gid=(\d+)/)?.[1];
      const csvUrl = sheetUrl.includes('format=csv')
        ? sheetUrl
        : `https://docs.google.com/spreadsheets/d/${match![1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('ดึงข้อมูลไม่สำเร็จ — ตรวจสอบการแชร์สิทธิ์ "ทุกคนที่มีลิงก์"');
      const text = await res.text();
      setPreview(parseCsv(text));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const createAuthAccount = async (email: string, password: string, apiKey: string, retries = 3): Promise<string> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const authRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: false }),
        }
      );

      if (authRes.ok) {
        const data = await authRes.json();
        return data.localId;
      }

      const errData = await authRes.json();
      const errMsg: string = errData.error?.message || 'สร้างบัญชีไม่สำเร็จ';

      if (errMsg === 'EMAIL_EXISTS') throw new Error('อีเมลนี้มีในระบบแล้ว');

      if (errMsg.includes('TOO_MANY_ATTEMPTS') || errMsg.includes('QUOTA_EXCEEDED')) {
        if (attempt < retries - 1) {
          // Exponential backoff: 5s, 15s, 30s
          const backoff = [5000, 15000, 30000][attempt];
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
        throw new Error('Firebase rate limit — ลองใหม่ภายหลัง');
      }

      throw new Error(errMsg);
    }
    throw new Error('สร้างบัญชีไม่สำเร็จหลังลองซ้ำ');
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    const readyUsers = preview.filter(p => p.status === 'ready');
    if (readyUsers.length === 0) {
      toast.error('ไม่มีข้อมูลที่พร้อมนำเข้า กรุณาแก้แถวที่มีข้อผิดพลาด');
      return;
    }

    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
      toast.error('ไม่พบ VITE_FIREBASE_API_KEY');
      return;
    }

    setImporting(true);
    setProgress(0);
    let successCount = 0;
    let failCount = 0;
    const skippedCount = preview.length - readyUsers.length;

    for (let i = 0; i < readyUsers.length; i++) {
      const user = readyUsers[i];
      const userPassword = user.password || ('Pmv@' + (user.studentCode || '123456'));

      try {
        const uid = await createAuthAccount(user.email, userPassword, apiKey);

        window.dispatchEvent(new CustomEvent('import-user', {
          detail: { ...user, uid, password: userPassword }
        }));

        setPreview(prev => prev?.map(p => p.id === user.id ? { ...p, status: 'success', errorMessage: undefined } : p) ?? null);
        successCount++;
      } catch (err: unknown) {
        failCount++;
        const message = getErrorMessage(err);
        setPreview(prev => prev?.map(p => p.id === user.id ? { ...p, status: 'error', errorMessage: message } : p) ?? null);
        console.error(`Failed to import ${user.email}:`, message);
      }

      // Keep a safe gap to reduce Firebase signup rate-limit errors.
      await new Promise(resolve => setTimeout(resolve, 1200));

      setProgress(Math.round(((i + 1) / readyUsers.length) * 100));
    }

    toast.success(`นำเข้าสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ, ข้าม ${skippedCount} รายการ`);
    setImporting(false);
    onImportComplete();
    handleClose();
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={handleClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-[92vw] sm:max-w-4xl max-h-[88vh] flex flex-col rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border-none"
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 sm:px-6 pt-6 sm:pt-7 pb-3 border-b border-slate-100/80">
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">นำเข้าผู้ใช้งาน</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Google Sheets / CSV Bulk Import</p>
            </div>
            <button onClick={handleClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {/* Tabs */}
            <div className="flex items-center bg-slate-100/70 rounded-xl p-1 gap-1">
              {([
                { id: 'upload', label: 'ไฟล์ CSV' },
                { id: 'sheet', label: 'Google Sheets' },
              ] as Array<{ id: ImportTab; label: string }>).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setPreview(null); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-black transition-all ${tab === id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'upload' && (
              <div className="space-y-4">
                <div
                  className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 sm:p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-slate-300 hover:bg-slate-100/70 transition-all"
                  onClick={() => document.getElementById('user-csv-input')?.click()}
                >
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-700">{csvFile ? csvFile.name : 'เลือกไฟล์ CSV หรือลากมาวาง'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">UTF-8 CSV Only</p>
                  </div>
                  <input id="user-csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </div>
                <button
                  onClick={downloadTemplate}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all"
                >
                  ดาวน์โหลดไฟล์ตัวอย่าง (Template)
                </button>
              </div>
            )}

            {tab === 'sheet' && (
              <div className="space-y-4">
                <div className="rounded-2xl p-5 bg-slate-50/70 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest">การใช้งาน Google Sheets</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] font-bold text-slate-500 leading-relaxed">
                    <li>จัดเตรียมข้อมูลตามหัวข้อใน Template</li>
                    <li>ตั้งค่าการแชร์เป็น <span className="text-slate-700">"ทุกคนที่มีลิงก์"</span> และสิทธิ์เป็น <span className="text-slate-700">"ผู้ชม"</span></li>
                    <li>คัดลอกลิงก์มาวางในช่องด้านล่าง</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 h-10 rounded-xl bg-slate-50 border-none text-xs font-bold px-4 outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                  />
                  <button
                    onClick={handleFetchSheet}
                    disabled={!sheetUrl.trim() || loading}
                    className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-900/20 disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'ดึงข้อมูล'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-3">
                <p className="text-xs font-bold text-rose-600">{error}</p>
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2 gap-2 flex-wrap">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลที่พบ ({preview.length} รายการ)</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">พร้อมนำเข้า {previewStats.ready}</span>
                    <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-600">ผิดพลาด {previewStats.error}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 overflow-hidden bg-white/60">
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-3">แถว</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                          <th className="px-4 py-3">บทบาท</th>
                          <th className="px-4 py-3">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="font-bold text-slate-600">
                        {preview.slice(0, 50).map((u, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-4 py-3 text-slate-400">{u.rowNumber}</td>
                            <td className="px-4 py-3">{u.email}</td>
                            <td className="px-4 py-3">{u.prefix}{u.firstName} {u.lastName}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] uppercase">{u.role}</span>
                            </td>
                            <td className="px-4 py-3">
                              {u.status === 'ready' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] uppercase">ready</span>
                              )}
                              {u.status === 'success' && (
                                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 text-[9px] uppercase">success</span>
                              )}
                              {u.status === 'error' && (
                                <span className="text-[10px] text-rose-600" title={u.errorMessage || ''}>
                                  {u.errorMessage || 'error'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <details className="group">
              <summary className="cursor-pointer text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest list-none flex items-center gap-2 select-none">
                <span className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform">▶</span>
                ข้อกำหนดข้อมูล (Fields Guide)
              </summary>
              <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden bg-white/70">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50">
                    <tr className="font-black text-slate-400 uppercase border-b border-slate-100">
                      <th className="px-4 py-2">Field</th>
                      <th className="px-4 py-2">รายละเอียด</th>
                      <th className="px-4 py-2">ตัวอย่าง</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-slate-500">
                    {FIELD_DOCS.map(f => (
                      <tr key={f.field} className="border-b border-slate-50">
                        <td className="px-4 py-2 text-rose-600 font-mono">{f.field}</td>
                        <td className="px-4 py-2">{f.desc}</td>
                        <td className="px-4 py-2 text-slate-400">{f.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* Progress Bar */}
          {importing && (
            <div className="px-5 sm:px-6 py-3 bg-slate-50/80 border-t border-slate-100">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black text-slate-700 uppercase">กำลังนำเข้าข้อมูล...</span>
                <span className="text-[10px] font-black text-slate-700">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-slate-900"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-100/80 bg-white/55">
            <button onClick={handleClose} disabled={importing} className="h-10 px-5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all">ยกเลิก</button>
            <button
              onClick={handleImport}
              disabled={!preview || previewStats.ready === 0 || importing}
              className="h-10 px-8 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-30 hover:bg-black transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center min-w-[160px]"
            >
              {importing ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${previewStats.ready} รายการ`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
