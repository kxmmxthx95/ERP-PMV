import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  School, Phone, Mail, Globe, MapPin,
  Languages, Clock, Calendar, Save, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GLASS_CARD } from './constants';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GeneralSettings {
  schoolName: string;
  schoolNameEn: string;
  schoolCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  language: 'th' | 'en';
  timezone: string;
  dateFormat: 'buddhist' | 'gregorian';
}

const DEFAULT_SETTINGS: GeneralSettings = {
  schoolName: 'โรงเรียนตัวอย่าง',
  schoolNameEn: 'Example School',
  schoolCode: 'SCH001',
  address: '',
  phone: '',
  email: '',
  website: '',
  language: 'th',
  timezone: 'Asia/Bangkok',
  dateFormat: 'buddhist',
};

const TIMEZONES = [
  { value: 'Asia/Bangkok', label: 'เอเชีย/กรุงเทพฯ (UTC+7)' },
  { value: 'Asia/Singapore', label: 'เอเชีย/สิงคโปร์ (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'เอเชีย/โตเกียว (UTC+9)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS_CARD}>
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
      >
        <div className="w-7 h-7 rounded-lg bg-slate-100/80 border border-slate-200 flex items-center justify-center shadow-sm">
          <Icon size={14} className="text-[#1e1e1e]" />
        </div>
        <div>
          <h2 className="font-bold text-black/75 text-xs leading-none">{title}</h2>
          <p className="text-[10px] text-black/35 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon size={11} />}
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── SegmentedControl ──────────────────────────────────────────────────────────
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={
            value === opt.value
              ? { background: '#1e1e1e', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
              : { background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.55)' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GeneralTab() {
  const [form, setForm] = useState<GeneralSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'systemConfig', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setForm({ ...DEFAULT_SETTINGS, ...(docSnap.data() as GeneralSettings) });
      }
    });
    return () => unsubscribe();
  }, []);

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'systemConfig', 'general'), form, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_SETTINGS);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* ── School Information ── */}
      <Section
        icon={School}
        title="ข้อมูลโรงเรียน"
        description="ชื่อ รหัส และข้อมูลพื้นฐานของสถาบัน"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="ชื่อโรงเรียน (ภาษาไทย)">
            <Input
              className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              placeholder="เช่น โรงเรียนตัวอย่าง"
              value={form.schoolName}
              onChange={e => set('schoolName', e.target.value)}
            />
          </Field>
          <Field label="ชื่อโรงเรียน (ภาษาอังกฤษ)">
            <Input
              className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              placeholder="e.g. Example School"
              value={form.schoolNameEn}
              onChange={e => set('schoolNameEn', e.target.value)}
            />
          </Field>
        </div>

        <Field label="รหัสโรงเรียน">
          <Input
            className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none w-40"
            placeholder="เช่น SCH001"
            value={form.schoolCode}
            onChange={e => set('schoolCode', e.target.value)}
          />
        </Field>

        <Field label="ที่อยู่" icon={MapPin}>
          <Input
            className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
            placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="เบอร์โทรศัพท์" icon={Phone}>
            <Input
              className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              placeholder="02-xxx-xxxx"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </Field>
          <Field label="อีเมล" icon={Mail}>
            <Input
              className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              type="email"
              placeholder="school@example.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </Field>
          <Field label="เว็บไซต์" icon={Globe}>
            <Input
              className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              placeholder="https://example.ac.th"
              value={form.website}
              onChange={e => set('website', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Language & Region ── */}
      <Section
        icon={Languages}
        title="ภาษาและภูมิภาค"
        description="ตั้งค่าภาษา โซนเวลา และรูปแบบวันที่"
      >
        <div className="grid grid-cols-2 gap-6">
          <Field label="ภาษาของระบบ" icon={Languages}>
            <SegmentedControl
              value={form.language}
              options={[
                { value: 'th', label: 'ภาษาไทย' },
                { value: 'en', label: 'English' },
              ]}
              onChange={v => set('language', v)}
            />
          </Field>

          <Field label="รูปแบบปีในระบบ" icon={Calendar}>
            <SegmentedControl
              value={form.dateFormat}
              options={[
                { value: 'buddhist', label: 'พุทธศักราช (พ.ศ.)' },
                { value: 'gregorian', label: 'คริสต์ศักราช (ค.ศ.)' },
              ]}
              onChange={v => set('dateFormat', v)}
            />
          </Field>
        </div>

        <Field label="โซนเวลา (Timezone)" icon={Clock}>
          <div className="flex gap-1.5">
            {TIMEZONES.map(tz => (
              <button
                key={tz.value}
                type="button"
                onClick={() => set('timezone', tz.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={
                  form.timezone === tz.value
                    ? { background: '#1e1e1e', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                    : { background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.55)' }
                }
              >
                {tz.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* ── Save Bar ── */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={GLASS_CARD}
      >
        <p className="text-xs text-black/40">
          {saved ? (
            <span className="text-emerald-600 font-semibold">บันทึกเรียบร้อยแล้ว</span>
          ) : (
            'การเปลี่ยนแปลงจะมีผลหลังจากบันทึก'
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-black/45 hover:text-black/65 hover:bg-black/05 transition-colors"
          >
            <RotateCcw size={11} />
            รีเซ็ต
          </button>
          <Button
            onClick={handleSave}
            className="flex items-center gap-1.5 h-7 px-3 text-xs rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-semibold"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Save size={11} />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>

      <Separator className="opacity-0 h-1" />
    </motion.div>
  );
}
