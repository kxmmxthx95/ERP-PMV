import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, FileSpreadsheet, Download, Upload, AlertCircle, 
  CheckCircle2, Loader2, Info
} from 'lucide-react';
import { loadXlsx } from '@/lib/lazyXlsx';
import type { QuestionDifficulty, QuestionType, NewQuestion, MultipleChoiceOption } from '@/types/questionBank';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (questions: NewQuestion[]) => Promise<void>;
}

interface ParsedRow {
  id: string;
  questionText: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  options: string[];
  correctAnswer: number; // 1-4
  status: 'ready' | 'error';
  error?: string;
}

export default function QuestionImportModal({ open, onClose, onImport }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = [
      'โจทย์', 
      'ความยาก (easy/medium/hard)', 
      'ตัวเลือก 1', 
      'ตัวเลือก 2', 
      'ตัวเลือก 3', 
      'ตัวเลือก 4', 
      'เฉลยข้อ (1-4)'
    ];
    const sample = [
      '1 + 1 เท่ากับเท่าใด?', 'easy', '1', '2', '3', '4', '2'
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'question_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await loadXlsx();
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const parsed: ParsedRow[] = data.map((row: any, idx: number) => {
          const questionText = row['โจทย์'] || row['questionText'] || '';
          let difficulty: QuestionDifficulty = (row['ความยาก (easy/medium/hard)'] || row['difficulty'] || 'medium').toLowerCase() as QuestionDifficulty;
          if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';

          const options = [
            String(row['ตัวเลือก 1'] || row['option1'] || ''),
            String(row['ตัวเลือก 2'] || row['option2'] || ''),
            String(row['ตัวเลือก 3'] || row['option3'] || ''),
            String(row['ตัวเลือก 4'] || row['option4'] || ''),
          ].filter(Boolean);

          const correctAnswer = parseInt(row['เฉลยข้อ (1-4)'] || row['correctAnswer'] || '0');

          let status: 'ready' | 'error' = 'ready';
          let error = '';

          if (!questionText) {
            status = 'error';
            error = 'ไม่มีโจทย์';
          } else if (options.length < 2) {
            status = 'error';
            error = 'ตัวเลือกต้องมีอย่างน้อย 2 ข้อ';
          } else if (isNaN(correctAnswer) || correctAnswer < 1 || correctAnswer > options.length) {
            status = 'error';
            error = 'เฉลยไม่ถูกต้อง';
          }

          return {
            id: `temp-${idx}`,
            questionText,
            difficulty,
            type: 'multiple_choice',
            options,
            correctAnswer,
            status,
            error
          };
        });

        setRows(parsed);
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    const readyRows = rows.filter(r => r.status === 'ready');
    if (readyRows.length === 0) return;

    setIsImporting(true);
    try {
      const questions: NewQuestion[] = readyRows.map(r => {
        const mcOptions: MultipleChoiceOption[] = r.options.map((text, idx) => ({
          id: crypto.randomUUID(),
          text,
          isCorrect: idx === r.correctAnswer - 1
        }));

        return {
          questionText: r.questionText,
          difficulty: r.difficulty,
          type: 'multiple_choice',
          curriculumYear: '', // Added to satisfy TypeScript, will be enriched by manager
          images: [],
          payload: { options: mcOptions },
          createdBy: '', 
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      });

      await onImport(questions);
      onClose();
      setRows([]);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการนำเข้า');
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
            className="relative w-full max-w-4xl max-h-[80vh] bg-slate-50 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 font-sukhumvit leading-none">นำเข้าข้อสอบจาก CSV/Excel</h3>
                  <p className="text-[11px] font-bold text-slate-400 font-sarabun mt-1">อัปโหลดไฟล์เพื่อเพิ่มข้อสอบจำนวนมากในครั้งเดียว</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {rows.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12">
                  <div className="w-20 h-20 rounded-[2rem] bg-white border border-slate-200 flex items-center justify-center mb-6 text-slate-300">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-[16px] font-black text-slate-700 font-sukhumvit mb-2">ยังไม่มีข้อมูลที่จะนำเข้า</h4>
                  <p className="text-[13px] font-medium text-slate-400 font-sarabun text-center max-w-xs mb-8">
                    กรุณาดาวน์โหลด Template และกรอกข้อมูลข้อสอบให้ครบถ้วนก่อนทำการอัปโหลด
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={downloadTemplate}
                      className="h-11 px-6 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                      <Download size={16} />
                      ดาวน์โหลด Template
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="h-11 px-8 rounded-2xl bg-slate-900 text-white text-[13px] font-black font-sukhumvit flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      {isProcessing ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์เพื่ออัปโหลด'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      พบข้อมูล {rows.length} ข้อ
                    </span>
                    <button
                      onClick={() => setRows([])}
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      ล้างข้อมูล
                    </button>
                  </div>
                  
                  {rows.map((row) => (
                    <div 
                      key={row.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        row.status === 'error' 
                          ? 'bg-rose-50/50 border-rose-100' 
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-slate-700 font-sarabun line-clamp-2">
                            {row.questionText}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              row.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-600' :
                              row.difficulty === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-rose-100 text-rose-600'
                            }`}>
                              {row.difficulty}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              {row.options.length} ตัวเลือก • เฉลยข้อ {row.correctAnswer}
                            </span>
                          </div>
                        </div>
                        {row.status === 'error' && (
                          <div className="flex items-start gap-2 text-rose-500 shrink-0">
                            <AlertCircle size={16} />
                            <span className="text-[12px] font-bold font-sukhumvit">{row.error}</span>
                          </div>
                        )}
                        {row.status === 'ready' && (
                          <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {rows.length > 0 && (
              <div className="p-6 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info size={14} />
                  <span className="text-[11px] font-bold font-sarabun">
                    เฉพาะข้อที่สถานะเป็นสีเขียวเท่านั้นที่จะถูกนำเข้า
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="h-11 px-6 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || rows.filter(r => r.status === 'ready').length === 0}
                    className="h-11 px-8 rounded-2xl bg-indigo-600 text-white text-[13px] font-black font-sukhumvit flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isImporting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    ยืนยันนำเข้า {rows.filter(r => r.status === 'ready').length} ข้อ
                  </button>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
