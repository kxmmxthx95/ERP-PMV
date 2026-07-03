import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { loadXlsx } from '@/lib/lazyXlsx';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { SUBJECT_GROUP_CONFIG } from '@/types/curriculum';
import type { NewQuestionSet } from '@/types/questionBank';
import {
  parseQuestionSetCsvText,
  parseQuestionSetRecords,
  QUESTION_SET_CSV_TEMPLATE,
  type ParsedQuestionSetRow,
} from '@/features/questionBank/utils/parseQuestionSetCsv';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (sets: NewQuestionSet[]) => Promise<void>;
}

export default function QuestionSetImportModal({ open, onClose, onImport }: Props) {
  const { year } = useActiveAcademicYear();
  const curriculumYear = year ?? '';
  const [rows, setRows] = useState<ParsedQuestionSetRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readyRows = rows.filter((row) => row.status === 'ready');

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.aoa_to_sheet([
      ['ชื่อชุด', 'คำอธิบาย', 'กลุ่มสาระ', 'สาระย่อย', 'แผนก', 'ระดับชั้น', 'ประเภทข้อสอบ'],
      ['ONET-67-P6-SCI', 'ตัวอย่างชุดวิทยาศาสตร์', 'onet', 'วิทยาศาสตร์ทั่วไป', 'primary', 'ป.6', 'multiple_choice'],
      ['ONET-67-P6-MATH', '', 'math', 'คณิตศาสตร์พื้นฐาน', 'primary', 'ป.6', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'QuestionSets');
    XLSX.writeFile(wb, 'question_set_template.xlsx');
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([`\uFEFF${QUESTION_SET_CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'question_set_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        if (isCsv) {
          const text = String(evt.target?.result ?? '');
          setRows(parseQuestionSetCsvText(text, curriculumYear));
        } else {
          const XLSX = await loadXlsx();
          const wb = XLSX.read(evt.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
          setRows(parseQuestionSetRecords(data, curriculumYear));
        }
      } catch (err) {
        console.error(err);
        setRows([]);
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleImport = async () => {
    if (readyRows.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(
        readyRows.map((row) => ({
          ...row.data,
          curriculumYear,
          createdBy: '',
          createdByName: '',
        })),
      );
      setRows([]);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2.5rem] border border-white bg-slate-50 shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-sukhumvit text-lg font-black leading-none text-slate-800">
                    นำเข้าชุดข้อสอบจาก CSV/Excel
                  </h3>
                  <p className="mt-1 font-sarabun text-[11px] font-bold text-slate-400">
                    อัปโหลดไฟล์เพื่อสร้างหลายชุดข้อสอบในครั้งเดียว
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {rows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] border border-slate-200 bg-white text-slate-300">
                    <Upload size={32} />
                  </div>
                  <h4 className="mb-2 font-sukhumvit text-[16px] font-black text-slate-700">
                    ยังไม่มีข้อมูลที่จะนำเข้า
                  </h4>
                  <p className="mb-8 max-w-md text-center font-sarabun text-[13px] font-medium text-slate-400">
                    ดาวน์โหลด Template แล้วกรอกชื่อชุด กลุ่มสาระ แผนก และระดับชั้น
                    คอลัมน์กลุ่มสาระใช้รหัส เช่น onet, math, science หรือชื่อภาษาไทย
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void downloadTemplate()}
                      className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-sukhumvit text-[13px] font-black text-slate-600 transition-all hover:bg-slate-50"
                    >
                      <Download size={16} />
                      Template Excel
                    </button>
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-sukhumvit text-[13px] font-black text-slate-600 transition-all hover:bg-slate-50"
                    >
                      <Download size={16} />
                      Template CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-8 font-sukhumvit text-[13px] font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isProcessing ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์เพื่ออัปโหลด'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      พบ {rows.length} ชุด · พร้อมนำเข้า {readyRows.length} ชุด
                    </span>
                    <button
                      type="button"
                      onClick={() => setRows([])}
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      ล้างข้อมูล
                    </button>
                  </div>

                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        row.status === 'error'
                          ? 'border-rose-100 bg-rose-50/50'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-sukhumvit text-[14px] font-black text-slate-800">
                            {row.data.title || '(ไม่มีชื่อ)'}
                          </p>
                          {row.data.description ? (
                            <p className="mt-0.5 line-clamp-1 font-sarabun text-[12px] text-slate-500">
                              {row.data.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600">
                              {SUBJECT_GROUP_CONFIG[row.data.subjectGroup]?.name ?? row.data.subjectGroup}
                            </span>
                            {row.data.gradeLevel ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                {row.data.gradeLevel}
                              </span>
                            ) : null}
                            {row.data.subSubjectGroup ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                {row.data.subSubjectGroup}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {row.status === 'error' ? (
                          <div className="flex shrink-0 items-start gap-2 text-rose-500">
                            <AlertCircle size={16} />
                            <span className="font-sukhumvit text-[12px] font-bold">{row.error}</span>
                          </div>
                        ) : (
                          <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white p-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info size={14} />
                  <span className="font-sarabun text-[11px] font-bold">
                    เฉพาะแถวที่ไม่มีข้อผิดพลาดจะถูกสร้างเป็นชุดข้อสอบใหม่
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-6 font-sukhumvit text-[13px] font-black text-slate-600"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={isImporting || readyRows.length === 0}
                    className="flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-8 font-sukhumvit text-[13px] font-black text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    ยืนยันนำเข้า {readyRows.length} ชุด
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
