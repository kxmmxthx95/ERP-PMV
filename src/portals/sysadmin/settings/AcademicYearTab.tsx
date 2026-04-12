import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Plus, Pencil, Trash2, CheckCircle2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GLASS_CARD } from './constants';
import type { AcademicYear } from './types';

// ── Form default ──────────────────────────────────────────────────────────────
const emptyForm = (): Omit<AcademicYear, 'id' | 'isActive'> => ({
  year: '',
  label: '',
  startDate: '',
  endDate: '',
  termCount: 2,
  activeSemester: 1,
});

// ── Component ─────────────────────────────────────────────────────────────────
interface AcademicYearTabProps {
  years: AcademicYear[];
  onAddYear: (year: Omit<AcademicYear, 'id' | 'isActive'>) => void;
  onEditYear: (id: string, year: Omit<AcademicYear, 'id' | 'isActive'>) => void;
  onDeleteYear: (id: string) => void;
  onSetActive: (id: string) => void;
}

export default function AcademicYearTab({
  years, onAddYear, onEditYear, onDeleteYear, onSetActive,
}: AcademicYearTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (ay: AcademicYear) => {
    setEditTarget(ay);
    setForm({ year: ay.year, label: ay.label, startDate: ay.startDate, endDate: ay.endDate, termCount: ay.termCount, activeSemester: ay.activeSemester });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.year || !form.label || !form.startDate || !form.endDate) return;
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      alert('วันเปิดเรียนต้องมาก่อนวันปิดเรียน');
      return;
    }
    if (editTarget) {
      onEditYear(editTarget.id, form);
    } else {
      onAddYear(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    onDeleteYear(deleteTarget.id);
    setDeleteTarget(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      {/* Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="rounded-2xl overflow-hidden"
        style={GLASS_CARD}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100/80 border border-slate-200 flex items-center justify-center shadow-sm">
              <CalendarDays size={14} className="text-[#1e1e1e]" />
            </div>
            <div>
              <h2 className="font-bold text-black/75 text-xs leading-none">ปีการศึกษา</h2>
              <p className="text-[10px] text-black/35 mt-0.5">จัดการและกำหนดปีการศึกษาที่ใช้งาน</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] bg-[#1e1e1e] hover:bg-[#2a2a2a]"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Plus size={12} />
            เพิ่มปีการศึกษา
          </button>
        </div>

        {/* Year list */}
        <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          {years.map((ay, i) => (
            <motion.div
              key={ay.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.015] transition-colors"
            >
              {/* Indicator */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${ay.isActive ? 'animate-pulse shadow-[0_0_6px_#10b98180]' : ''}`}
                style={{ background: ay.isActive ? '#10b981' : 'rgba(0,0,0,0.15)' }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-black/75">{ay.label}</span>
                  {ay.isActive && (
                    <Badge
                      className="text-[10px] px-2 py-0 h-4"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#059669',
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}
                    >
                      <CheckCircle2 size={10} className="mr-1" />
                      ใช้งานอยู่
                    </Badge>
                  )}
                  <span className="text-[11px] text-black/30">({ay.termCount} ภาคเรียน)</span>
                </div>
                <p className="text-xs text-black/35 mt-0.5">
                  {formatDate(ay.startDate)} — {formatDate(ay.endDate)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!ay.isActive && (
                  <button
                    onClick={() => onSetActive(ay.id)}
                    className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors duration-150"
                    style={{
                      background: 'rgba(124,58,237,0.08)',
                      color: '#7c3aed',
                      border: '1px solid rgba(124,58,237,0.2)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.14)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)'; }}
                  >
                    ตั้งเป็นปัจจุบัน
                  </button>
                )}
                <button
                  onClick={() => openEdit(ay)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-black/35 hover:text-black/60 hover:bg-black/06 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => !ay.isActive && setDeleteTarget(ay)}
                  disabled={ay.isActive}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-black/35 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}

          {years.length === 0 && (
            <div className="flex flex-col items-center py-14 text-black/25 text-sm gap-2">
              <CalendarDays size={36} className="text-[#1e1e1e] opacity-40" />
              ยังไม่มีปีการศึกษา
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'แก้ไขปีการศึกษา' : 'เพิ่มปีการศึกษาใหม่'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ปีการศึกษา (พ.ศ.)</Label>
              <Input
                placeholder="เช่น 2568"
                maxLength={4}
                value={form.year}
                onChange={e => {
                  const y = e.target.value;
                  setForm(f => ({ ...f, year: y, label: y ? `ปีการศึกษา ${y}` : '' }));
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">ชื่อแสดง</Label>
              <Input
                className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                placeholder="เช่น ปีการศึกษา 2568"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">วันเปิดเรียน</Label>
                <Input
                  className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">วันปิดเรียน</Label>
                <Input
                  className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">จำนวนภาคเรียน</Label>
              <div className="flex gap-2">
                {([2, 3] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, termCount: n }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={form.termCount === n
                      ? { background: '#1e1e1e', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                      : { background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.55)' }
                    }
                  >
                    {n} ภาคเรียน
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">ภาคเรียนที่ใช้งาน</Label>
              <div className="flex gap-2">
                {Array.from({ length: form.termCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, activeSemester: n as 1 | 2 | 3 }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={form.activeSemester === n
                      ? { background: '#059669', color: '#fff', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }
                      : { background: 'rgba(5,150,105,0.08)', color: '#059669' }
                    }
                  >
                    ท.{n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-8 text-[11px] rounded-lg hover:bg-slate-100 font-medium">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.year || !form.label || !form.startDate || !form.endDate || new Date(form.startDate) >= new Date(form.endDate)}
              className="h-8 text-[11px] rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editTarget ? 'บันทึกการแก้ไข' : 'เพิ่มปีการศึกษา'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบปีการศึกษา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>{deleteTarget?.label}</strong>?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
              ลบปีการศึกษา
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
