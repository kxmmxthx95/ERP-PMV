import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Lock, KeyRound, Clock, UserX,
  Smartphone, AlertTriangle, Save, RotateCcw, Info, LogOut,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GLASS_CARD } from './constants';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  maxAgeDays: number; // 0 = ไม่หมดอายุ
}

interface SessionPolicy {
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  rememberMeDays: number;
}

interface LoginPolicy {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireMFA: boolean;
  allowedLoginMethods: { email: boolean; google: boolean };
}

interface SecuritySettings {
  password: PasswordPolicy;
  session: SessionPolicy;
  login: LoginPolicy;
  auditLog: boolean;
  ipWhitelist: { enabled: boolean; ips: string };
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: SecuritySettings = {
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: false,
    maxAgeDays: 90,
  },
  session: {
    sessionTimeoutMinutes: 60,
    maxConcurrentSessions: 3,
    rememberMeDays: 7,
  },
  login: {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    requireMFA: false,
    allowedLoginMethods: { email: true, google: true },
  },
  auditLog: true,
  ipWhitelist: { enabled: false, ips: '' },
};

// ── Helper Components ─────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  iconColor = '#1e1e1e',
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor?: string;
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
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
          style={{ background: `${iconColor}14`, border: `1px solid ${iconColor}25`, color: iconColor }}
        >
          <Icon size={14} />
        </div>
        <div>
          <h2 className="font-bold text-black/75 text-xs leading-none">{title}</h2>
          <p className="text-[10px] text-black/35 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0"
      style={{
        background: checked ? '#1e1e1e' : 'rgba(0,0,0,0.15)',
        boxShadow: checked ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </button>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-black/70 leading-none">{label}</p>
        {description && <p className="text-[10px] text-black/35 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => {
          const n = Number(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-16 h-7 px-2 rounded-lg text-xs text-right border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-slate-300"
      />
      {suffix && <span className="text-[10px] text-black/40">{suffix}</span>}
    </div>
  );
}

// ── Strength Indicator ────────────────────────────────────────────────────────
function PasswordStrengthBar({ policy }: { policy: PasswordPolicy }) {
  const score = [
    policy.minLength >= 8,
    policy.requireUppercase,
    policy.requireLowercase,
    policy.requireNumber,
    policy.requireSpecial,
    policy.maxAgeDays > 0 && policy.maxAgeDays <= 90,
  ].filter(Boolean).length;

  const levels = [
    { min: 0, max: 1, label: 'อ่อนแอมาก', color: '#ef4444' },
    { min: 2, max: 3, label: 'อ่อนแอ',    color: '#f97316' },
    { min: 4, max: 4, label: 'ปานกลาง',   color: '#eab308' },
    { min: 5, max: 5, label: 'แข็งแกร่ง', color: '#22c55e' },
    { min: 6, max: 6, label: 'ยอดเยี่ยม', color: '#059669' },
  ];
  const level = levels.find(l => score >= l.min && score <= l.max) ?? levels[0];

  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? level.color : 'rgba(0,0,0,0.08)' }}
          />
        ))}
      </div>
      <span className="text-[10px] font-semibold" style={{ color: level.color }}>
        {level.label}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SecurityTab() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [savedMsg, setSavedMsg] = useState(false);
  const [showIpNote, setShowIpNote] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'systemConfig', 'security'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...(docSnap.data() as SecuritySettings) });
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Setters ──────────────────────────────────────────────────────────────────
  const setPassword = <K extends keyof PasswordPolicy>(k: K, v: PasswordPolicy[K]) =>
    setSettings(s => ({ ...s, password: { ...s.password, [k]: v } }));

  const setSession = <K extends keyof SessionPolicy>(k: K, v: SessionPolicy[K]) =>
    setSettings(s => ({ ...s, session: { ...s.session, [k]: v } }));

  const setLogin = <K extends keyof LoginPolicy>(k: K, v: LoginPolicy[K]) =>
    setSettings(s => ({ ...s, login: { ...s.login, [k]: v } }));

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'systemConfig', 'security'), settings, { merge: true });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (error) {
      console.error('Error saving security settings:', error);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >

      {/* ── Password Policy ── */}
      <Section icon={KeyRound} iconColor="#7c3aed" title="นโยบายรหัสผ่าน" description="กำหนดเงื่อนไขความแข็งแกร่งของรหัสผ่าน">
        <Row label="ความยาวขั้นต่ำ" description="จำนวนตัวอักษรขั้นต่ำที่รหัสผ่านต้องมี">
          <NumberInput value={settings.password.minLength} onChange={v => setPassword('minLength', Math.max(6, v))} min={6} max={32} suffix="ตัวอักษร" />
        </Row>

        <Row label="ต้องมีตัวพิมพ์ใหญ่ (A–Z)">
          <Toggle checked={settings.password.requireUppercase} onChange={v => setPassword('requireUppercase', v)} />
        </Row>

        <Row label="ต้องมีตัวพิมพ์เล็ก (a–z)">
          <Toggle checked={settings.password.requireLowercase} onChange={v => setPassword('requireLowercase', v)} />
        </Row>

        <Row label="ต้องมีตัวเลข (0–9)">
          <Toggle checked={settings.password.requireNumber} onChange={v => setPassword('requireNumber', v)} />
        </Row>

        <Row label="ต้องมีอักขระพิเศษ (!@#$…)">
          <Toggle checked={settings.password.requireSpecial} onChange={v => setPassword('requireSpecial', v)} />
        </Row>

        <Row label="อายุรหัสผ่านสูงสุด" description="0 = ไม่หมดอายุ  ผู้ใช้ต้องเปลี่ยนรหัสผ่านหลังจากกี่วัน">
          <NumberInput value={settings.password.maxAgeDays} onChange={v => setPassword('maxAgeDays', Math.max(0, v))} min={0} max={365} suffix="วัน" />
        </Row>

        <PasswordStrengthBar policy={settings.password} />
      </Section>

      {/* ── Session Policy ── */}
      <Section icon={Clock} iconColor="#0891b2" title="การจัดการ Session" description="ควบคุมระยะเวลาและจำนวน session การใช้งาน">
        <Row label="หมดเวลาอัตโนมัติ" description="ออกจากระบบเมื่อไม่มีการใช้งานนานเกินกำหนด">
          <NumberInput value={settings.session.sessionTimeoutMinutes} onChange={v => setSession('sessionTimeoutMinutes', Math.max(5, v))} min={5} max={1440} suffix="นาที" />
        </Row>

        <Row label="จำนวน Session พร้อมกันสูงสุด" description="ต่อผู้ใช้หนึ่งคน (0 = ไม่จำกัด)">
          <NumberInput value={settings.session.maxConcurrentSessions} onChange={v => setSession('maxConcurrentSessions', Math.max(0, v))} min={0} max={10} suffix="session" />
        </Row>

        <Row label="จดจำการล็อกอิน (Remember Me)" description="ระยะเวลาที่ระบบจดจำผู้ใช้">
          <NumberInput value={settings.session.rememberMeDays} onChange={v => setSession('rememberMeDays', Math.max(1, v))} min={1} max={90} suffix="วัน" />
        </Row>
      </Section>

      {/* ── Login Security ── */}
      <Section icon={Lock} iconColor="#dc2626" title="ความปลอดภัยการล็อกอิน" description="กำหนดพฤติกรรมเมื่อล็อกอินผิดพลาดและวิธีการเข้าสู่ระบบ">
        <Row label="จำนวนครั้งที่ล็อกอินผิดสูงสุด" description="ก่อนที่บัญชีจะถูกล็อกชั่วคราว">
          <NumberInput value={settings.login.maxFailedAttempts} onChange={v => setLogin('maxFailedAttempts', Math.max(1, v))} min={1} max={20} suffix="ครั้ง" />
        </Row>

        <Row label="ระยะเวลาล็อกบัญชี" description="เมื่อล็อกอินผิดเกินกำหนด">
          <NumberInput value={settings.login.lockoutDurationMinutes} onChange={v => setLogin('lockoutDurationMinutes', Math.max(1, v))} min={1} max={1440} suffix="นาที" />
        </Row>

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.02)' }}>
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide">วิธีการล็อกอินที่อนุญาต</p>
          </div>
          <div className="px-3 divide-y divide-black/[0.04]">
            <div className="py-2.5">
              <Row label="Email / Password">
                <Toggle
                  checked={settings.login.allowedLoginMethods.email}
                  onChange={v => setLogin('allowedLoginMethods', { ...settings.login.allowedLoginMethods, email: v })}
                />
              </Row>
            </div>
            <div className="py-2.5">
              <Row label="Google Sign-In">
                <Toggle
                  checked={settings.login.allowedLoginMethods.google}
                  onChange={v => setLogin('allowedLoginMethods', { ...settings.login.allowedLoginMethods, google: v })}
                />
              </Row>
            </div>
          </div>
        </div>

        <Row
          label="บังคับ MFA (Multi-Factor Authentication)"
          description="ผู้ใช้ทุกคนต้องยืนยันตัวตนสองขั้นตอน"
        >
          <div className="flex items-center gap-2">
            {settings.login.requireMFA && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <ShieldCheck size={11} /> เปิดใช้งาน
              </span>
            )}
            <Toggle checked={settings.login.requireMFA} onChange={v => setLogin('requireMFA', v)} />
          </div>
        </Row>

        {settings.login.requireMFA && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background: '#059669' + '0f', border: '1px solid #059669' + '25' }}
          >
            <Smartphone size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#059669' }} />
            <p className="text-[10px] leading-relaxed" style={{ color: '#059669' }}>
              MFA เปิดใช้งานแล้ว ผู้ใช้จะต้องยืนยันผ่าน Authenticator App หรือ SMS ทุกครั้งที่ล็อกอิน
            </p>
          </motion.div>
        )}
      </Section>

      {/* ── Audit Log ── */}
      <Section icon={ShieldAlert} iconColor="#d97706" title="Audit Log" description="บันทึกกิจกรรมสำคัญในระบบเพื่อการตรวจสอบ">
        <Row
          label="เปิดใช้งาน Audit Log"
          description="บันทึก login, logout, เปลี่ยนแปลงข้อมูล และการดำเนินการของ Admin"
        >
          <Toggle checked={settings.auditLog} onChange={v => setSettings(s => ({ ...s, auditLog: v }))} />
        </Row>

        {!settings.auditLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background: '#f97316' + '0f', border: '1px solid #f97316' + '25' }}
          >
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-orange-500" />
            <p className="text-[10px] leading-relaxed text-orange-600">
              การปิด Audit Log อาจขัดต่อนโยบายการรักษาความปลอดภัยขององค์กร
            </p>
          </motion.div>
        )}
      </Section>

      {/* ── IP Whitelist ── */}
      <Section icon={Shield} iconColor="#0891b2" title="IP Whitelist" description="จำกัดการเข้าถึงระบบจาก IP ที่อนุญาตเท่านั้น">
        <Row label="เปิดใช้งาน IP Whitelist" description="ผู้ใช้จะล็อกอินได้เฉพาะจาก IP ที่ระบุไว้">
          <Toggle
            checked={settings.ipWhitelist.enabled}
            onChange={v => {
              setSettings(s => ({ ...s, ipWhitelist: { ...s.ipWhitelist, enabled: v } }));
              if (v) setShowIpNote(true);
            }}
          />
        </Row>

        {settings.ipWhitelist.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {showIpNote && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-xl"
                style={{ background: '#ef4444' + '0f', border: '1px solid #ef4444' + '20' }}
              >
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-[10px] leading-relaxed text-red-600">
                  ตรวจสอบให้แน่ใจว่า IP ของคุณอยู่ในรายการ มิฉะนั้นคุณอาจถูกล็อกออกจากระบบ
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                รายการ IP (คั่นด้วย Enter หรือ comma)
              </p>
              <textarea
                rows={4}
                value={settings.ipWhitelist.ips}
                onChange={e => setSettings(s => ({ ...s, ipWhitelist: { ...s.ipWhitelist, ips: e.target.value } }))}
                placeholder={'192.168.1.0/24\n10.0.0.1\n203.x.x.x'}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono border border-slate-200 bg-slate-50/50 resize-none focus:outline-none focus:ring-1 focus:ring-slate-300 placeholder:text-black/20"
              />
            </div>
          </motion.div>
        )}

        <div
          className="flex items-start gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <Info size={12} className="text-black/30 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-black/40 leading-relaxed">
            IP Whitelist ต้องใช้ร่วมกับ Firestore Security Rules และ Cloud Functions จึงจะมีผลจริงในการผลิต
          </p>
        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ ...GLASS_CARD, border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.12)', background: 'rgba(239,68,68,0.03)' }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#ef444414', border: '1px solid #ef444425' }}>
            <AlertTriangle size={14} className="text-red-500" />
          </div>
          <div>
            <h2 className="font-bold text-red-600/80 text-xs leading-none">Danger Zone</h2>
            <p className="text-[10px] text-black/35 mt-0.5">การกระทำเหล่านี้ไม่สามารถยกเลิกได้</p>
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-black/70">บังคับออกจากระบบทุก Session</p>
              <p className="text-[10px] text-black/35 mt-0.5">ผู้ใช้ทุกคนจะต้องล็อกอินใหม่ทันที</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-red-50"
              style={{ color: '#dc2626', borderColor: '#dc262630' }}
            >
              <LogOut size={12} />
              Force Logout All
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-black/70">ปลดล็อกบัญชีที่ถูกระงับทั้งหมด</p>
              <p className="text-[10px] text-black/35 mt-0.5">ปลดล็อกบัญชีที่ถูกล็อกเนื่องจากล็อกอินผิดพลาด</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-orange-50"
              style={{ color: '#d97706', borderColor: '#d9770630' }}
            >
              <UserX size={12} />
              Unlock All
            </button>
          </div>
        </div>
      </div>

      {/* ── Save Bar ── */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={GLASS_CARD}>
        <p className="text-xs text-black/40">
          {savedMsg ? (
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
    </motion.div>
  );
}
