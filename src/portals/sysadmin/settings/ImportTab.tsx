import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, FileSpreadsheet, Users, GraduationCap, BookOpen,
  CheckCircle2, AlertCircle, X, Download, ChevronDown
} from 'lucide-react';
import { GLASS_CARD } from './constants';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Types ─────────────────────────────────────────────────────────────────────
type ImportType = 'students' | 'teachers' | 'classes' | 'grades' | 'subjects';

interface FieldRef {
  label: string;
  values: { key: string; label: string; color: string }[];
}

interface ImportConfig {
  id: ImportType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: string[];
  dbFields: string[]; // ฟิลด์ที่จะเป็น Key ใน Firestore
  templateRows: string[][];
  fieldRefs?: FieldRef[]; // ตัวเลือกที่ถูกต้องสำหรับฟิลด์ enum
}

type UploadStatus = 'idle' | 'validating' | 'success' | 'error';

interface FileState {
  file: File | null;
  status: UploadStatus;
  message: string;
  rowCount: number;
  parsedData?: string[]; // เก็บข้อมูลที่ถูกอ่านจากไฟล์
}

// ── Import Configs ─────────────────────────────────────────────────────────────
const IMPORT_CONFIGS: ImportConfig[] = [
  {
    id: 'students',
    label: 'นักเรียน',
    description: 'นำเข้าข้อมูลนักเรียนใหม่จากไฟล์ CSV',
    icon: GraduationCap,
    color: '#3b82f6',
    fields: ['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ห้องเรียน', 'ระดับชั้น', 'วันเกิด', 'อีเมลผู้ปกครอง'],
    dbFields: ['studentId', 'firstName', 'lastName', 'className', 'gradeLevel', 'birthDate', 'parentEmail'],
    templateRows: [
      ['STD001', 'สมชาย', 'ใจดี', 'ม.1/1', 'มัธยมศึกษาปีที่ 1', '2010-05-15', 'parent@example.com'],
      ['STD002', 'สมหญิง', 'รักเรียน', 'ม.1/2', 'มัธยมศึกษาปีที่ 1', '2010-08-22', 'mom@example.com'],
    ],
  },
  {
    id: 'teachers',
    label: 'ครูและบุคลากร',
    description: 'นำเข้าข้อมูลครูและบุคลากรจากไฟล์ CSV',
    icon: Users,
    color: '#8b5cf6',
    fields: ['รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'วิชาที่สอน', 'อีเมล', 'เบอร์โทร'],
    dbFields: ['employeeCode', 'firstName', 'lastName', 'subject', 'email', 'phone'],
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
    dbFields: ['classCode', 'className', 'gradeLevel', 'homeroomTeacher', 'academicYear', 'studentCount'],
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
    dbFields: ['studentId', 'subjectId', 'semester', 'academicYear', 'score', 'grade'],
    templateRows: [
      ['STD001', 'MAT101', '1', '2567', '85', 'A'],
      ['STD001', 'THA101', '1', '2567', '78', 'B+'],
    ],
  },
  {
    id: 'subjects',
    label: 'วิชา',
    description: 'นำเข้าข้อมูลวิชาและกลุ่มสาระการเรียนรู้จากไฟล์ CSV',
    icon: BookOpen,
    color: '#06b6d4',
    fields: ['รหัสวิชา', 'ชื่อวิชา', 'หน่วยกิต', 'ชั่วโมง/สัปดาห์', 'ชั่วโมงเต็ม', 'แผนก', 'หมวดวิชา', 'กลุ่มสาระ'],
    dbFields: ['code', 'name', 'credits', 'hoursPerWeek', 'totalHours', 'department', 'category', 'subjectGroup'],
    templateRows: [
      ['ท11101', 'ภาษาไทย 1', '1.5', '2', '40', 'secondary', 'core', 'thai'],
      ['ค21101', 'คณิตศาสตร์ 1', '1.5', '2', '40', 'secondary', 'core', 'math'],
      ['ว31101', 'วิทยาศาสตร์ 1', '2', '3', '60', 'secondary', 'core', 'science'],
    ],
    fieldRefs: [
      {
        label: 'กลุ่มสาระการเรียนรู้ (subjectGroup)',
        values: [
          { key: 'thai',        label: 'ภาษาไทย',                         color: '#ef4444' },
          { key: 'math',        label: 'คณิตศาสตร์',                       color: '#3b82f6' },
          { key: 'science',     label: 'วิทยาศาสตร์และเทคโนโลยี',           color: '#10b981' },
          { key: 'social',      label: 'สังคมศึกษา ศาสนา และวัฒนธรรม',      color: '#f59e0b' },
          { key: 'health_pe',   label: 'สุขศึกษาและพลศึกษา',               color: '#84cc16' },
          { key: 'arts',        label: 'ศิลปะ',                            color: '#ec4899' },
          { key: 'careers',     label: 'การงานอาชีพ',                      color: '#f97316' },
          { key: 'foreign_lang',label: 'ภาษาต่างประเทศ',                   color: '#8b5cf6' },
          { key: 'other',       label: 'อื่นๆ / กิจกรรม',                  color: '#6b7280' },
        ],
      },
      {
        label: 'หมวดวิชา (category)',
        values: [
          { key: 'core',     label: 'วิชาพื้นฐาน',  color: '#0ea5e9' },
          { key: 'added',    label: 'วิชาเพิ่มเติม', color: '#f97316' },
          { key: 'elective', label: 'วิชาเลือก',     color: '#8b5cf6' },
          { key: 'activity', label: 'กิจกรรม',       color: '#10b981' },
        ],
      },
      {
        label: 'แผนก (department)',
        values: [
          { key: 'early',     label: 'ปฐมวัย',       color: '#ec4899' },
          { key: 'primary',   label: 'ประถมศึกษา',   color: '#3b82f6' },
          { key: 'secondary', label: 'มัธยมศึกษา',   color: '#8b5cf6' },
        ],
      },
    ],
  },
];

// ── Download Template ─────────────────────────────────────────────────────────
function downloadTemplate(config: ImportConfig) {
  const lines: string[] = [];

  // Comment lines explaining enum values (Excel/Sheets ignores rows starting with #)
  if (config.fieldRefs && config.fieldRefs.length > 0) {
    lines.push('# ===== คู่มือการกรอกข้อมูล =====');
    for (const ref of config.fieldRefs) {
      const options = ref.values.map(v => `${v.key} (${v.label})`).join(' | ');
      lines.push(`# ${ref.label}: ${options}`);
    }
    lines.push('# ================================');
  }

  lines.push(config.fields.join(','));
  for (const row of config.templateRows) {
    lines.push(row.join(','));
  }

  const csv = lines.join('\n');
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
    if (!file.name.match(/\.(csv)$/i)) {
      setFileState({ file: null, status: 'error', message: 'รองรับเฉพาะไฟล์ .csv เท่านั้นในขณะนี้', rowCount: 0 });
      return;
    }
    setFileState({ file, status: 'validating', message: 'กำลังตรวจสอบไฟล์...', rowCount: 0 });

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const rows = text.split(/\r?\n/).filter(line => line.trim() !== '' && !line.trimStart().startsWith('#'));
        if (rows.length > 1) {
          const rowCount = rows.length - 1; // หักลบแถว Header ออก
          setFileState({ file, status: 'success', message: `พบข้อมูล ${rowCount} รายการ พร้อมนำเข้า`, rowCount, parsedData: rows });
        } else {
          setFileState({ file: null, status: 'error', message: 'ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่ถูกต้อง', rowCount: 0 });
        }
      }
    };
    reader.onerror = () => setFileState({ file: null, status: 'error', message: 'เกิดข้อผิดพลาดในการอ่านไฟล์', rowCount: 0 });
    reader.readAsText(file, 'UTF-8');
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

  const handleImport = async () => {
    if (fileState.status !== 'success' || !fileState.parsedData) return;
    
    setFileState(prev => ({ ...prev, status: 'validating', message: 'กำลังบันทึกลง Firestore...' }));
    
    try {
      const batch = writeBatch(db);
      const colRef = collection(db, config.id);
      
      // ตัด Header ออกและนำเข้าสูงสุด 400 รายการเพื่อไม่ให้เกิน Limit ต่อ 1 Batch ของ Firestore (500)
      const rows = fileState.parsedData.slice(1, 401);
      
      rows.forEach(row => {
        // แยกลูกน้ำอย่างง่าย (ถ้า CSV มีลูกน้ำในข้อมูล ควรใช้ไลบรารีอย่าง papaparse ช่วยครับ)
        const cols = row.split(',').map(c => c.trim());
        const docRef = doc(colRef);
        const docData: Record<string, any> = {
          createdAt: new Date().toISOString(),
        };
        
        // นำค่าไปผูกกับชื่อ Database Fields ที่ตั้งไว้ใน config
        config.dbFields.forEach((field, i) => {
          docData[field] = cols[i] || '';
        });
        
        batch.set(docRef, docData);
      });

      await batch.commit();
      setFileState({ file: null, status: 'success', message: `นำเข้าข้อมูลสำเร็จ ${rows.length} รายการ`, rowCount: rows.length });
      setTimeout(() => clearFile(), 3000);
    } catch (error) {
      console.error('Import error:', error);
      setFileState(prev => ({ ...prev, status: 'error', message: `เกิดข้อผิดพลาด: ${(error as Error).message}` }));
    }
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
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              {fileState.status === 'idle' ? (
                <>
                  <Upload size={28} className="text-black/20" />
                  <p className="text-sm text-black/40">ลากและวางไฟล์ที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                  <p className="text-xs text-black/25">รองรับไฟล์ .csv (การรองรับ Excel จะมาในภายหลัง)</p>
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

          {/* Field Reference Tables */}
          {config.fieldRefs && config.fieldRefs.length > 0 && (
            <div className="space-y-3">
              {config.fieldRefs.map(ref => (
                <div
                  key={ref.label}
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <p className="text-[11px] font-semibold text-black/40 mb-2">{ref.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ref.values.map(v => (
                      <div
                        key={v.key}
                        className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg"
                        style={{ background: v.color + '12', border: `1px solid ${v.color}25` }}
                      >
                        <code
                          className="font-mono font-semibold"
                          style={{ color: v.color }}
                        >{v.key}</code>
                        <span className="text-black/50">{v.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            onClick={handleImport}
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
            รองรับไฟล์ CSV เท่านั้นในขณะนี้ ดาวน์โหลด Template เพื่อดูรูปแบบข้อมูลที่ถูกต้องก่อนนำเข้า
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
