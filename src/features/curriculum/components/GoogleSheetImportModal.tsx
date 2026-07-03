import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark, HiArrowDownTray, HiTableCells, HiLink, HiExclamationCircle, HiCheckCircle, HiArrowPath, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import type { NewCurriculumCourse } from '@/types/curriculum';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (courses: NewCurriculumCourse[]) => Promise<void>;
}

// CSV template columns (order matters)
const TEMPLATE_COLUMNS = [
  'courseCode',
  'courseName',
  'credit',
  'periodsPerWeek',
  'totalHours',
  'category',
  'department',
  'subjectGroup',
  'gradeLevel',
  'semester',
  'academicYear',
];

const FIELD_DOCS = [
  { field: 'courseCode', desc: 'รหัสวิชา', example: 'T11101', required: true },
  { field: 'courseName', desc: 'ชื่อวิชา', example: 'ภาษาไทย 1', required: true },
  { field: 'credit', desc: 'จำนวนหน่วยกิต', example: '1.0', required: true },
  { field: 'periodsPerWeek', desc: 'คาบ/สัปดาห์', example: '2', required: false },
  { field: 'totalHours', desc: 'ชั่วโมงรวม', example: '40', required: false },
  { field: 'category', desc: 'ประเภทวิชา: basic / additional / activity', example: 'basic', required: true },
  { field: 'department', desc: 'แผนก: early / primary / secondary', example: 'secondary', required: true },
  { field: 'subjectGroup', desc: 'กลุ่มสาระ: thai / math / science / social / pe / arts / careers / foreign / other', example: 'thai', required: false },
  { field: 'gradeLevel', desc: 'ระดับชั้น', example: 'ม.1', required: false },
  { field: 'semester', desc: 'ภาคเรียน: 1 หรือ 2', example: '1', required: false },
  { field: 'academicYear', desc: 'ปีการศึกษา (พ.ศ.)', example: '2568', required: false },
];

const SAMPLE_ROWS = [
  ['T11101', 'ภาษาไทย 1', '1.0', '2', '40', 'basic', 'secondary', 'thai', 'ม.1', '1', '2568'],
  ['M11101', 'คณิตศาสตร์ 1', '1.5', '3', '60', 'basic', 'secondary', 'math', 'ม.1', '1', '2568'],
  ['A11101', 'ชุมนุม', '0', '2', '40', 'activity', 'secondary', 'other', 'ม.1', '', '2568'],
];

function buildCsvContent(): string {
  const header = TEMPLATE_COLUMNS.join(',');
  const rows = SAMPLE_ROWS.map(r => r.join(','));
  return [header, ...rows].join('\n');
}

function downloadTemplate() {
  const blob = new Blob(['﻿' + buildCsvContent()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'curriculum_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function mapSubjectGroup(val: string): string | undefined {
  if (!val) return undefined;
  const v = val.trim().toLowerCase();
  
  // English keys
  const keys = ['thai', 'math', 'science', 'social', 'pe', 'arts', 'careers', 'foreign', 'other'];
  if (keys.includes(v)) return v;

  // Thai Mapping
  if (v.includes('ไทย')) return 'thai';
  if (v.includes('คณิต')) return 'math';
  if (v.includes('วิทย์') || v.includes('เทคโนโลยี')) return 'science';
  if (v.includes('สังคม')) return 'social';
  if (v.includes('สุข') || v.includes('พละ')) return 'pe';
  if (v.includes('ศิลปะ')) return 'arts';
  if (v.includes('การงาน')) return 'careers';
  if (v.includes('ต่างประเทศ') || v.includes('อังกฤษ')) return 'foreign';
  if (v.includes('อื่น') || v.includes('กิจกรรม')) return 'other';

  return undefined;
}

function mapCategory(val: string): 'basic' | 'additional' | 'activity' {
  const v = val?.trim().toLowerCase() || '';
  if (v === 'additional' || v.includes('เพิ่มเติม')) return 'additional';
  if (v === 'activity' || v.includes('กิจกรรม')) return 'activity';
  return 'basic'; // default
}

function mapDepartment(val: string): 'early' | 'primary' | 'secondary' {
  const v = val?.trim().toLowerCase() || '';
  if (v === 'early' || v.includes('ปฐมวัย')) return 'early';
  if (v === 'primary' || v.includes('ประถม')) return 'primary';
  if (v === 'secondary' || v.includes('มัธยม')) return 'secondary';
  return 'secondary'; // default
}

function parseCsv(text: string): NewCurriculumCourse[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (นอกจาก header)');

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const courses: (NewCurriculumCourse & { _error?: string })[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    const errors: string[] = [];
    if (!row.courseCode) errors.push('ขาดรหัสวิชา');
    if (!row.courseName) errors.push('ขาดชื่อวิชา');
    if (!row.credit && row.category !== 'activity') errors.push('ขาดหน่วยกิต');
    if (!row.category) errors.push('ขาดประเภทวิชา');
    if (!row.department) errors.push('ขาดแผนก');

    const category = mapCategory(row.category);
    const department = mapDepartment(row.department);

    courses.push({
      courseCode: row.courseCode || '',
      courseName: row.courseName || '',
      credit: parseFloat(row.credit) || 0,
      periodsPerWeek: row.periodsPerWeek ? parseInt(row.periodsPerWeek) : undefined,
      totalHours: row.totalHours ? parseInt(row.totalHours) : undefined,
      category,
      department,
      subjectGroup: mapSubjectGroup(row.subjectGroup),
      gradeLevel: row.gradeLevel || undefined,
      semester: row.semester ? parseInt(row.semester) : undefined,
      academicYear: row.academicYear ? parseInt(row.academicYear) : (new Date().getFullYear() + 543),
      _error: errors.length > 0 ? errors.join(', ') : undefined,
    });
  }

  if (courses.length === 0) throw new Error('ไม่พบข้อมูลวิชาที่ถูกต้องในไฟล์');
  return courses;
}

async function fetchGoogleSheet(sheetUrl: string): Promise<NewCurriculumCourse[]> {
  // Extract sheet ID from URL
  const match = sheetUrl.match(/\/d\/([\w-]+)/);
  if (!match) throw new Error('URL Google Sheet ไม่ถูกต้อง');
  const sheetId = match[1];

  // Try to get CSV export URL
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ — ตรวจสอบว่า Sheet ตั้งค่าเป็น "ทุกคนที่มีลิงก์" และ "ผู้ชม"');
  const text = await res.text();
  return parseCsv(text);
}

export default function GoogleSheetImportModal({ open, onClose, onImport }: Props) {
  const [tab, setTab] = useState<'template' | 'sheet'>('template');
  const [sheetUrl, setSheetUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<(NewCurriculumCourse & { _error?: string })[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setSheetUrl('');
    setCsvFile(null);
    setPreview(null);
    setError('');
    setLoading(false);
    setImporting(false);
    setDone(false);
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
      const courses = parseCsv(text);
      setPreview(courses);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  const handleFetchSheet = async () => {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const courses = await fetchGoogleSheet(sheetUrl.trim());
      setPreview(courses);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    const validCourses = preview
      .filter(c => !c._error)
      .map(({ _error, ...rest }) => rest); // Remove _error field before saving to Firestore
      
    if (validCourses.length === 0) {
      setError('ไม่พบข้อมูลที่ถูกต้องสำหรับนำเข้า');
      return;
    }
    setImporting(true);
    try {
      await onImport(validCourses);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดขณะนำเข้าข้อมูล');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.90)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <HiTableCells size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-black text-slate-800 font-sarabun">นำเข้าวิชาจาก CSV / Google Sheet</h2>
                <p className="text-[11px] text-slate-400 font-sarabun mt-0.5">โหลด template หรือเชื่อมต่อ Google Sheet</p>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                <HiXMark size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Success */}
              {done ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <HiCheckCircle size={32} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-black text-slate-700 font-sarabun">นำเข้า {preview?.length} วิชาสำเร็จ</p>
                  <button onClick={handleClose} className="px-6 py-2 bg-slate-900 text-white text-xs font-black rounded-full font-sarabun">ปิด</button>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                    {[
                      { id: 'template' as const, label: 'อัปโหลด CSV', icon: HiArrowDownTray },
                      { id: 'sheet' as const, label: 'Google Sheet URL', icon: HiLink },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => { setTab(id); setPreview(null); setError(''); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black transition-all font-sarabun ${tab === id ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: CSV Upload */}
                  {tab === 'template' && (
                    <div className="space-y-4">
                      <div
                        className="rounded-xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center gap-3 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                      >
                        <HiTableCells size={28} className="text-slate-300" />
                        <div className="text-center">
                          <p className="text-xs font-black text-slate-600 font-sarabun">{csvFile ? csvFile.name : 'คลิกเพื่อเลือกไฟล์ CSV'}</p>
                          <p className="text-[10px] text-slate-400 font-sarabun mt-1">รองรับ .csv เท่านั้น</p>
                        </div>
                        <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                      </div>

                      <button
                        onClick={downloadTemplate}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-[11px] font-black text-slate-600 transition-all font-sarabun"
                      >
                        <HiArrowDownTray size={13} />
                        ดาวน์โหลด Template CSV
                      </button>
                    </div>
                  )}

                  {/* Tab: Google Sheet */}
                  {tab === 'sheet' && (
                    <div className="space-y-4">
                      <div
                        className="rounded-xl p-4 text-[11px] text-slate-500 font-sarabun space-y-1.5 leading-relaxed"
                        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}
                      >
                        <p className="font-black text-sky-600">วิธีเตรียม Google Sheet</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-500">
                          <li>สร้าง Google Sheet และตั้ง header ตาม template</li>
                          <li>กดปุ่ม "แชร์" → เปลี่ยนเป็น <strong>"ทุกคนที่มีลิงก์"</strong> + <strong>"ผู้ชม"</strong></li>
                          <li>วาง URL ด้านล่าง</li>
                        </ol>
                        <a
                          href="https://docs.google.com/spreadsheets/create"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-500 hover:underline font-black mt-1"
                        >
                          <HiArrowTopRightOnSquare size={11} />
                          เปิด Google Sheets
                        </a>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={sheetUrl}
                          onChange={e => setSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-[11px] font-sarabun outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 bg-white"
                        />
                        <button
                          onClick={handleFetchSheet}
                          disabled={!sheetUrl.trim() || loading}
                          className="px-4 py-2.5 rounded-xl bg-sky-500 text-white text-[11px] font-black disabled:opacity-40 hover:bg-sky-600 transition-all font-sarabun flex items-center gap-1.5"
                        >
                          {loading ? <HiArrowPath size={13} className="animate-spin" /> : <HiLink size={13} />}
                          {loading ? 'กำลังดึง...' : 'ดึงข้อมูล'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
                      <HiExclamationCircle size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-rose-600 font-sarabun">{error}</p>
                    </div>
                  )}

                  {/* Preview */}
                  {preview && preview.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black text-slate-600 font-sarabun">ตัวอย่างข้อมูล ({preview.length} รายการ)</p>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full font-sarabun">พร้อมนำเข้า</span>
                      </div>
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto max-h-52">
                          <table className="w-full text-[10px] font-sarabun">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-3 py-2 text-left font-black text-slate-500">รหัส</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">ชื่อวิชา</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">หน่วยกิต</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">ประเภท</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">แผนก</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">ระดับชั้น</th>
                                <th className="px-3 py-2 text-left font-black text-slate-500">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.slice(0, 20).map((c, i) => (
                                <tr key={i} className={`border-b border-slate-50 transition-colors ${c._error ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50/50'}`}>
                                  <td className="px-3 py-1.5 font-mono text-slate-600">{c.courseCode || '-'}</td>
                                  <td className="px-3 py-1.5 text-slate-700">{c.courseName || '-'}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{c.credit}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{c.category}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{c.department}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{c.gradeLevel ?? '-'}</td>
                                  <td className="px-3 py-1.5">
                                    {c._error ? (
                                      <span className="text-[9px] font-bold text-rose-500 bg-rose-100/50 px-1.5 py-0.5 rounded uppercase">{c._error}</span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-emerald-500">OK</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {preview.length > 20 && (
                                <tr>
                                  <td colSpan={6} className="px-3 py-2 text-center text-slate-400">... และอีก {preview.length - 20} รายการ</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field Guide */}
                  <details className="group">
                    <summary className="cursor-pointer text-[11px] font-black text-slate-400 hover:text-slate-600 font-sarabun list-none flex items-center gap-1.5 select-none">
                      <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-[9px] group-open:rotate-90 transition-transform">▶</span>
                      คำอธิบาย Field ทั้งหมด
                    </summary>
                    <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-[10px] font-sarabun">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-black text-slate-500 w-32">Field</th>
                            <th className="px-3 py-2 text-left font-black text-slate-500">คำอธิบาย</th>
                            <th className="px-3 py-2 text-left font-black text-slate-500 w-24">ตัวอย่าง</th>
                            <th className="px-3 py-2 text-left font-black text-slate-500 w-16">จำเป็น</th>
                          </tr>
                        </thead>
                        <tbody>
                          {FIELD_DOCS.map(f => (
                            <tr key={f.field} className="border-b border-slate-50">
                              <td className="px-3 py-1.5 font-mono text-sky-600">{f.field}</td>
                              <td className="px-3 py-1.5 text-slate-500">{f.desc}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-400">{f.example}</td>
                              <td className="px-3 py-1.5">{f.required ? <span className="text-rose-500 font-black">✓</span> : <span className="text-slate-300">-</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </div>

            {/* Footer */}
            {!done && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button onClick={handleClose} className="px-5 py-2 rounded-full text-[11px] font-black text-slate-500 hover:bg-slate-100 transition-all font-sarabun">ยกเลิก</button>
                <button
                  onClick={handleImport}
                  disabled={!preview || preview.length === 0 || importing}
                  className="px-6 py-2 rounded-full bg-emerald-500 text-white text-[11px] font-black disabled:opacity-40 hover:bg-emerald-600 transition-all font-sarabun flex items-center gap-2"
                >
                  {importing ? <HiArrowPath size={13} className="animate-spin" /> : <HiTableCells size={13} />}
                  {importing ? 'กำลังนำเข้า...' : `นำเข้า ${preview ? preview.length : 0} วิชา`}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
