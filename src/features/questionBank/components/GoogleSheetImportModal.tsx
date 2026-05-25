import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Link2, Download, CheckCircle2, AlertCircle,
  Loader2, Info, RefreshCw, ExternalLink, Table2
} from 'lucide-react';
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
  correctAnswer: number; // 1-based
  status: 'ready' | 'error';
  error?: string;
}

// แปลง Google Sheets URL → CSV export URL
function toCSVExportUrl(input: string): string | null {
  // รองรับหลายรูปแบบ URL
  const patterns = [
    /spreadsheets\/d\/([a-zA-Z0-9-_]+).*gid=(\d+)/,
    /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const id = match[1];
      const gid = match[2] ?? '0';
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
  }
  return null;
}

function parseCSV(csvText: string): ParsedRow[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = splitCSVLine(headerLine).map(h => h.toLowerCase().trim());

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const get = (keys: string[]) => {
      for (const k of keys) {
        const idx = headers.indexOf(k);
        if (idx !== -1 && cols[idx]) return cols[idx].trim();
      }
      return '';
    };

    const questionText =
      get(['โจทย์', 'question', 'questiontext', 'คำถาม']) ||
      cols[0]?.trim() || '';

    const rawDiff = get(['ความยาก (easy/medium/hard)', 'ความยาก', 'difficulty', 'level']).toLowerCase();
    let difficulty: QuestionDifficulty = 'medium';
    if (['easy', 'ง่าย'].includes(rawDiff)) difficulty = 'easy';
    else if (['hard', 'ยาก'].includes(rawDiff)) difficulty = 'hard';

    const options = [
      get(['ตัวเลือก 1', 'option1', 'choice1', 'ก']),
      get(['ตัวเลือก 2', 'option2', 'choice2', 'ข']),
      get(['ตัวเลือก 3', 'option3', 'choice3', 'ค']),
      get(['ตัวเลือก 4', 'option4', 'choice4', 'ง']),
    ].filter(Boolean);

    const rawCorrect = get(['เฉลยข้อ (1-4)', 'เฉลย', 'answer', 'correctanswer', 'correct']);
    const correctAnswer = parseInt(rawCorrect) || 0;

    let status: 'ready' | 'error' = 'ready';
    let error = '';
    if (!questionText) { status = 'error'; error = 'ไม่มีโจทย์'; }
    else if (options.length < 2) { status = 'error'; error = 'ตัวเลือกต้องมีอย่างน้อย 2 ข้อ'; }
    else if (isNaN(correctAnswer) || correctAnswer < 1 || correctAnswer > options.length) {
      status = 'error'; error = 'เฉลยไม่ถูกต้อง';
    }

    rows.push({ id: `row-${i}`, questionText, difficulty, type: 'multiple_choice', options, correctAnswer, status, error });
  }

  return rows;
}

// Simple CSV line splitter (handles quoted fields)
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const COLUMNS_INFO = [
  { col: 'โจทย์', desc: 'ข้อความโจทย์ (บังคับ)', required: true },
  { col: 'ความยาก (easy/medium/hard)', desc: 'ระดับความยาก', required: false },
  { col: 'ตัวเลือก 1', desc: 'ตัวเลือก ก (บังคับ)', required: true },
  { col: 'ตัวเลือก 2', desc: 'ตัวเลือก ข (บังคับ)', required: true },
  { col: 'ตัวเลือก 3', desc: 'ตัวเลือก ค', required: false },
  { col: 'ตัวเลือก 4', desc: 'ตัวเลือก ง', required: false },
  { col: 'เฉลยข้อ (1-4)', desc: 'ตัวเลข 1–4 บอกข้อที่ถูก (บังคับ)', required: true },
];

export default function GoogleSheetImportModal({ open, onClose, onImport }: Props) {
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) return;
    const csvUrl = toCSVExportUrl(url.trim());
    if (!csvUrl) {
      setFetchError('URL ไม่ถูกต้อง กรุณาใส่ลิงก์ Google Sheets ที่ถูกต้อง');
      return;
    }

    setIsFetching(true);
    setFetchError('');
    setRows([]);

    try {
      // ต้อง share sheet แบบ "Anyone with the link"
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        throw new Error('ไม่สามารถเข้าถึง Sheet ได้ กรุณาตรวจสอบการแชร์ (Share → Anyone with the link → Viewer)');
      }
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setFetchError('ไม่พบข้อมูลใน Sheet หรือรูปแบบไม่ถูกต้อง');
        return;
      }
      setRows(parsed);
    } catch (err: any) {
      setFetchError(err.message || 'ดึงข้อมูลไม่สำเร็จ กรุณาตรวจสอบลิงก์และการแชร์');
    } finally {
      setIsFetching(false);
    }
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
          isCorrect: idx === r.correctAnswer - 1,
        }));
        return {
          questionText: r.questionText,
          difficulty: r.difficulty,
          type: 'multiple_choice',
          curriculumYear: '',
          images: [],
          payload: { options: mcOptions },
          createdBy: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      });

      await onImport(questions);
      handleClose();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการนำเข้า');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setRows([]);
    setFetchError('');
    setShowGuide(false);
    onClose();
  };

  const readyCount = rows.filter(r => r.status === 'ready').length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl max-h-[85vh] bg-slate-50 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #34a853 100%)' }}>
                  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="8" fill="none"/>
                    <path d="M8 12h32v24H8z" fill="rgba(255,255,255,0.15)"/>
                    <rect x="12" y="16" width="24" height="3" rx="1.5" fill="white"/>
                    <rect x="12" y="22" width="24" height="3" rx="1.5" fill="white" fillOpacity=".8"/>
                    <rect x="12" y="28" width="16" height="3" rx="1.5" fill="white" fillOpacity=".6"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 font-sukhumvit leading-none">
                    นำเข้าจาก Google Sheets
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 font-sarabun mt-1">
                    วางลิงก์ Google Sheets เพื่อดึงข้อสอบโดยอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* URL Input Section */}
              <div className="p-6 border-b border-slate-100 bg-white">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 font-sukhumvit">
                  ลิงก์ Google Sheets
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Link2 size={15} />
                    </div>
                    <input
                      type="url"
                      value={url}
                      onChange={e => { setUrl(e.target.value); setFetchError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleFetch()}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full h-11 pl-9 pr-4 rounded-2xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 font-sarabun outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleFetch}
                    disabled={isFetching || !url.trim()}
                    className="h-11 px-5 rounded-2xl text-white text-[13px] font-black font-sukhumvit flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)' }}
                  >
                    {isFetching ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : rows.length > 0 ? (
                      <RefreshCw size={15} />
                    ) : (
                      <Download size={15} />
                    )}
                    {isFetching ? 'กำลังดึงข้อมูล...' : rows.length > 0 ? 'ดึงใหม่' : 'ดึงข้อมูล'}
                  </motion.button>
                </div>

                {fetchError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-start gap-2 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-100"
                  >
                    <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] font-bold text-rose-600 font-sarabun">{fetchError}</p>
                  </motion.div>
                )}

                {/* Guide toggle */}
                <button
                  onClick={() => setShowGuide(v => !v)}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <Info size={12} />
                  {showGuide ? 'ซ่อนวิธีการตั้งค่า' : 'วิธีตั้งค่า Google Sheets'}
                  <ExternalLink size={11} />
                </button>

                <AnimatePresence>
                  {showGuide && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-3">
                        {/* Steps */}
                        <div className="space-y-2">
                          {[
                            { step: '1', text: 'เปิด Google Sheets และคลิก Share (แชร์) มุมบนขวา' },
                            { step: '2', text: 'เปลี่ยน "Restricted" → "Anyone with the link" แล้วเลือก "Viewer"' },
                            { step: '3', text: 'คัดลอก URL จาก address bar แล้ววางที่นี่' },
                          ].map(({ step, text }) => (
                            <div key={step} className="flex items-start gap-2">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center">
                                {step}
                              </span>
                              <p className="text-[12px] font-medium text-blue-700 font-sarabun">{text}</p>
                            </div>
                          ))}
                        </div>

                        {/* Column format */}
                        <div className="pt-2 border-t border-blue-100">
                          <p className="text-[11px] font-black text-blue-600 mb-2 font-sukhumvit">
                            <Table2 size={11} className="inline mr-1" />
                            รูปแบบ Header ที่รองรับ:
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {COLUMNS_INFO.map(({ col, desc, required }) => (
                              <div key={col} className="flex items-start gap-1.5">
                                <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${required ? 'bg-rose-400' : 'bg-slate-300'}`} />
                                <div>
                                  <code className="text-[10px] font-mono text-blue-700 bg-blue-100/60 px-1 rounded">{col}</code>
                                  <p className="text-[10px] text-blue-500 font-sarabun">{desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-blue-400 font-sarabun">
                            <span className="text-rose-400">●</span> บังคับ &nbsp; <span className="text-slate-300">●</span> ไม่บังคับ
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">
                        พบข้อมูล {rows.length} แถว
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-black">
                        พร้อมนำเข้า {readyCount} ข้อ
                      </span>
                    </div>
                    <button
                      onClick={() => setRows([])}
                      className="text-[11px] font-bold text-rose-500 hover:underline font-sukhumvit"
                    >
                      ล้างข้อมูล
                    </button>
                  </div>

                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {rows.map((row, i) => (
                        <motion.div
                          key={row.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`p-4 rounded-2xl border transition-all ${
                            row.status === 'error'
                              ? 'bg-rose-50/60 border-rose-100'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-700 font-sarabun line-clamp-2">
                                {row.questionText}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  row.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-600' :
                                  row.difficulty === 'medium' ? 'bg-amber-100 text-amber-600' :
                                  'bg-rose-100 text-rose-600'
                                }`}>
                                  {row.difficulty === 'easy' ? 'ง่าย' : row.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 font-sarabun">
                                  {row.options.length} ตัวเลือก · เฉลยข้อ {row.correctAnswer}
                                </span>
                              </div>
                            </div>
                            {row.status === 'error' ? (
                              <div className="flex items-center gap-1.5 text-rose-500 shrink-0">
                                <AlertCircle size={15} />
                                <span className="text-[11px] font-bold font-sukhumvit">{row.error}</span>
                              </div>
                            ) : (
                              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-1" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {rows.length > 0 && (
              <div className="p-5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info size={13} />
                  <span className="text-[11px] font-bold font-sarabun">
                    เฉพาะข้อที่สถานะถูกต้องเท่านั้นที่จะถูกนำเข้า
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    className="h-10 px-5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit"
                  >
                    ยกเลิก
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleImport}
                    disabled={isImporting || readyCount === 0}
                    className="h-10 px-6 rounded-2xl text-white text-[13px] font-black font-sukhumvit flex items-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #34a853 100%)' }}
                  >
                    {isImporting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {isImporting ? 'กำลังนำเข้า...' : `นำเข้า ${readyCount} ข้อ`}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
