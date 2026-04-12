import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive, Download, Upload, CheckCircle2, AlertCircle,
  RefreshCw, FileArchive, Trash2, Clock, ChevronDown, X,
} from 'lucide-react';
import {
  collection, getDocs, writeBatch, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GLASS_CARD } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────
type BackupStatus = 'idle' | 'running' | 'success' | 'error';
type RestoreStatus = 'idle' | 'parsing' | 'ready' | 'restoring' | 'success' | 'error';

interface CollectionConfig {
  id: string;
  label: string;
  description: string;
  color: string;
}

interface BackupRecord {
  id: string;
  label: string;
  timestamp: string;
  collections: string[];
  docCount: number;
  sizeKb: number;
}

interface BackupPayload {
  meta: {
    version: string;
    createdAt: string;
    collections: string[];
    totalDocs: number;
  };
  data: Record<string, Record<string, unknown>[]>;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const COLLECTION_CONFIGS: CollectionConfig[] = [
  { id: 'academic_years',  label: 'ปีการศึกษา',      description: 'ปีการศึกษาและภาคเรียน',          color: '#6366f1' },
  { id: 'departments',     label: 'แผนก',            description: 'แผนกการศึกษา (ปฐมวัย/ประถม/มัธยม)', color: '#8b5cf6' },
  { id: 'users',           label: 'ผู้ใช้งาน',       description: 'ข้อมูลบัญชีผู้ใช้ทุก role',       color: '#ec4899' },
  { id: 'subjects',        label: 'รายวิชา',         description: 'รายวิชาทั้งหมดในระบบ',            color: '#3b82f6' },
  { id: 'teachers',        label: 'ครู',             description: 'โปรไฟล์ครูและภาระสอน',           color: '#10b981' },
  { id: 'classes',         label: 'ห้องเรียน',       description: 'ห้องเรียนและนักเรียนสังกัด',      color: '#f59e0b' },
  { id: 'curriculum_maps', label: 'หลักสูตร',        description: 'แผนที่หลักสูตรตามชั้นปี',         color: '#06b6d4' },
  { id: 'enrollments',     label: 'การลงทะเบียน',    description: 'การลงทะเบียนเรียนของนักเรียน',    color: '#84cc16' },
  { id: 'schedules',       label: 'ตารางสอน',        description: 'ตารางสอนรายคาบ',                 color: '#f97316' },
  { id: 'syllabi',         label: 'แผนการสอน',       description: 'แผนการสอนของครู',               color: '#a855f7' },
  { id: 'grades',          label: 'ผลการเรียน',      description: 'คะแนนและเกรดนักเรียน',           color: '#ef4444' },
  { id: 'attendance',      label: 'การเข้าเรียน',    description: 'บันทึกการเข้าเรียน',             color: '#14b8a6' },
  { id: 'notifications',   label: 'การแจ้งเตือน',   description: 'ประวัติการแจ้งเตือน',            color: '#64748b' },
  { id: 'calendar_events', label: 'ปฏิทินการศึกษา',  description: 'กิจกรรมและวันหยุด',             color: '#dc2626' },
];

const BACKUP_VERSION = '1.0';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function downloadJson(payload: BackupPayload, filename: string) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getBackupHistory(): BackupRecord[] {
  try {
    return JSON.parse(localStorage.getItem('pmv_backup_history') || '[]');
  } catch {
    return [];
  }
}

function saveBackupHistory(record: BackupRecord) {
  const history = getBackupHistory();
  history.unshift(record);
  localStorage.setItem('pmv_backup_history', JSON.stringify(history.slice(0, 10)));
}

function removeBackupHistory(id: string) {
  const history = getBackupHistory().filter(r => r.id !== id);
  localStorage.setItem('pmv_backup_history', JSON.stringify(history));
}

// ── Collection Selector ───────────────────────────────────────────────────────
function CollectionSelector({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (id: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allSelected = selected.size === COLLECTION_CONFIGS.length;

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS_CARD}>
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <FileArchive size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-black/80">เลือก Collection ที่ต้องการสำรอง</p>
            <p className="text-xs text-black/40">เลือกแล้ว {selected.size} / {COLLECTION_CONFIGS.length} collection</p>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-black/30" />
        </motion.div>
      </div>

      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-5 pb-5 space-y-3">
          {/* Select All */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => COLLECTION_CONFIGS.forEach(c => onChange(c.id, e.target.checked))}
              className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-black/60 group-hover:text-black/80 transition-colors">
              เลือกทั้งหมด
            </span>
          </label>
          <div className="border-t border-black/5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COLLECTION_CONFIGS.map(c => (
              <label key={c.id} className="flex items-center gap-3 cursor-pointer group rounded-xl p-2 hover:bg-black/3 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={e => onChange(c.id, e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                  style={{ accentColor: c.color }}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: c.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black/70 leading-tight">{c.label}</p>
                    <p className="text-xs text-black/35 leading-tight truncate">{c.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Backup Panel ───────────────────────────────────────────────────────────────
function BackupPanel() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(COLLECTION_CONFIGS.map(c => c.id))
  );
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<BackupRecord[]>(getBackupHistory);

  const handleToggle = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBackup = async () => {
    if (selected.size === 0) {
      setStatus('error');
      setMessage('กรุณาเลือกอย่างน้อย 1 collection');
      return;
    }

    setStatus('running');
    setMessage('กำลังอ่านข้อมูลจาก Firestore...');

    try {
      const payload: BackupPayload = {
        meta: {
          version: BACKUP_VERSION,
          createdAt: new Date().toISOString(),
          collections: [...selected],
          totalDocs: 0,
        },
        data: {},
      };

      let totalDocs = 0;
      for (const colId of selected) {
        const label = COLLECTION_CONFIGS.find(c => c.id === colId)?.label ?? colId;
        setMessage(`กำลังสำรอง: ${label}...`);
        const snap = await getDocs(collection(db, colId));
        payload.data[colId] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        totalDocs += snap.docs.length;
      }

      payload.meta.totalDocs = totalDocs;

      const ts = new Date().toISOString();
      const filename = `pmv_backup_${ts.replace(/[:.]/g, '-')}.json`;
      downloadJson(payload, filename);

      const json = JSON.stringify(payload);
      const sizeKb = Math.round(new TextEncoder().encode(json).byteLength / 1024);
      const record: BackupRecord = {
        id: crypto.randomUUID(),
        label: filename,
        timestamp: ts,
        collections: [...selected],
        docCount: totalDocs,
        sizeKb,
      };
      saveBackupHistory(record);
      setHistory(getBackupHistory());

      setStatus('success');
      setMessage(`สำรองข้อมูลสำเร็จ — ${totalDocs} รายการ ใน ${selected.size} collection`);
    } catch (err) {
      setStatus('error');
      setMessage(`เกิดข้อผิดพลาด: ${(err as Error).message}`);
    }
  };

  const handleDeleteHistory = (id: string) => {
    removeBackupHistory(id);
    setHistory(getBackupHistory());
  };

  return (
    <div className="space-y-3">
      <CollectionSelector selected={selected} onChange={handleToggle} />

      {/* Action Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBackup}
          disabled={status === 'running' || selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#1e1e1e', color: '#fff' }}
        >
          {status === 'running'
            ? <RefreshCw size={15} className="animate-spin" />
            : <Download size={15} />}
          {status === 'running' ? 'กำลังสำรอง...' : 'สำรองข้อมูลเดี๋ยวนี้'}
        </button>

        {status !== 'idle' && status !== 'running' && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-xs"
          >
            {status === 'success'
              ? <CheckCircle2 size={14} className="text-emerald-500" />
              : <AlertCircle size={14} className="text-red-500" />}
            <span className={status === 'success' ? 'text-emerald-600' : 'text-red-600'}>
              {message}
            </span>
          </motion.div>
        )}
        {status === 'running' && (
          <span className="text-xs text-black/40">{message}</span>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={GLASS_CARD}>
          <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
            <Clock size={14} className="text-black/30" />
            <p className="text-xs font-semibold text-black/50">ประวัติการสำรองข้อมูล (10 รายการล่าสุด)</p>
          </div>
          <div className="divide-y divide-black/5">
            {history.map(rec => (
              <div key={rec.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-black/2 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileArchive size={16} className="text-black/25 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black/70 truncate">{rec.label}</p>
                    <p className="text-xs text-black/35">
                      {formatDate(rec.timestamp)} · {rec.docCount} รายการ · {formatSize(rec.sizeKb)} · {rec.collections.length} collection
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteHistory(rec.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-black/20 hover:text-red-400 transition-all flex-shrink-0"
                  title="ลบประวัติ"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Restore Panel ─────────────────────────────────────────────────────────────
function RestorePanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<RestoreStatus>('idle');
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'overwrite'>('merge');
  const [progress, setProgress] = useState(0);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setStatus('error');
      setMessage('รองรับเฉพาะไฟล์ .json ที่ได้จากการสำรองข้อมูล');
      return;
    }
    setStatus('parsing');
    setMessage('กำลังอ่านไฟล์...');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as BackupPayload;
        if (!parsed.meta?.version || !parsed.data) {
          throw new Error('ไฟล์ไม่ถูกต้อง — ไม่พบ metadata');
        }
        setPayload(parsed);
        setStatus('ready');
        setMessage('');
      } catch (err) {
        setStatus('error');
        setMessage(`ไฟล์ไม่ถูกต้อง: ${(err as Error).message}`);
        setPayload(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setStatus('idle');
    setMessage('');
    setPayload(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!payload) return;

    const confirmed = window.confirm(
      mergeMode === 'overwrite'
        ? `⚠️ จะลบข้อมูลเดิมใน ${payload.meta.collections.join(', ')} ทั้งหมด แล้วนำเข้าใหม่\n\nดำเนินการต่อ?`
        : `จะนำเข้าข้อมูล ${payload.meta.totalDocs} รายการ (merge กับข้อมูลเดิม)\n\nดำเนินการต่อ?`
    );
    if (!confirmed) return;

    setStatus('restoring');
    setProgress(0);

    const collections = Object.keys(payload.data);
    try {
      for (let ci = 0; ci < collections.length; ci++) {
        const colId = collections[ci];
        const docs = payload.data[colId];

        // Overwrite: delete existing docs first
        if (mergeMode === 'overwrite') {
          const snap = await getDocs(collection(db, colId));
          const delBatch = writeBatch(db);
          snap.docs.forEach(d => delBatch.delete(d.ref));
          if (snap.docs.length > 0) await delBatch.commit();
        }

        // Write in batches of 500 (Firestore limit)
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          docs.slice(i, i + 400).forEach((docData: Record<string, unknown>) => {
            const { _id, ...rest } = docData;
            const ref = _id ? doc(db, colId, _id as string) : doc(collection(db, colId));
            batch.set(ref, rest, { merge: mergeMode === 'merge' });
          });
          await batch.commit();
        }

        setProgress(Math.round(((ci + 1) / collections.length) * 100));
      }

      setStatus('success');
      setMessage(`กู้คืนสำเร็จ — ${payload.meta.totalDocs} รายการ ใน ${collections.length} collection`);
    } catch (err) {
      setStatus('error');
      setMessage(`เกิดข้อผิดพลาด: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className="rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200"
        style={{
          borderColor: status === 'ready' ? '#10b981' : status === 'error' ? '#ef4444' : 'rgba(0,0,0,0.12)',
          background: 'rgba(255,255,255,0.4)',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => status === 'idle' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="py-10 flex flex-col items-center gap-2 text-center px-4">
          {status === 'idle' && (
            <>
              <Upload size={30} className="text-black/20" />
              <p className="text-sm text-black/40">ลากไฟล์ backup (.json) มาวางที่นี่ หรือคลิกเพื่อเลือก</p>
            </>
          )}
          {status === 'parsing' && (
            <>
              <RefreshCw size={28} className="text-amber-400 animate-spin" />
              <p className="text-sm text-amber-600">กำลังอ่านไฟล์...</p>
            </>
          )}
          {status === 'ready' && payload && (
            <>
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700">ไฟล์ถูกต้อง — พร้อมกู้คืน</p>
              <p className="text-xs text-emerald-600/70">
                สำรองเมื่อ {formatDate(payload.meta.createdAt)} · {payload.meta.totalDocs} รายการ · {payload.meta.collections.length} collection
              </p>
              <button
                onClick={e => { e.stopPropagation(); clearFile(); }}
                className="mt-1 flex items-center gap-1 text-xs text-black/30 hover:text-black/50 transition-colors"
              >
                <X size={12} /> เลือกไฟล์ใหม่
              </button>
            </>
          )}
          {(status === 'success' || status === 'error') && (
            <>
              {status === 'success'
                ? <CheckCircle2 size={28} className="text-emerald-500" />
                : <AlertCircle size={28} className="text-red-500" />}
              <p className={`text-sm font-semibold ${status === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                {message}
              </p>
              <button
                onClick={e => { e.stopPropagation(); clearFile(); }}
                className="mt-1 flex items-center gap-1 text-xs text-black/30 hover:text-black/50 transition-colors"
              >
                <X size={12} /> รีเซ็ต
              </button>
            </>
          )}
          {status === 'restoring' && (
            <>
              <RefreshCw size={28} className="text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-indigo-600">กำลังกู้คืนข้อมูล... {progress}%</p>
              <div className="w-48 h-1.5 bg-black/10 rounded-full overflow-hidden mt-1">
                <motion.div
                  className="h-full rounded-full bg-indigo-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mode Selector + Action (only when ready) */}
      {status === 'ready' && payload && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-4"
          style={GLASS_CARD}
        >
          {/* Collections Preview */}
          <div>
            <p className="text-xs font-semibold text-black/40 mb-2">Collection ที่จะกู้คืน</p>
            <div className="flex flex-wrap gap-1.5">
              {payload.meta.collections.map(colId => {
                const cfg = COLLECTION_CONFIGS.find(c => c.id === colId);
                return (
                  <span
                    key={colId}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: (cfg?.color ?? '#64748b') + '15',
                      color: cfg?.color ?? '#64748b',
                    }}
                  >
                    {cfg?.label ?? colId}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Mode */}
          <div>
            <p className="text-xs font-semibold text-black/40 mb-2">โหมดการกู้คืน</p>
            <div className="flex gap-2">
              {(['merge', 'overwrite'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMergeMode(mode)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all"
                  style={{
                    borderColor: mergeMode === mode ? '#6366f1' : 'rgba(0,0,0,0.08)',
                    background: mergeMode === mode ? 'rgba(99,102,241,0.08)' : 'transparent',
                    color: mergeMode === mode ? '#6366f1' : 'rgba(0,0,0,0.4)',
                  }}
                >
                  {mode === 'merge' ? '🔀 Merge (เพิ่ม/อัปเดต)' : '♻️ Overwrite (ลบแล้วนำเข้าใหม่)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-black/30 mt-1.5">
              {mergeMode === 'merge'
                ? 'เพิ่มหรืออัปเดต document ที่มี ID ตรงกัน — ข้อมูลที่ไม่มีใน backup จะยังคงอยู่'
                : '⚠️ ลบข้อมูลเดิมทั้งหมดใน collection ที่เลือก แล้วนำเข้าใหม่จาก backup'}
            </p>
          </div>

          {/* Restore Button */}
          <button
            onClick={handleRestore}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: mergeMode === 'overwrite' ? '#ef4444' : '#6366f1',
              color: '#fff',
            }}
          >
            <Upload size={15} />
            {mergeMode === 'overwrite' ? 'ลบและกู้คืนข้อมูล' : 'กู้คืนข้อมูล (Merge)'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BackupTab() {
  const [view, setView] = useState<'backup' | 'restore'>('backup');

  return (
    <motion.div
      key="backup"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* Info Banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <HardDrive size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-indigo-700">ระบบสำรองและกู้คืนข้อมูล</p>
          <p className="text-xs text-indigo-500/70 mt-0.5">
            สำรองข้อมูลจาก Firestore เป็นไฟล์ JSON และกู้คืนกลับมาได้เมื่อต้องการ ควรสำรองข้อมูลก่อนอัปเดตระบบทุกครั้ง
          </p>
        </div>
      </div>

      {/* Tab Switch */}
      <div
        className="inline-flex rounded-xl p-1"
        style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}
      >
        {(['backup', 'restore'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: view === v ? '#1e1e1e' : 'transparent',
              color: view === v ? '#fff' : 'rgba(0,0,0,0.5)',
              boxShadow: view === v ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {v === 'backup' ? <Download size={13} /> : <Upload size={13} />}
            {v === 'backup' ? 'สำรองข้อมูล' : 'กู้คืนข้อมูล'}
          </button>
        ))}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait">
        {view === 'backup'
          ? <motion.div key="backup-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><BackupPanel /></motion.div>
          : <motion.div key="restore-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><RestorePanel /></motion.div>
        }
      </AnimatePresence>
    </motion.div>
  );
}
