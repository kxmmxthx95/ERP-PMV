import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Save, RotateCcw, CheckCircle2, MinusCircle, XCircle,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import {
  ALL_ROLES, ROLE_META, FEATURES, FEATURE_CATEGORIES,
  type AppRole, type AccessLevel,
} from '@/types/permission';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCESS_META: Record<AccessLevel, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  full:    { label: 'เต็มสิทธิ์', icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  partial: { label: 'บางส่วน',   icon: MinusCircle,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  none:    { label: 'ไม่มี',      icon: XCircle,      color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
};

function AccessBadge({ level, onClick, readonly = false }: { level: AccessLevel; onClick?: () => void; readonly?: boolean }) {
  const meta = ACCESS_META[level];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      disabled={readonly}
      title={readonly ? meta.label : `คลิกเพื่อเปลี่ยน: ${meta.label}`}
      className={`w-full flex items-center justify-center transition-all ${readonly ? 'cursor-default' : 'cursor-pointer hover:opacity-75 active:scale-95'}`}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: meta.bg }}
      >
        <Icon size={14} style={{ color: meta.color }} />
      </div>
    </button>
  );
}

// ── Role Summary Card ─────────────────────────────────────────────────────────

function RoleCard({
  role, isSelected, onClick,
  summary,
}: {
  role: AppRole;
  isSelected: boolean;
  onClick: () => void;
  summary: { full: number; partial: number; none: number; total: number };
}) {
  const meta = ROLE_META[role];
  const fullPct = Math.round((summary.full / summary.total) * 100);
  const partialPct = Math.round((summary.partial / summary.total) * 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-3.5 transition-all"
      style={{
        background: isSelected ? meta.bg : 'rgba(255,255,255,0.75)',
        border: isSelected ? `1.5px solid ${meta.color}40` : '1.5px solid rgba(0,0,0,0.06)',
        boxShadow: isSelected ? `0 4px 20px ${meta.color}18` : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}
        >
          <ShieldCheck size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-black/80 truncate">{meta.label}</p>
          <p className="text-[10px] text-black/40">{meta.labelEn}</p>
        </div>
      </div>

      {/* Feature count */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#10b981' }}>
          <CheckCircle2 size={10} /> {summary.full}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
          <MinusCircle size={10} /> {summary.partial}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-black/25">
          <XCircle size={10} /> {summary.none}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full flex">
          <div style={{ width: `${fullPct}%`, background: '#10b981' }} />
          <div style={{ width: `${partialPct}%`, background: '#f59e0b' }} />
        </div>
      </div>

      <p className="text-[10px] text-black/35 mt-1.5 leading-snug line-clamp-2">{meta.description}</p>
    </button>
  );
}

// ── Permission Matrix ─────────────────────────────────────────────────────────

function PermissionMatrix({
  selectedRole,
  getAccess,
  cycleAccess,
}: {
  selectedRole: AppRole | 'all';
  getAccess: (role: AppRole, featureId: string) => AccessLevel;
  cycleAccess: (role: AppRole, featureId: string) => void;
}) {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const displayRoles: AppRole[] = selectedRole === 'all' ? ALL_ROLES : [selectedRole];

  const toggleCat = (cat: string) =>
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const categories = ['academic', 'management', 'system', 'communication'] as const;
  const isSysadminSelected = selectedRole === 'sysadmin';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[600px]">
        {/* Head */}
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-left">
              <span className="text-[11px] font-bold text-black/40 uppercase tracking-wider">ฟีเจอร์ / สิทธิ์</span>
            </th>
            {displayRoles.map(role => {
              const meta = ROLE_META[role];
              return (
                <th key={role} className="px-2 py-2.5 text-center min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
                      <ShieldCheck size={12} className="text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-black/55">{meta.label}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {categories.map(cat => {
            const catMeta = FEATURE_CATEGORIES[cat];
            const catFeatures = FEATURES.filter(f => f.category === cat);
            const isCollapsed = collapsedCats.has(cat);

            return (
              <>
                {/* Category header row */}
                <tr key={`cat-${cat}`} className="cursor-pointer select-none" onClick={() => toggleCat(cat)}>
                  <td
                    colSpan={displayRoles.length + 1}
                    className="sticky left-0 px-4 py-2 text-left"
                    style={{ background: `${catMeta.color}0D` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: catMeta.color }} />
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: catMeta.color }}>
                        {catMeta.label}
                      </span>
                      <span className="text-[10px] text-black/30 ml-1">({catFeatures.length} รายการ)</span>
                      {isCollapsed
                        ? <ChevronDown size={12} className="ml-auto text-black/30" />
                        : <ChevronUp size={12} className="ml-auto text-black/30" />
                      }
                    </div>
                  </td>
                </tr>

                {/* Feature rows */}
                {!isCollapsed && catFeatures.map((feature, idx) => (
                  <tr
                    key={feature.id}
                    className="border-b transition-colors"
                    style={{
                      borderColor: 'rgba(0,0,0,0.04)',
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(248,248,248,0.70)',
                    }}
                  >
                    {/* Feature label */}
                    <td className="sticky left-0 px-4 py-2 backdrop-blur-sm" style={{ background: 'inherit' }}>
                      <span className="text-xs text-black/70 font-medium">{feature.label}</span>
                    </td>

                    {/* Access cells */}
                    {displayRoles.map(role => {
                      const level = getAccess(role, feature.id);
                      return (
                        <td key={role} className="px-2 py-1.5 text-center">
                          <AccessBadge
                            level={level}
                            onClick={isSysadminSelected ? undefined : () => cycleAccess(role, feature.id)}
                            readonly={isSysadminSelected}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

export default function RolePermissionManager() {
  const { isDirty, getAccess, cycleAccess, save, reset, discard, getRoleSummary } = useRolePermissions();
  const [selectedRole, setSelectedRole] = useState<AppRole | 'all'>('all');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    save();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-5 text-black">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">กำหนดสิทธิ์การเข้าถึง</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            กำหนดว่า Role ใดสามารถเข้าถึงฟีเจอร์ใดได้บ้าง · คลิกไอคอนในตารางเพื่อเปลี่ยนระดับสิทธิ์
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty && (
            <>
              <button
                onClick={discard}
                className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium text-black/50 hover:text-black/70 hover:bg-black/06 transition-colors"
              >
                <RotateCcw size={13} /> ยกเลิก
              </button>
              <button
                onClick={() => {
                  if (confirm('รีเซ็ตสิทธิ์ทั้งหมดกลับเป็นค่าเริ่มต้น?')) reset();
                }}
                className="h-8 px-4 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                รีเซ็ต
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-1.5 h-8 px-5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{
              background: saveSuccess
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : isDirty
                  ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                  : 'rgba(0,0,0,0.08)',
              color: isDirty ? 'white' : 'rgba(0,0,0,0.30)',
            }}
          >
            {saveSuccess ? <><CheckCircle2 size={13} /> บันทึกแล้ว!</> : <><Save size={13} /> บันทึก</>}
          </button>
        </div>
      </motion.div>

      {/* ── Legend ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4 px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
      >
        <Info size={13} className="text-indigo-400 flex-shrink-0" />
        <div className="flex items-center gap-5 flex-wrap">
          {Object.entries(ACCESS_META).map(([level, meta]) => {
            const Icon = meta.icon;
            return (
              <div key={level} className="flex items-center gap-1.5">
                <Icon size={13} style={{ color: meta.color }} />
                <span className="text-[11px] font-medium text-black/55">{meta.label}</span>
              </div>
            );
          })}
          <span className="text-[11px] text-black/35">· คลิกที่ไอคอนเพื่อวนสลับสิทธิ์ (ยกเว้น SysAdmin)</span>
        </div>
      </motion.div>

      {/* ── Two column: Role cards + Matrix ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4 items-start">

        {/* Left: Role cards */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          {/* "All roles" toggle */}
          <button
            onClick={() => setSelectedRole('all')}
            className="w-full text-left rounded-2xl px-4 py-3 transition-all"
            style={{
              background: selectedRole === 'all' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.75)',
              border: selectedRole === 'all' ? '1.5px solid rgba(99,102,241,0.25)' : '1.5px solid rgba(0,0,0,0.06)',
            }}
          >
            <p className="text-xs font-bold text-black/70">ดูทุก Role พร้อมกัน</p>
            <p className="text-[10px] text-black/40 mt-0.5">แสดงตารางเปรียบเทียบ 6 roles</p>
          </button>

          {ALL_ROLES.map(role => (
            <RoleCard
              key={role}
              role={role}
              isSelected={selectedRole === role}
              onClick={() => setSelectedRole(role)}
              summary={getRoleSummary(role)}
            />
          ))}
        </motion.div>

        {/* Right: Permission matrix */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={glassCard}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-black/05"
            style={{ background: 'rgba(255,255,255,0.9)' }}
          >
            <div>
              <h2 className="text-sm font-bold text-black/75">
                {selectedRole === 'all'
                  ? 'ตาราง Permission Matrix — ทุก Role'
                  : `สิทธิ์ของ: ${ROLE_META[selectedRole].label}`}
              </h2>
              <p className="text-[11px] text-black/35">
                {selectedRole === 'all'
                  ? 'เปรียบเทียบสิทธิ์ทุก Role แบบ side-by-side'
                  : ROLE_META[selectedRole].description}
              </p>
            </div>

            {selectedRole !== 'all' && selectedRole !== 'sysadmin' && (
              <div className="text-[10px] text-indigo-500 font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.08)' }}>
                คลิกไอคอนเพื่อแก้ไข
              </div>
            )}
            {selectedRole === 'sysadmin' && (
              <div className="text-[10px] text-violet-500 font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.08)' }}>
                SysAdmin มีสิทธิ์เต็มทุกฟีเจอร์
              </div>
            )}
          </div>

          <PermissionMatrix
            selectedRole={selectedRole}
            getAccess={getAccess}
            cycleAccess={cycleAccess}
          />
        </motion.div>
      </div>

      {/* ── Unsaved changes banner ── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
            style={{
              background: 'rgba(30,30,30,0.90)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs text-white font-medium">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>
            <button
              onClick={handleSave}
              className="ml-2 px-4 py-1.5 rounded-xl text-xs font-semibold text-black bg-white hover:bg-white/90 transition-colors"
            >
              บันทึก
            </button>
            <button
              onClick={discard}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              ยกเลิก
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
