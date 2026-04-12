import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, FileSpreadsheet, Users, GraduationCap, BookOpen,
  CheckCircle2, AlertCircle, X, Download, ChevronDown
} from 'lucide-react';
import { GLASS_CARD } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────
type ImportType = 'students' | 'teachers' | 'classes' | 'grades';

interface ImportConfig {
  id: ImportType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: string[];
  templateRows: string[][];
}

type UploadStatus = 'idle' | 'validating' | 'success' | 'error';

interface FileState {
  file: File | null;
  status: UploadStatus;
  message: string;
  rowCount: number;
}

// ── Import Configs ─────────────────────────────────────────────────────────────
const IMPORT_CONFIGS: ImportConfig[] = [
  {
    id: 'students',
    label: 'นักเรียน',
    description: 'นำเข้าข้อมูลนักเรียนใหม่จากไฟล์ CSV หรือ Excel',
    icon: GraduationCap,
    color: '#3b82f6',
    fields: ['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ห้องเรียน', 'ระดับชั้น', 'วันเกิด', 'อีเมลผู้ปกครอง'],
    templateRows: [
      ['STD001', 'สมชาย', 'ใจดี', 'ม.1/1', 'มัธยมศึกษาปีที่ 1', '2010-05-15', 'parent@example.com'],
      ['STD002', 'สมหญิง', 'รักเรียน', 'ม.1/2', 'มัธยมศึกษาปีที่ 1', '2010-08-22', 'mom@example.com'],
    ],
  },
  {
    id: 'teachers',
    label: 'ครูและบุคลากร',
    description: 'นำเข้าข้อมูลครูและบุคลากรจากไฟล์ CSV หรือ Excel',
    icon: Users,
    color: '#8b5cf6',
    fields: ['รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'วิชาที่สอน', 'อีเมล', 'เบอร์โทร'],
    templateRows: [
      ['TCH001', 'นายสมศักดิ์', 'มีความรู้', 'คณิตศาสตร์', 'teacher1@school.ac.th', '081-000-0001'],
      ['TCH002', 'นางสาวสมศรี', 'เก่งกาจ', 'ภาษาไทย', 'teacher2@school.ac.th', '081-000-0002'],
    ],
  },
  {
    id: 'classes',
    label: 'ห้องเรียน',
    description: 'นำเข้าข้อมูลห้องเรียนและตารางเรียนจากไฟล์ CSV',
    icon: BookOpen,
    color: '#10b981',
    fields: ['รหัสห้อง', 'ชื่อห้อง', 'ระดับชั้น', 'ครูประจำชั้น', 'ปีการศึกษา', 'จำนวนนักเรียน'],
    templateRows: [
      ['CLS001', 'ม.1/1', 'มัธยมศึกษาปีที่ 1', 'TCH001', '2567', '35'],
      ['CLS002', 'ม.1/2', 'มัธยมศึกษาปีที่ 1', 'TCH002', '2567', '34'],
    ],
  },
  {
    id: 'grades',
    label: 'ผลการเรียน',
    description: 'นำเข้าคะแนนและผลการเรียนของนักเรียนแบบเป็นชุด',
    icon: FileSpreadsheet,
    color: '#f59e0b',
    fields: ['รหัสนักเรียน', 'รหัสวิชา', 'ภาคเรียน', 'ปีการศึกษา', 'คะแนน', 'เกรด'],
    templateRows: [
      ['STD001', 'MAT101', '1', '2567', '85', 'A'],
      ['STD001', 'THA101', '1', '2567', '78', 'B+'],
    ],
  },
];

// ── Download Template ─────────────────────────────────────────────────────────
function downloadTemplate(config: ImportConfig) {
  const header = config.fields.join(',');
  const rows = config.templateRows.map(r => r.join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template_${config.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Upload Card ───────────────────────────────────────────────────────────────
function ImportCard({ config }: { config: ImportConfig }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileState, setFileState] = useState<FileState>({
    file: null, status: 'idle', message: '', rowCount: 0,
  });
  const [expanded, setExpanded] = useState(false);

  const Icon = config.icon;

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setFileState({ file: null, status: 'error', message: 'รองรับเฉพาะไฟล์ .csv, .xlsx และ .xls', rowCount: 0 });
      return;
    }
    setFileState({ file, status: 'validating', message: 'กำลังตรวจสอบไฟล์...', rowCount: 0 });
    // Simulate validation
    setTimeout(() => {
      const fakeRows = Math.floor(Math.random() * 50) + 5;
      setFileState({ file, status: 'success', message: `พบข้อมูล ${fakeRows} รายการ พร้อมนำเข้า`, rowCount: fakeRows });
    }, 800);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const clearFile = () => {
    setFileState({ file: null, status: 'idle', message: '', rowCount: 0 });
    if (inputRef.current) inputRef.current.value = '';
  };

  const statusColor = {
    idle: 'transparent',
    validating: '#f59e0b',
    success: '#10b981',
    error: '#ef4444',
  }[fileState.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={GLASS_CARD}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: config.color + '18' }}
          >
            <Icon size={18} style={{ color: config.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-black/80">{config.label}</p>
            <p className="text-xs text-black/40">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {fileState.status === 'success' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>
              {fileState.rowCount} รายการ
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-black/30" />
          </motion.div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimateHeight expanded={expanded}>
        <div className="px-5 pb-5 space-y-4">
          {/* Drop Zone */}
          <div
            className="rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer relative"
            style={{
              borderColor: dragOver ? config.color : 'rgba(0,0,0,0.12)',
              background: dragOver ? config.color + '08' : 'rgba(255,255,255,0.4)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !fileState.file && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              {fileState.status === 'idle' ? (
                <>
                  <Upload size={28} className="text-black/20" />
                  <p className="text-sm text-black/40">ลากและวางไฟล์ที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                  <p className="text-xs text-black/25">รองรับ .csv, .xlsx, .xls</p>
                </>
              ) : (
                <>
                  {fileState.status === 'validating' && (
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {fileState.status === 'success' && <CheckCircle2 size={28} style={{ color: '#10b981' }} />}
                  {fileState.status === 'error' && <AlertCircle size={28} style={{ color: '#ef4444' }} />}
                  <p className="text-sm font-medium" style={{ color: statusColor }}>
                    {fileState.file?.name}
                  </p>
                  <p className="text-xs" style={{ color: statusColor + 'cc' }}>
                    {fileState.message}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); clearFile(); }}
                    className="mt-1 flex items-center gap-1 text-xs text-black/40 hover:text-black/60 transition-colors"
                  >
                    <X size={12} /> ลบไฟล์
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Fields Preview */}
          <div>
            <p className="text-xs font-semibold text-black/40 mb-2">คอลัมน์ที่ต้องการ</p>
            <div className="flex flex-wrap gap-1.5">
              {config.fields.map(field => (
                <span
                  key={field}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: config.color + '12', color: config.color }}
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => downloadTemplate(config)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-black/5"
              style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.5)' }}
            >
              <Download size={13} />
              ดาวน์โหลด Template
            </button>
            <button
              disabled={fileState.status !== 'success'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: fileState.status === 'success' ? config.color : 'rgba(0,0,0,0.08)',
                color: fileState.status === 'success' ? '#fff' : 'rgba(0,0,0,0.4)',
              }}
              onClick={() => {
                if (fileState.status === 'success') {
                  alert(`นำเข้าข้อมูล ${config.label} จำนวน ${fileState.rowCount} รายการ (ฟีเจอร์นี้ต้องเชื่อมต่อ Firestore)`);
                }
              }}
            >
              <Upload size={13} />
              นำเข้าข้อมูล
            </button>
          </div>
        </div>
      </AnimateHeight>
    </motion.div>
  );
}

// ── Animate Height Helper ─────────────────────────────────────────────────────
function AnimateHeight({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      style={{ overflow: 'hidden' }}
    >
      {children}
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ImportTab() {
  return (
    <motion.div
      key="import"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      {/* Info Banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.15)',
        }}
      >
        <FileSpreadsheet size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-700">การนำเข้าข้อมูลแบบเป็นชุด</p>
          <p className="text-xs text-blue-500/70 mt-0.5">
            รองรับไฟล์ CSV และ Excel (.xlsx) ดาวน์โหลด Template เพื่อดูรูปแบบข้อมูลที่ถูกต้องก่อนนำเข้า
          </p>
        </div>
      </div>

      {/* Import Cards */}
      {IMPORT_CONFIGS.map(config => (
        <ImportCard key={config.id} config={config} />
      ))}
    </motion.div>
  );
}
