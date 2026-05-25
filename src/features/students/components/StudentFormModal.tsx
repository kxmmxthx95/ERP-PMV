import { useState, useEffect } from 'react';
import { UserPlus, Save } from 'lucide-react';
import type { Student, NewStudent, Gender } from '@/types/student';
import FormModal, { SettingsGroup, SettingsRow, settingsInputCls, settingsSelectCls } from '@/components/ui/FormModal';
import { useNamePrefix } from '@/hooks/useNamePrefix';

interface StudentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewStudent) => void;
  editingStudent?: Student | null;
}



const DEFAULT_FORM: NewStudent = {
  studentCode: '',
  prefix: '',
  firstName: '',
  lastName: '',
  firstNameEn: '',
  lastNameEn: '',
  gender: 'male',
  phone: '',
  email: '',
  allergies: '',
  guardianPrefix: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianPhone: '',
  guardianRelation: 'บิดา',
  status: 'active',
};

export default function StudentFormModal({ open, onClose, onSubmit, editingStudent }: StudentFormModalProps) {
  const { prefixes: studentPrefixes } = useNamePrefix('student');
  const { prefixes: adultPrefixes } = useNamePrefix('adult');
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
    let gender: Gender = 'male';
    if (['ด.ญ.', 'นางสาว', 'น.ส.', 'นาง', 'ว่าที่ร.ต.หญิง'].includes(prefix)) {
      gender = 'female';
    } else if (['ด.ช.', 'นาย', 'ว่าที่ร.ต.'].includes(prefix)) {
      gender = 'male';
    }
    setForm(prev => ({ ...prev, prefix, gender }));
  };

  const handlePhoneChange = (key: 'phone' | 'guardianPhone', value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    set(key, formatted);
  };

  const handleSubmit = () => {
    if (!form.studentCode.trim() || !form.firstName.trim() || !form.lastName.trim()) return;
    onSubmit(form);
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditing ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียนใหม่'}
      icon={isEditing ? <Save size={18} /> : <UserPlus size={18} />}
      onSubmit={handleSubmit}
      submitLabel="บันทึก"
      submitDisabled={
        !form.prefix ||
        !form.studentCode.trim() ||
        !form.firstName.trim() ||
        !form.lastName.trim() ||
        !form.phone?.trim() ||
        !form.email?.trim()
      }
      maxWidth="md"
    >
      {/* ── ข้อมูลส่วนตัว ── */}
      <SettingsGroup label="ข้อมูลส่วนตัว">
        <SettingsRow label="คำนำหน้า" required>
          <select
            value={form.prefix}
            onChange={e => handlePrefixChange(e.target.value)}
            className={settingsSelectCls}
          >
            <option value="" disabled>กรุณาเลือกคำนำหน้า</option>
            {studentPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </SettingsRow>

        <SettingsRow label="เลขประจำตัว" required>
          <input
            value={form.studentCode}
            onChange={e => set('studentCode', e.target.value)}
            placeholder="กรอกเลขประจำตัวนักเรียน"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="ชื่อ" required>
          <input
            value={form.firstName}
            onChange={e => set('firstName', e.target.value)}
            placeholder="กรุณากรอกชื่อ"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="นามสกุล" required>
          <input
            value={form.lastName}
            onChange={e => set('lastName', e.target.value)}
            placeholder="กรุณากรอกนามสกุล"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="เบอร์โทรศัพท์" required>
          <input
            value={form.phone ?? ''}
            onChange={e => handlePhoneChange('phone', e.target.value)}
            placeholder="08X-XXX-XXXX"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="อีเมล" required>
          <input
            value={form.email ?? ''}
            onChange={e => set('email', e.target.value)}
            placeholder="example@email.com"
            className={settingsInputCls}
          />
        </SettingsRow>


      </SettingsGroup>

      {/* ── ข้อมูลผู้ปกครอง ── */}
      <SettingsGroup label="ข้อมูลผู้ปกครอง">
        <SettingsRow label="คำนำหน้า">
          <select
            value={form.guardianPrefix ?? ''}
            onChange={e => set('guardianPrefix', e.target.value)}
            className={settingsSelectCls}
          >
            <option value="" disabled>กรุณาเลือกคำนำหน้า</option>
            {adultPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </SettingsRow>

        <SettingsRow label="ชื่อ">
          <input
            value={form.guardianFirstName ?? ''}
            onChange={e => set('guardianFirstName', e.target.value)}
            placeholder="กรุณากรอกชื่อ"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="นามสกุล">
          <input
            value={form.guardianLastName ?? ''}
            onChange={e => set('guardianLastName', e.target.value)}
            placeholder="กรุณากรอกนามสกุล"
            className={settingsInputCls}
          />
        </SettingsRow>

        <SettingsRow label="ความสัมพันธ์">
          <select
            value={form.guardianRelation ?? ''}
            onChange={e => set('guardianRelation', e.target.value)}
            className={settingsSelectCls}
          >
            <option value="">— ไม่ระบุ —</option>
            {['บิดา', 'มารดา', 'ผู้ปกครอง', 'ปู่/ตา', 'ย่า/ยาย', 'อื่น ๆ'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </SettingsRow>

        <SettingsRow label="เบอร์โทรศัพท์">
          <input
            value={form.guardianPhone ?? ''}
            onChange={e => handlePhoneChange('guardianPhone', e.target.value)}
            placeholder="08X-XXX-XXXX"
            className={settingsInputCls}
          />
        </SettingsRow>
      </SettingsGroup>
    </FormModal>
  );
}
