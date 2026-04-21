import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, AlertCircle, CheckCircle2, X, ArrowLeft, Loader } from 'lucide-react';
import Papa from 'papaparse';
import type { NewStudent, Student } from '@/types/student';

interface StudentCsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: NewStudent) => Promise<Student>;
}

interface CsvRawRow {
  studentCode?: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  gradeLevel?: string;
}

interface CsvParsedRow {
  rowIndex: number;
  raw: CsvRawRow;
  data: NewStudent | null;
  errors: string[];
  isValid: boolean;
}

interface ImportResult {
  succeeded: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

const PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'];
const DEPARTMENTS = ['early', 'primary', 'secondary'];
const DEPT_LABELS: Record<string, string> = { early: 'ปฐมวัย', primary: 'ประถมศึกษา', secondary: 'มัธยมศึกษา' };

const glassPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
};

function prefixToGender(prefix: string): 'male' | 'female' {
  if (['เด็กชาย', 'นาย'].includes(prefix)) return 'male';
  return 'female';
}

function validateRow(raw: CsvRawRow, rowIndex: number, existingCodes: Set<string>): CsvParsedRow {
  const errors: string[] = [];

  // studentCode
  const studentCode = (raw.studentCode || '').trim();
  if (!studentCode) {
    errors.push('กรุณากรอกเลขประจำตัวนักเรียน');
  } else if (existingCodes.has(studentCode)) {
    errors.push(`รหัสนักเรียนซ้ำกันในไฟล์ (แถวที่ ${rowIndex})`);
  }

  // prefix
  const prefix = (raw.prefix || '').trim();
  if (!prefix) {
    errors.push('กรุณาเลือกคำนำหน้า');
  } else if (!PREFIXES.includes(prefix)) {
    errors.push('คำนำหน้าไม่ถูกต้อง (ใช้: เด็กชาย / เด็กหญิง / นาย / นางสาว)');
  }

  // firstName
  const firstName = (raw.firstName || '').trim();
  if (!firstName) {
    errors.push('กรุณากรอกชื่อ');
  }

  // lastName
  const lastName = (raw.lastName || '').trim();
  if (!lastName) {
    errors.push('กรุณากรอกนามสกุล');
  }

  // departmentId
  const departmentId = (raw.departmentId || '').trim();
  if (!departmentId) {
    errors.push('กรุณาเลือกแผนก');
  } else if (!DEPARTMENTS.includes(departmentId)) {
    errors.push('แผนกไม่ถูกต้อง (ใช้: early / primary / secondary)');
  }

  // gradeLevel
  const gradeLevel = (raw.gradeLevel || '').trim();
  if (!gradeLevel) {
    errors.push('กรุณากรอกระดับชั้น');
  }

  const isValid = errors.length === 0 && !!studentCode && !!prefix && !!firstName && !!lastName;

  const data: NewStudent | null = isValid
    ? {
        studentCode,
        prefix,
        firstName,
        lastName,
        gender: prefixToGender(prefix),
        status: 'active',
        // Optional fields with defaults
        firstNameEn: '',
        lastNameEn: '',
        birthDate: '',
        nationality: 'ไทย',
        religion: 'พุทธ',
        bloodType: undefined,
        allergies: '',
        address: '',
        guardianName: '',
        guardianPhone: '',
        guardianRelation: 'บิดา',
      }
    : null;

  return { rowIndex, raw, data, errors, isValid };
}

function downloadSampleCsv() {
  const headers = ['studentCode', 'prefix', 'firstName', 'lastName', 'departmentId', 'gradeLevel'];
  const samples = [
    ['67001', 'เด็กชาย', 'สมชาย', 'ใจดี', 'secondary', 'ม.1'],
    ['67002', 'เด็กหญิง', 'สมหญิง', 'รักเรียน', 'primary', 'ป.3'],
  ];

  const csvContent = [headers, ...samples].map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'students_sample.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function StudentCsvImportModal({ open, onClose, onImport }: StudentCsvImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedRows, setParsedRows] = useState<CsvParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetModal = () => {
    setStep('upload');
    setParsedRows([]);
    setParseError(null);
    setIsImporting(false);
    setImportResult(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('กรุณาเลือกไฟล์ CSV');
      return;
    }

    Papa.parse<CsvRawRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const rows = results.data as CsvRawRow[];
        const existingCodes = new Set<string>();

        // First pass: collect all student codes for duplicate detection
        for (const row of rows) {
          const code = (row.studentCode || '').trim();
          if (code) existingCodes.add(code);
        }

        // Second pass: validate rows
        const parsed = rows.map((row, i) => validateRow(row, i + 2, existingCodes)); // +2 because row 1 is header, display is 1-indexed

        setParsedRows(parsed);
        setParseError(null);
        setStep('preview');
      },
      error: (err) => {
        setParseError(`อ่านไฟล์ CSV ไม่สำเร็จ: ${err.message}`);
      },
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    const validRows = parsedRows.filter(r => r.isValid && r.data);
    let succeeded = 0;
    const errors: ImportResult['errors'] = [];

    for (const row of validRows) {
      try {
        await onImport(row.data!);
        succeeded++;
      } catch (e) {
        errors.push({ rowIndex: row.rowIndex, message: (e as Error).message });
      }
    }

    setImportResult({ succeeded, failed: errors.length, errors });
    setIsImporting(false);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-3xl rounded-2xl" style={glassPanel}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black/[0.04] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <Upload size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-black/80">นำเข้านักเรียนจาก CSV</h3>
                    <p className="text-[10px] text-black/40 mt-0.5">
                      {step === 'upload' ? 'อัปโหลดไฟล์ CSV' : 'ตรวจสอบข้อมูล'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {step === 'upload' && (
                  <div className="space-y-4">
                    {/* Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                        isDragging ? 'border-indigo-300 bg-indigo-50/40' : 'border-black/10 bg-white/40'
                      }`}
                    >
                      <Upload size={32} className="mx-auto mb-3 text-black/40" />
                      <p className="text-sm text-black/60 mb-1">ลากไฟล์ CSV มาวางที่นี่</p>
                      <p className="text-[11px] text-black/40">หรือ</p>
                      <label className="inline-block mt-3">
                        <span className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer underline">
                          เลือกไฟล์
                        </span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={e => {
                            if (e.target.files?.[0]) {
                              handleFileSelect(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Error Message */}
                    {parseError && (
                      <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-700">{parseError}</p>
                      </div>
                    )}

                    {/* Sample Download */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                      <p className="text-[10px] text-black/60 mb-2">ไม่รู้ format ที่ถูกต้อง?</p>
                      <button
                        onClick={downloadSampleCsv}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                      >
                        <FileText size={12} />
                        ดาวน์โหลดไฟล์ตัวอย่าง
                      </button>
                    </div>
                  </div>
                )}

                {step === 'preview' && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                      <p className="text-[11px] text-black/70">
                        <span className="font-bold">{validCount}</span> แถวพร้อมนำเข้า
                        {invalidCount > 0 && (
                          <>
                            · <span className="font-bold text-red-600">{invalidCount}</span> แถวมีข้อผิดพลาด
                          </>
                        )}
                      </p>
                    </div>

                    {/* Note */}
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-[10px] text-amber-800">
                        <span className="font-bold">หมายเหตุ:</span> ข้อมูลแผนกและระดับชั้นจะไม่ถูกบันทึกในขั้นตอนนี้ กรุณาลงทะเบียนห้องเรียนในภายหลัง
                      </p>
                    </div>

                    {/* Preview Table */}
                    <div className="overflow-x-auto border rounded-lg border-black/[0.04]">
                      <table className="w-full text-[11px]">
                        <thead className="bg-black/[0.02]">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-black/70">#</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">รหัส</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">คำนำหน้า</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">ชื่อ</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">นามสกุล</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">แผนก</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">ชั้น</th>
                            <th className="px-3 py-2 text-left font-bold text-black/70">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map(row => (
                            <tr
                              key={row.rowIndex}
                              className={`border-t border-black/[0.04] ${row.isValid ? 'bg-white' : 'bg-red-50/50'}`}
                            >
                              <td className="px-3 py-2 text-black/60">{row.rowIndex}</td>
                              <td className="px-3 py-2">{row.raw.studentCode || '—'}</td>
                              <td className="px-3 py-2">{row.raw.prefix || '—'}</td>
                              <td className="px-3 py-2">{row.raw.firstName || '—'}</td>
                              <td className="px-3 py-2">{row.raw.lastName || '—'}</td>
                              <td className="px-3 py-2">{DEPT_LABELS[row.raw.departmentId || ''] || '—'}</td>
                              <td className="px-3 py-2">{row.raw.gradeLevel || '—'}</td>
                              <td className="px-3 py-2">
                                {row.isValid ? (
                                  <span className="text-green-600 font-bold">✓</span>
                                ) : (
                                  <span className="text-red-600 font-bold">✗</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Error List */}
                    {invalidCount > 0 && (
                      <div className="space-y-2 p-3 rounded-lg bg-red-50 border border-red-200">
                        {parsedRows
                          .filter(r => !r.isValid && r.errors.length > 0)
                          .map(row => (
                            <div key={row.rowIndex} className="text-[10px]">
                              <p className="font-bold text-red-700">แถวที่ {row.rowIndex}:</p>
                              <ul className="ml-4 mt-1 space-y-0.5">
                                {row.errors.map((err, i) => (
                                  <li key={i} className="text-red-600 list-disc">
                                    {err}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {importResult && (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                      <h4 className="text-sm font-bold text-black/80">นำเข้าสำเร็จ</h4>
                      <p className="text-2xl font-bold text-green-600 mt-2">{importResult.succeeded}</p>
                      <p className="text-[11px] text-black/60">นักเรียนถูกเพิ่มเข้าระบบ</p>
                    </div>

                    {importResult.failed > 0 && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-[11px] font-bold text-red-700 mb-2">
                          ล้มเหลว: {importResult.failed} รายการ
                        </p>
                        <ul className="space-y-1">
                          {importResult.errors.map((err, i) => (
                            <li key={i} className="text-[10px] text-red-600">
                              แถวที่ {err.rowIndex}: {err.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-black/[0.04] px-6 py-3 flex items-center justify-between gap-2">
                {step === 'upload' && <div />}
                {step === 'preview' && (
                  <button
                    onClick={() => setStep('upload')}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-black/60 hover:text-black/80 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    ย้อนกลับ
                  </button>
                )}
                {importResult && <div />}

                <div className="flex items-center gap-2">
                  {step === 'upload' && (
                    <button
                      onClick={handleClose}
                      className="h-8 px-4 rounded-lg text-[11px] font-bold text-black/60 hover:bg-black/5 transition-colors"
                    >
                      ปิด
                    </button>
                  )}

                  {step === 'preview' && (
                    <button
                      onClick={handleImport}
                      disabled={validCount === 0 || isImporting}
                      className={`h-8 px-6 rounded-lg text-[11px] font-bold text-white transition-all flex items-center gap-1.5 ${
                        validCount === 0 || isImporting
                          ? 'bg-blue-400/60 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      {isImporting && <Loader size={12} className="animate-spin" />}
                      {isImporting ? 'กำลังนำเข้า...' : `นำเข้า ${validCount} รายการ`}
                    </button>
                  )}

                  {importResult && (
                    <button
                      onClick={handleClose}
                      className="h-8 px-6 rounded-lg text-[11px] font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    >
                      ปิด
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
