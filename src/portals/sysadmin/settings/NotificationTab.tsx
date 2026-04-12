import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellOff, Mail, MessageSquare, Smartphone,
  GraduationCap, ClipboardList, CalendarCheck, UserCheck,
  Save, RotateCcw, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GLASS_CARD } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────
type Channel = 'inApp' | 'email' | 'sms';

interface EventConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  channels: Record<Channel, boolean>;
  roles: string[];
}

interface NotificationSettings {
  channels: Record<Channel, boolean>;
  events: Record<string, Record<Channel, boolean>>;
  quiet: { enabled: boolean; from: string; to: string };
  digest: { enabled: boolean; frequency: 'realtime' | 'daily' | 'weekly' };
}

// ── Default event catalog ─────────────────────────────────────────────────────
const EVENT_CATALOG: EventConfig[] = [
  {
    id: 'grade_published',
    label: 'ประกาศผลคะแนน',
    description: 'เมื่อครูบันทึกหรืออัปเดตคะแนนนักเรียน',
    icon: GraduationCap,
    color: '#7c3aed',
    channels: { inApp: true, email: true, sms: false },
    roles: ['student', 'parent'],
  },
  {
    id: 'attendance_absent',
    label: 'นักเรียนขาดเรียน',
    description: 'เมื่อนักเรียนถูกบันทึกว่าขาดเรียนหรือมาสาย',
    icon: ClipboardList,
    color: '#dc2626',
    channels: { inApp: true, email: true, sms: true },
    roles: ['parent', 'teacher'],
  },
  {
    id: 'schedule_change',
    label: 'ตารางเรียนเปลี่ยนแปลง',
    description: 'เมื่อมีการแก้ไขตารางเรียนหรือย้ายห้อง',
    icon: CalendarCheck,
    color: '#0891b2',
    channels: { inApp: true, email: false, sms: false },
    roles: ['student', 'parent', 'teacher'],
  },
  {
    id: 'announcement',
    label: 'ประกาศทั่วไป',
    description: 'ประกาศจากผู้บริหารหรือครูถึงนักเรียน/ผู้ปกครอง',
    icon: Bell,
    color: '#d97706',
    channels: { inApp: true, email: true, sms: false },
    roles: ['student', 'parent', 'teacher', 'staff'],
  },
  {
    id: 'new_user',
    label: 'บัญชีผู้ใช้ใหม่',
    description: 'เมื่อมีการสร้างบัญชีผู้ใช้ใหม่ในระบบ',
    icon: UserCheck,
    color: '#059669',
    channels: { inApp: true, email: true, sms: false },
    roles: ['admin', 'sysadmin'],
  },
];

const DEFAULT_SETTINGS: NotificationSettings = {
  channels: { inApp: true, email: true, sms: false },
  events: Object.fromEntries(
    EVENT_CATALOG.map(e => [e.id, { ...e.channels }])
  ),
  quiet: { enabled: false, from: '22:00', to: '07:00' },
  digest: { enabled: false, frequency: 'daily' },
};

const ROLE_LABELS: Record<string, string> = {
  student: 'นักเรียน',
  parent: 'ผู้ปกครอง',
  teacher: 'ครู',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแล',
  sysadmin: 'ซิสแอดมิน',
};

const CHANNEL_META: { key: Channel; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { key: 'inApp',  label: 'In-App',   icon: Bell,           color: '#7c3aed' },
  { key: 'email',  label: 'อีเมล',    icon: Mail,           color: '#0891b2' },
  { key: 'sms',    label: 'SMS',       icon: Smartphone,     color: '#059669' },
];

// ── Section ───────────────────────────────────────────────────────────────────
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
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
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

// ── ChannelBadge ──────────────────────────────────────────────────────────────
function ChannelBadge({
  channelKey,
  active,
  onClick,
}: {
  channelKey: Channel;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CHANNEL_META.find(c => c.key === channelKey)!;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all duration-150"
      style={
        active
          ? { background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35` }
          : { background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.3)', border: '1px solid transparent' }
      }
    >
      <Icon size={10} />
      {meta.label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotificationTab() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('school_notification_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<NotificationSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
  });
  const [savedMsg, setSavedMsg] = useState(false);

  // ── Updaters ────────────────────────────────────────────────────────────────
  const setGlobalChannel = (ch: Channel, val: boolean) =>
    setSettings(s => ({ ...s, channels: { ...s.channels, [ch]: val } }));

  const setEventChannel = (eventId: string, ch: Channel, val: boolean) =>
    setSettings(s => ({
      ...s,
      events: {
        ...s.events,
        [eventId]: { ...s.events[eventId], [ch]: val },
      },
    }));

  const setQuiet = <K extends keyof NotificationSettings['quiet']>(
    key: K,
    val: NotificationSettings['quiet'][K]
  ) => setSettings(s => ({ ...s, quiet: { ...s.quiet, [key]: val } }));

  const setDigest = <K extends keyof NotificationSettings['digest']>(
    key: K,
    val: NotificationSettings['digest'][K]
  ) => setSettings(s => ({ ...s, digest: { ...s.digest, [key]: val } }));

  const handleSave = () => {
    localStorage.setItem('school_notification_settings', JSON.stringify(settings));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('school_notification_settings');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* ── Global Channels ── */}
      <Section icon={Bell} title="ช่องทางการแจ้งเตือน" description="เปิด/ปิดช่องทางระดับระบบ">
        <div className="space-y-3">
          {CHANNEL_META.map(ch => {
            const Icon = ch.icon;
            const enabled = settings.channels[ch.key];
            return (
              <div key={ch.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${ch.color}14`, border: `1px solid ${ch.color}25` }}
                  >
                    <Icon size={13} style={{ color: ch.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black/75">{ch.label}</p>
                    <p className="text-[10px] text-black/35">
                      {ch.key === 'inApp' && 'แจ้งเตือนภายในแอปพลิเคชัน'}
                      {ch.key === 'email' && 'ส่งอีเมลไปยังผู้ใช้งาน'}
                      {ch.key === 'sms' && 'ส่ง SMS ไปยังเบอร์โทรที่ลงทะเบียน'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-black/35">{enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                  <Toggle checked={enabled} onChange={v => setGlobalChannel(ch.key, v)} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Per-event Settings ── */}
      <Section icon={MessageSquare} title="การแจ้งเตือนตามเหตุการณ์" description="กำหนดช่องทางแจ้งเตือนสำหรับแต่ละเหตุการณ์">
        <div className="space-y-1">
          {EVENT_CATALOG.map((ev, i) => {
            const Icon = ev.icon;
            const evChannels = settings.events[ev.id] ?? ev.channels;
            const anyEnabled = Object.values(evChannels).some(Boolean);
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 py-2.5 px-1 rounded-xl hover:bg-black/[0.015] transition-colors"
              >
                {/* Icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${ev.color}12`, border: `1px solid ${ev.color}20` }}
                >
                  <Icon size={13} style={{ color: ev.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-black/75">{ev.label}</span>
                    {!anyEnabled && (
                      <Badge className="text-[9px] px-1.5 py-0 h-3.5 bg-black/05 text-black/35 border-0">
                        <BellOff size={8} className="mr-0.5" />ปิด
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-black/35 mt-0.5">{ev.description}</p>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {ev.roles.map(r => (
                      <span
                        key={r}
                        className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}
                      >
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Channel toggles */}
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {CHANNEL_META.map(ch => (
                    <ChannelBadge
                      key={ch.key}
                      channelKey={ch.key}
                      active={evChannels[ch.key] && settings.channels[ch.key]}
                      onClick={() => setEventChannel(ev.id, ch.key, !evChannels[ch.key])}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div
          className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <Info size={12} className="text-black/30 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-black/40 leading-relaxed">
            ช่องทางที่เปิดไว้แต่ถูกปิดในระดับระบบ (ด้านบน) จะไม่ส่งการแจ้งเตือน
          </p>
        </div>
      </Section>

      {/* ── Quiet Hours ── */}
      <Section icon={BellOff} title="ช่วงเวลาเงียบ" description="ระงับการแจ้งเตือนในช่วงเวลาที่กำหนด">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-black/70">เปิดใช้งานช่วงเวลาเงียบ</p>
            <p className="text-[10px] text-black/35 mt-0.5">การแจ้งเตือนจะถูกเก็บไว้ส่งหลังช่วงเวลานี้</p>
          </div>
          <Toggle checked={settings.quiet.enabled} onChange={v => setQuiet('enabled', v)} />
        </div>

        {settings.quiet.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-4"
          >
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">เวลาเริ่ม</p>
              <input
                type="time"
                value={settings.quiet.from}
                onChange={e => setQuiet('from', e.target.value)}
                className="h-8 px-3 rounded-lg text-xs border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="text-black/25 text-sm mt-5">—</div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">เวลาสิ้นสุด</p>
              <input
                type="time"
                value={settings.quiet.to}
                onChange={e => setQuiet('to', e.target.value)}
                className="h-8 px-3 rounded-lg text-xs border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
          </motion.div>
        )}
      </Section>

      {/* ── Digest ── */}
      <Section icon={Mail} title="สรุปการแจ้งเตือน (Digest)" description="รวมการแจ้งเตือนหลายรายการส่งเป็นชุด">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-black/70">เปิดใช้งานการส่งแบบ Digest</p>
            <p className="text-[10px] text-black/35 mt-0.5">แทนที่จะส่งทีละรายการ จะรวมและส่งเป็นชุด</p>
          </div>
          <Toggle checked={settings.digest.enabled} onChange={v => setDigest('enabled', v)} />
        </div>

        {settings.digest.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">ความถี่ในการส่ง</p>
            <div className="flex gap-2">
              {(
                [
                  { value: 'realtime', label: 'ทันที' },
                  { value: 'daily',    label: 'รายวัน' },
                  { value: 'weekly',   label: 'รายสัปดาห์' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDigest('frequency', opt.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={
                    settings.digest.frequency === opt.value
                      ? { background: '#1e1e1e', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                      : { background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.55)' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </Section>

      {/* ── Save Bar ── */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={GLASS_CARD}
      >
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

      <Separator className="opacity-0 h-1" />
    </motion.div>
  );
}
