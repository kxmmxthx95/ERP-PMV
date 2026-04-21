import { useState, useEffect } from 'react';
import { UserPlus, Save, GraduationCap } from 'lucide-react';
import type { Student, NewStudent, Gender } from '@/types/student';
import { NativeSelect } from '@/components/ui/native-select';
import FormModal from '@/components/ui/FormModal';

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

  const handleSubmit = () => {
    if (!form.studentCode.trim() || !form.firstName.trim() || !form.lastName.trim()) return;
    onSubmit(form);
    onClose();
  };

  const inputCls = 'w-full h-10 px-4 rounded-xl text-sm text-black/80 outline-none transition-all border-transparent bg-black/[0.03] focus:bg-black/[0.05] focus:ring-1 focus:ring-slate-300 shadow-sm font-medium';
  const labelCls = 'block text-[10px] font-bold text-black/40 uppercase tracking-widest mb-1 pl-1';

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditing ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}
      subtitle={isEditing ? `รหัสประจำตัว ${editingStudent?.studentCode}` : 'กรอกรายละเอียดพื้นฐานของนักเรียน'}
      icon={isEditing ? <Save size={18} /> : <UserPlus size={18} />}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่มนักเรียน'}
      submitDisabled={!form.studentCode.trim() || !form.firstName.trim() || !form.lastName.trim()}
      maxWidth="2xl"
    >
      <div className="space-y-6 py-2">
        {/* ── Section: ข้อมูลส่วนตัว ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={14} className="text-blue-500" />
            <h3 className="text-xs font-bold text-black/60 uppercase tracking-widest">ข้อมูลส่วนตัว</h3>
            <div className="h-px flex-1 bg-black/5" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Prefix */}
            <div>
              <label className={labelCls}>คำนำหน้า</label>
              <NativeSelect value={form.prefix} onChange={e => handlePrefixChange(e.target.value)}>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </NativeSelect>
            </div>

            {/* Student Code */}
            <div>
              <label className={labelCls}>เลขประจำตัวนักเรียน *</label>
              <input
                required
                value={form.studentCode}
                onChange={e => set('studentCode', e.target.value)}
                placeholder="เช่น 67001"
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

            {/* Birthdate */}
            <div>
              <label className={labelCls}>วันเกิด</label>
              <input type="date" value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
            </div>

            {/* Blood type */}
            <div>
              <label className={labelCls}>หมู่เลือด</label>
              <NativeSelect value={form.bloodType ?? ''} onChange={e => set('bloodType', e.target.value as NewStudent['bloodType'])}>
                <option value="">— ไม่ระบุ —</option>
                {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </NativeSelect>
            </div>

            {/* Nationality */}
            <div>
              <label className={labelCls}>สัญชาติ</label>
              <input value={form.nationality ?? ''} onChange={e => set('nationality', e.target.value)} placeholder="ไทย" className={inputCls} />
            </div>

            {/* Religion */}
            <div>
              <label className={labelCls}>ศาสนา</label>
              <NativeSelect value={form.religion ?? ''} onChange={e => set('religion', e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </NativeSelect>
            </div>

            {/* Address */}
            <div className="col-span-2">
              <label className={labelCls}>ที่อยู่</label>
              <textarea
                value={form.address ?? ''}
                onChange={e => set('address', e.target.value)}
                rows={2}
                placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                className="w-full px-4 py-2 rounded-xl text-sm text-black/80 outline-none transition-all border border-black/10 focus:border-black/30 bg-white/70 resize-none shadow-sm"
              />
            </div>
          </div>
        </section>

        {/* ── Section: ข้อมูลผู้ปกครอง ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold text-black/60 uppercase tracking-widest">ข้อมูลผู้ปกครอง</h3>
            <div className="h-px flex-1 bg-black/5" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>ชื่อผู้ปกครอง</label>
              <input value={form.guardianName ?? ''} onChange={e => set('guardianName', e.target.value)} placeholder="ชื่อ-นามสกุล" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ความสัมพันธ์</label>
              <NativeSelect value={form.guardianRelation ?? ''} onChange={e => set('guardianRelation', e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {['บิดา', 'มารดา', 'ผู้ปกครอง', 'ปู่/ตา', 'ย่า/ยาย', 'อื่น ๆ'].map(r => <option key={r} value={r}>{r}</option>)}
              </NativeSelect>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>เบอร์โทรศัพท์ผู้ปกครอง</label>
              <input value={form.guardianPhone ?? ''} onChange={e => set('guardianPhone', e.target.value)} placeholder="08X-XXX-XXXX" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Section: สถานะ ── */}
        <section className="bg-black/[0.02] p-4 rounded-2xl border border-black/5">
          <h3 className="text-[10px] font-bold text-black/30 uppercase tracking-widest mb-3">สถานะการศึกษา</h3>
          <div className="flex flex-wrap gap-6">
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
                <span className="text-xs font-medium text-black/70">
                  {s === 'active' ? 'กำลังศึกษา' : s === 'inactive' ? 'พักการศึกษา' : s === 'graduated' ? 'จบการศึกษา' : 'ย้ายออก'}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </FormModal>
  );
}
