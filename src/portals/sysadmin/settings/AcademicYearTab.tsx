import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Plus, Pencil, Trash2, CheckCircle2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import FormModal from '@/components/ui/FormModal';
import { GLASS_CARD } from './constants';
import type { AcademicYear } from './types';

// ── Form default ──────────────────────────────────────────────────────────────
const emptyForm = (): Omit<AcademicYear, 'id' | 'isActive'> => ({
  year: '',
  label: 'ปีการศึกษา',
  startDate: '',
  endDate: '',
  termCount: 2,
  activeSemester: 1,
  departmentDates: {},
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
    setForm({
      year: ay.year,
      label: ay.label,
      startDate: ay.startDate,
      endDate: ay.endDate,
      termCount: ay.termCount,
      activeSemester: ay.activeSemester,
      departmentDates: ay.departmentDates || {},
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.year || !form.startDate || !form.endDate) return;
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      alert('วันเริ่มปีการศึกษาต้องมาก่อนวันสิ้นสุดปีการศึกษา');
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

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden shadow-sm"
        style={GLASS_CARD}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
              <CalendarDays size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-black/80 text-sm leading-none">ปฏิทินปีการศึกษา</h2>
              <p className="text-[11px] text-black/40 mt-1">กำหนดช่วงเวลาและภาคเรียนแยกตามระดับชั้น</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
            style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)' }}
          >
            <Plus size={14} />
            เพิ่มปีการศึกษา
          </button>
        </div>

        <div className="divide-y divide-black/5">
          {years.map((ay, i) => (
            <motion.div
              key={ay.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-black/[0.01] transition-colors group"
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ay.isActive ? 'bg-[#10b981] shadow-[0_0_8px_#10b98180] animate-pulse' : 'bg-slate-300'}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-black/80">{ay.label}</span>
                  {ay.isActive && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] h-5 rounded-lg px-2 shadow-none font-bold">
                      <CheckCircle2 size={10} className="mr-1" /> กำลังใช้
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-black/40">
                  <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(ay.startDate)} - {formatDate(ay.endDate)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>{ay.termCount} ภาคเรียน</span>
                </div>
              </div>

              <div className="flex items-center gap-2 transition-all">
                {!ay.isActive && (
                  <button
                    onClick={() => onSetActive(ay.id)}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100"
                  >
                    เปิดใช้งาน
                  </button>
                )}
                <button onClick={() => openEdit(ay)} className="w-8 h-8 rounded-xl flex items-center justify-center text-black/40 hover:text-black/70 hover:bg-slate-100 transition-all">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleteTarget(ay)}
                  disabled={ay.isActive}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-black/40 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Add/Edit Modal ── */}
      <FormModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editTarget ? `แก้ไขปีการศึกษา ${editTarget.label}` : 'เพิ่มปีการศึกษา'}
        icon={<CalendarDays size={18} />}
        onSubmit={handleSave}
        submitLabel="บันทึก"
        submitDisabled={!form.year || !form.startDate || !form.endDate}
        maxWidth="lg"
      >
        {/* Section 1: ข้อมูลพื้นฐาน */}
        <div>
          <h3 className="text-sm font-bold text-black/80 mb-4">ข้อมูลพื้นฐาน</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-2 block">ปีการศึกษา (พ.ศ.)</Label>
              <Input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 text-sm font-medium text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-transparent transition-all placeholder:text-slate-300"
                placeholder="2569"
                value={form.year}
                onChange={e => {
                  const y = e.target.value;
                  setForm(f => ({ ...f, year: y, label: y ? `ปีการศึกษา ${y}` : '' }));
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />

        {/* Section 2: ช่วงเวลา */}
        <div>
          <h3 className="text-sm font-bold text-black/80 mb-4">ช่วงเวลา</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-2 block">วันเริ่มปีการศึกษา</Label>
              <Input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 text-sm font-medium focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-transparent transition-all"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-2 block">วันสิ้นสุดปีการศึกษา</Label>
              <Input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 text-sm font-medium focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-transparent transition-all"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />

        {/* Section 3: ภาคเรียน */}
        <div>
          <h3 className="text-sm font-bold text-black/80 mb-4">ภาคเรียนปัจจุบัน</h3>
          <div>
            <Label className="text-xs font-bold text-slate-600 mb-3 block">เลือกภาคเรียน</Label>
            <div className="flex gap-2">
              {Array.from({ length: form.termCount }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, activeSemester: n as 1 | 2 | 3 }))}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${form.activeSemester === n
                    ? 'text-white shadow-md shadow-black/10'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                  style={form.activeSemester === n ? { background: '#1e1e1e' } : undefined}
                >
                  ภาคเรียนที่ {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormModal>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-xl text-center">ยืนยันการลบ?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 pt-2 pb-4">
              คุณต้องการลบ <strong>{deleteTarget?.label}</strong> ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={handleDelete} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-2xl h-12 text-xs font-bold shadow-lg shadow-red-100 transition-all">ยืนยันการลบข้อมูล</AlertDialogAction>
            <AlertDialogCancel className="w-full border-none bg-slate-100 hover:bg-slate-200 rounded-2xl h-12 text-xs font-bold transition-all">ยกเลิก</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
