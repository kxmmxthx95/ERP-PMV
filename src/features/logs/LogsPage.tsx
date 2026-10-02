import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, User, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LogEntry } from '@/lib/activityLogger';

// ── Type Definitions ──────────────────────────────────────────────────────
interface AuditLog extends LogEntry {
  id: string; // docId + index
}

// ── Constants ─────────────────────────────────────────────────────────────
const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  user:     { bg: 'rgba(59, 130, 246, 0.12)',  text: '#1e40af', border: 'rgba(59, 130, 246, 0.25)' },
  system:   { bg: 'rgba(124, 58, 237, 0.12)',  text: '#6d28d9', border: 'rgba(124, 58, 237, 0.25)' },
  security: { bg: 'rgba(239, 68, 68, 0.12)',   text: '#991b1b', border: 'rgba(239, 68, 68, 0.25)' },
  academic: { bg: 'rgba(34, 197, 94, 0.12)',   text: '#15803d', border: 'rgba(34, 197, 94, 0.25)' },
  data:     { bg: 'rgba(245, 158, 11, 0.12)',  text: '#92400e', border: 'rgba(245, 158, 11, 0.25)' },
};

const STATUS_STYLES = {
  success: { color: '#059669', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: CheckCircle2 },
  warning: { color: '#d97706', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.20)',  icon: AlertTriangle },
  error:   { color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.25)',  icon: XCircle },
};

const ITEMS_PER_PAGE = 15;

// ── Component ─────────────────────────────────────────────────────────────
export default function LogsPage() {
  const [searchText,     setSearchText]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [logs,           setLogs]           = useState<AuditLog[]>([]);

  // Read from daily_logs collection and flatten entries
  useEffect(() => {
    const q = query(collection(db, 'daily_logs'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all: AuditLog[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const entries: LogEntry[] = Array.isArray(data.entries) ? data.entries : [];
        entries.forEach((entry, i) => {
          all.push({ ...entry, id: `${docSnap.id}_${i}` });
        });
      });
      // Sort newest first by timestamp
      all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(all);
    });
    return () => unsubscribe();
  }, []);

  // ── Filter ──
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchText &&
          !log.action.toLowerCase().includes(searchText.toLowerCase()) &&
          !log.user.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      if (dateFrom && log.timestamp < dateFrom) return false;
      if (dateTo && log.timestamp > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [logs, searchText, statusFilter, categoryFilter, dateFrom, dateTo]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:   filteredLogs.length,
    success: filteredLogs.filter(l => l.status === 'success').length,
    issues:  filteredLogs.filter(l => l.status !== 'success').length,
  }), [filteredLogs]);

  // ── Pagination ──
  const totalPages    = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleReset = () => {
    setSearchText(''); setStatusFilter('all'); setCategoryFilter('all');
    setDateFrom(''); setDateTo(''); setCurrentPage(1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleExport = () => {
    const rows = [
      ['#', 'การกระทำ', 'หมวดหมู่', 'ผู้ใช้', 'วันที่', 'เวลา', 'สถานะ', 'รายละเอียด'],
      ...filteredLogs.map((log, i) => [
        i + 1,
        log.action,
        log.category,
        log.user,
        formatDate(log.timestamp),
        formatTime(log.timestamp),
        log.status,
        log.detail,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-black">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-black/85 tracking-tight">บันทึกกิจกรรม</h1>
          <p className="text-xs text-black/40 mt-0.5">ดูและตรวจสอบทุกการกระทำในระบบ</p>
        </div>
        <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleExport}>
          <Download size={16} />
          ส่งออก CSV
        </Button>
      </motion.div>

      {/* ── Filter Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={GLASS_CARD}
      >
        <div className="p-4 space-y-4">
          <div className="flex gap-3 flex-wrap lg:flex-nowrap">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
              <Input
                placeholder="ค้นหาการกระทำหรือผู้ใช้..."
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="success">สำเร็จ</SelectItem>
                <SelectItem value="warning">คำเตือน</SelectItem>
                <SelectItem value="error">ข้อผิดพลาด</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">หมวดหมู่ทั้งหมด</SelectItem>
                <SelectItem value="user">ผู้ใช้</SelectItem>
                <SelectItem value="system">ระบบ</SelectItem>
                <SelectItem value="security">ความปลอดภัย</SelectItem>
                <SelectItem value="academic">การศึกษา</SelectItem>
                <SelectItem value="data">ข้อมูล</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 flex-wrap lg:flex-nowrap">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="flex-1 min-w-32"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="flex-1 min-w-32"
            />
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-black/40 hover:text-black/60">
              รีเซ็ต
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: 'รวม',    value: stats.total,   color: '#7c3aed' },
          { label: 'สำเร็จ', value: stats.success,  color: '#10b981' },
          { label: 'ปัญหา',  value: stats.issues,   color: '#f59e0b' },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="rounded-xl px-4 py-3 text-center"
            style={{
              background: `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.08)`,
              border:     `1px solid rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.2)`,
            }}
          >
            <p className="text-xs text-black/40 font-medium">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl overflow-hidden"
        style={GLASS_CARD}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/[0.03]">
              <TableRow className="border-b border-black/[0.05] hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">เลข</TableHead>
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">การกระทำ</TableHead>
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">หมวดหมู่</TableHead>
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">ผู้ใช้</TableHead>
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">วันที่/เวลา</TableHead>
                <TableHead className="text-[11px] font-semibold text-black/35 uppercase">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log, idx) => {
                const statusStyle = STATUS_STYLES[log.status] ?? STATUS_STYLES.success;
                const StatusIcon  = statusStyle.icon;
                const catStyle    = CATEGORY_COLORS[log.category] ?? CATEGORY_COLORS.user;

                return (
                  <TableRow key={log.id} className="border-b border-black/[0.05] hover:bg-black/[0.015]">
                    <TableCell className="px-6 py-3.5 text-xs text-black/40 font-medium">
                      {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </TableCell>

                    <TableCell className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusStyle.color }} />
                        <div>
                          <p className="text-sm font-medium text-black/65">{log.action}</p>
                          {log.detail && (
                            <p className="text-[11px] text-black/30 truncate max-w-xs">{log.detail}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-6 py-3.5">
                      <div
                        className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}
                      >
                        {{ user: 'ผู้ใช้', system: 'ระบบ', security: 'ความปลอดภัย', academic: 'การศึกษา', data: 'ข้อมูล' }[log.category] ?? log.category}
                      </div>
                    </TableCell>

                    <TableCell className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-black/20" />
                        <span className="text-xs text-black/40">{log.user}</span>
                      </div>
                    </TableCell>

                    <TableCell className="px-6 py-3.5 text-xs text-black/30">
                      <div>{formatDate(log.timestamp)}</div>
                      <div className="text-black/20">{formatTime(log.timestamp)}</div>
                    </TableCell>

                    <TableCell className="px-6 py-3.5">
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
                      >
                        <StatusIcon size={12} />
                        {{ success: 'สำเร็จ', warning: 'คำเตือน', error: 'ข้อผิดพลาด' }[log.status]}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {paginatedLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-black/25">
            <p className="text-sm">ไม่พบบันทึก</p>
          </div>
        )}
      </motion.div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-2"
        >
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>
            ← ก่อนหน้า
          </Button>
          <div className="text-xs text-black/40 px-3">หน้า {currentPage} / {totalPages}</div>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>
            ถัดไป →
          </Button>
        </motion.div>
      )}
    </div>
  );
}
