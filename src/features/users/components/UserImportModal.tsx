import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileSpreadsheet, Link, AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedUser {
  id: string;
  email: string;
  prefix: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher' | 'staff' | 'admin';
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
  { field: 'role', desc: 'บทบาท (student/teacher/staff)', example: 'student', required: true },
  { field: 'department', desc: 'แผนก (early/primary/secondary)', example: 'secondary', required: true },
  { field: 'studentCode', desc: 'เลขประจำตัว (สำหรับนักเรียน)', example: '67001', required: false },
  { field: 'phone', desc: 'เบอร์โทรศัพท์', example: '0812345678', required: false },
  { field: 'password', desc: 'รหัสผ่าน (ถ้าไม่ใส่จะใช้ Pmv@ + รหัสประจำตัว)', example: 'MyPass123', required: false },
];

export default function UserImportModal({ open, onClose, onImportComplete }: UserImportModalProps) {
  const [tab, setTab] = useState<'upload' | 'sheet'>('upload');
  const [sheetUrl, setSheetUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedUser[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const parseCsv = (text: string): ParsedUser[] => {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('ไฟล์ต้องมีอย่างน้อย 1 แถวข้อมูล');

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const users: ParsedUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

      if (!row.email || !row.firstName || !row.lastName || !row.role) continue;

      users.push({
        id: Math.random().toString(36).substring(2, 9),
        email: row.email,
        prefix: row.prefix,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role as any,
        department: row.department,
        studentCode: row.studentCode,
        phone: row.phone,
        password: row.password,
        status: 'ready'
      });
    }
    return users;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    try {
      const text = await file.text();
      setPreview(parseCsv(text));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFetchSheet = async () => {
    const match = sheetUrl.match(/\/d\/([\w-]+)/);
    if (!match) {
      setError('URL Google Sheet ไม่ถูกต้อง');
      return;
    }
    setLoading(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('ดึงข้อมูลไม่สำเร็จ — ตรวจสอบการแชร์สิทธิ์ "ทุกคนที่มีลิงก์"');
      const text = await res.text();
      setPreview(parseCsv(text));
    } catch (err: any) {
      setError(err.message);
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
    setImporting(true);
    setProgress(0);

    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < preview.length; i++) {
      const user = preview[i];
      const userPassword = user.password || ('Pmv@' + (user.studentCode || '123456'));

      try {
        const uid = await createAuthAccount(user.email, userPassword, apiKey);

        window.dispatchEvent(new CustomEvent('import-user', {
          detail: { ...user, uid, password: userPassword }
        }));

        successCount++;
      } catch (err: any) {
        failCount++;
        console.error(`Failed to import ${user.email}:`, err.message);
      }

      // 1.5s gap between accounts to stay well under Firebase's rate limit
      await new Promise(resolve => setTimeout(resolve, 1500));

      setProgress(Math.round(((i + 1) / preview.length) * 100));
    }

    toast.success(`นำเข้าสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`);
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
          className="fixed inset-0 bg-black/40 backdrop-blur-md"
          onClick={handleClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/95 backdrop-blur-2xl border border-white"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <UserPlus size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-slate-800">นำเข้าผู้ใช้งาน</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Google Sheets / CSV Bulk Import</p>
            </div>
            <button onClick={handleClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {/* Tabs */}
            <div className="flex items-center bg-slate-100/50 rounded-2xl p-1.5 gap-1">
              {[
                { id: 'upload', label: 'ไฟล์ CSV', icon: FileSpreadsheet },
                { id: 'sheet', label: 'Google Sheets', icon: Link },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id as any); setPreview(null); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${tab === id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {tab === 'upload' && (
              <div className="space-y-4">
                <div
                  className="rounded-[2rem] border-2 border-dashed border-slate-200 p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                  onClick={() => document.getElementById('user-csv-input')?.click()}
                >
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                    <FileSpreadsheet size={32} className="text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-slate-700">{csvFile ? csvFile.name : 'เลือกไฟล์ CSV หรือลากมาวาง'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">UTF-8 CSV Only</p>
                  </div>
                  <input id="user-csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </div>
                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-600 transition-all"
                >
                  <Download size={14} />
                  ดาวน์โหลดไฟล์ตัวอย่าง (Template)
                </button>
              </div>
            )}

            {tab === 'sheet' && (
              <div className="space-y-6">
                <div className="rounded-[2rem] p-6 bg-indigo-50/50 border border-indigo-100/50 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <AlertCircle size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">การใช้งาน Google Sheets</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-[11px] font-bold text-slate-500 leading-relaxed">
                    <li>จัดเตรียมข้อมูลตามหัวข้อใน Template</li>
                    <li>ตั้งค่าการแชร์เป็น <span className="text-indigo-600">"ทุกคนที่มีลิงก์"</span> และสิทธิ์เป็น <span className="text-indigo-600">"ผู้ชม"</span></li>
                    <li>คัดลอกลิงก์มาวางในช่องด้านล่าง</li>
                  </ol>
                </div>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50 bg-white transition-all"
                  />
                  <button
                    onClick={handleFetchSheet}
                    disabled={!sheetUrl.trim() || loading}
                    className="px-6 py-4 rounded-2xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'ดึงข้อมูล'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex gap-3">
                <AlertCircle size={18} className="text-rose-500 shrink-0" />
                <p className="text-xs font-bold text-rose-600">{error}</p>
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลที่พบ ({preview.length} รายการ)</p>
                </div>
                <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white/50">
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                          <th className="px-4 py-3">บทบาท</th>
                        </tr>
                      </thead>
                      <tbody className="font-bold text-slate-600">
                        {preview.slice(0, 50).map((u, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-4 py-3">{u.email}</td>
                            <td className="px-4 py-3">{u.prefix}{u.firstName} {u.lastName}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] uppercase">{u.role}</span>
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
              <div className="mt-4 rounded-2xl border border-slate-100 overflow-hidden">
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
                        <td className="px-4 py-2 text-indigo-600 font-mono">{f.field}</td>
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
            <div className="px-8 py-4 bg-indigo-50 border-t border-indigo-100">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase">กำลังนำเข้าข้อมูล...</span>
                <span className="text-[10px] font-black text-indigo-600">{progress}%</span>
              </div>
              <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-8 py-6 border-t border-slate-100 bg-slate-50/50">
            <button onClick={handleClose} disabled={importing} className="px-6 py-3 rounded-full text-xs font-black text-slate-400 hover:text-slate-600 transition-all">ยกเลิก</button>
            <button
              onClick={handleImport}
              disabled={!preview || preview.length === 0 || importing}
              className="px-10 py-3 rounded-full bg-slate-900 text-white text-xs font-black disabled:opacity-30 hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center gap-2"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${preview?.length || 0} รายการ`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
