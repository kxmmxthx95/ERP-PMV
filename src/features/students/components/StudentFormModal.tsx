import { useState, useEffect } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Student, NewStudent, Gender } from '@/types/student';

interface StudentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewStudent) => void;
  editingStudent?: Student | null;
}

const PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'];
const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const RELIGIONS = ['พุทธ', 'คริสต์', 'อิสลาม', 'อื่น ๆ'];

const DEFAULT_FORM: NewStudent = {
  studentCode: '',
  prefix: 'เด็กชาย',
  firstName: '',
  lastName: '',
  firstNameEn: '',
  lastNameEn: '',
  gender: 'male',
  birthDate: '',
  nationality: 'ไทย',
  religion: 'พุทธ',
  bloodType: undefined,
  allergies: '',
  address: '',
  guardianName: '',
  guardianPhone: '',
  guardianRelation: 'บิดา',
  status: 'active',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
};

export default function StudentFormModal({ open, onClose, onSubmit, editingStudent }: StudentFormModalProps) {
  const [form, setForm] = useState<NewStudent>(DEFAULT_FORM);
  const isEditing = !!editingStudent;

  useEffect(() => {
    if (editingStudent) {
      const { id: _id, createdAt: _c, ...rest } = editingStudent as Student & { id: string; createdAt: string };
      setForm({ ...DEFAULT_FORM, ...rest });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editingStudent, open]);

  const set = <K extends keyof NewStudent>(key: K, value: NewStudent[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePrefixChange = (prefix: string) => {
    const gender: Gender = prefix === 'เด็กชาย' || prefix === 'นาย' ? 'male' : 'female';
    setForm(prev => ({ ...prev, prefix, gender }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentCode.trim() || !form.firstName.trim() || !form.lastName.trim()) return;
    onSubmit(form);
    onClose();
  };

  const inputCls = 'w-full h-9 px-3 rounded-xl text-sm text-black/80 outline-none transition-all border border-black/10 focus:border-black/30 bg-white/70';
  const labelCls = 'block text-[11px] font-semibold text-black/40 uppercase tracking-wider mb-1';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
            style={glassPanel}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-black/06" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  {isEditing ? <Save size={15} className="text-white" /> : <UserPlus size={15} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-black/80">{isEditing ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h2>
                  <p className="text-[11px] text-black/40">{isEditing ? `รหัส ${editingStudent?.studentCode}` : 'กรอกข้อมูลนักเรียน'}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-black/06 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* ── Section: ข้อมูลส่วนตัว ── */}
              <section>
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-widest mb-4">ข้อมูลส่วนตัว</h3>
                <div className="grid grid-cols-2 gap-4">

                  {/* Prefix */}
                  <div>
                    <label className={labelCls}>คำนำหน้า</label>
                    <select value={form.prefix} onChange={e => handlePrefixChange(e.target.value)} className={inputCls}>
                      {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Student Code */}
                  <div>
                    <label className={labelCls}>เลขประจำตัวนักเรียน *</label>
                    <input
                      required
                      value={form.studentCode}
                      onChange={e => set('studentCode', e.target.value)}
                      placeholder="67001"
                      className={inputCls}
                    />
                  </div>

                  {/* First name */}
                  <div>
                    <label className={labelCls}>ชื่อ (ไทย) *</label>
                    <input required value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="ชื่อ" className={inputCls} />
                  </div>

                  {/* Last name */}
                  <div>
                    <label className={labelCls}>นามสกุล (ไทย) *</label>
                    <input required value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="นามสกุล" className={inputCls} />
                  </div>

                  {/* First name EN */}
                  <div>
                    <label className={labelCls}>ชื่อ (อังกฤษ)</label>
                    <input value={form.firstNameEn ?? ''} onChange={e => set('firstNameEn', e.target.value)} placeholder="First name" className={inputCls} />
                  </div>

                  {/* Last name EN */}
                  <div>
                    <label className={labelCls}>นามสกุล (อังกฤษ)</label>
                    <input value={form.lastNameEn ?? ''} onChange={e => set('lastNameEn', e.target.value)} placeholder="Last name" className={inputCls} />
                  </div>

                  {/* Birthdate */}
                  <div>
                    <label className={labelCls}>วันเกิด</label>
                    <input type="date" value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                  </div>

                  {/* Blood type */}
                  <div>
                    <label className={labelCls}>หมู่เลือด</label>
                    <select value={form.bloodType ?? ''} onChange={e => set('bloodType', e.target.value as NewStudent['bloodType'])} className={inputCls}>
                      <option value="">— ไม่ระบุ —</option>
                      {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  {/* Nationality */}
                  <div>
                    <label className={labelCls}>สัญชาติ</label>
                    <input value={form.nationality ?? ''} onChange={e => set('nationality', e.target.value)} placeholder="ไทย" className={inputCls} />
                  </div>

                  {/* Religion */}
                  <div>
                    <label className={labelCls}>ศาสนา</label>
                    <select value={form.religion ?? ''} onChange={e => set('religion', e.target.value)} className={inputCls}>
                      <option value="">— ไม่ระบุ —</option>
                      {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Allergies */}
                  <div className="col-span-2">
                    <label className={labelCls}>ประวัติแพ้ยา / แพ้อาหาร</label>
                    <input value={form.allergies ?? ''} onChange={e => set('allergies', e.target.value)} placeholder="ระบุถ้ามี เช่น แพ้ยาเพนนิซิลิน" className={inputCls} />
                  </div>

                  {/* Address */}
                  <div className="col-span-2">
                    <label className={labelCls}>ที่อยู่</label>
                    <textarea
                      value={form.address ?? ''}
                      onChange={e => set('address', e.target.value)}
                      rows={2}
                      placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                      className="w-full px-3 py-2 rounded-xl text-sm text-black/80 outline-none transition-all border border-black/10 focus:border-black/30 bg-white/70 resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* ── Section: ข้อมูลผู้ปกครอง ── */}
              <section>
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-widest mb-4">ข้อมูลผู้ปกครอง</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ชื่อผู้ปกครอง</label>
                    <input value={form.guardianName ?? ''} onChange={e => set('guardianName', e.target.value)} placeholder="ชื่อ-นามสกุล" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ความสัมพันธ์</label>
                    <select value={form.guardianRelation ?? ''} onChange={e => set('guardianRelation', e.target.value)} className={inputCls}>
                      <option value="">— ไม่ระบุ —</option>
                      {['บิดา', 'มารดา', 'ผู้ปกครอง', 'ปู่/ตา', 'ย่า/ยาย', 'อื่น ๆ'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>เบอร์โทรผู้ปกครอง</label>
                    <input value={form.guardianPhone ?? ''} onChange={e => set('guardianPhone', e.target.value)} placeholder="08X-XXX-XXXX" className={inputCls} />
                  </div>
                </div>
              </section>

              {/* ── Section: สถานะ ── */}
              <section>
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-widest mb-4">สถานะ</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['active', 'inactive', 'graduated', 'transferred'] as const).map(s => (
                    <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={() => set('status', s)}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <span className="text-sm text-black/70">
                        {s === 'active' ? 'กำลังศึกษา' : s === 'inactive' ? 'พักการศึกษา' : s === 'graduated' ? 'จบการศึกษา' : 'ย้ายออก'}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* ── Actions ── */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/06">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-black/50 hover:text-black/70 hover:bg-black/05 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm"
                >
                  {isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
