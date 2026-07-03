import { useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutGrid, Menu } from 'lucide-react';
import { HiBars3 } from 'react-icons/hi2';
import { useAllRolePermissions, useUpdateRolePermission, useInitializeRolePermissions } from '@/hooks/useRolePermissions';
import type { AccessLevel, FeaturePermission } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';
import {
  getFeatureCategoryLabel,
  getFeatureDisplayName,
  getFeatureIcon,
} from '@/lib/featurePermissionMeta';
import { cn } from '@/lib/utils';

// ── Feature Lists ──────────────────────────────────────────────────────────────
// Widget = สิ่งที่แสดงบน dashboard (ON/OFF)
const WIDGET_FEATURE_KEYS = FEATURE_LIST
  .filter((f) => f.featureKey.startsWith('widget_'))
  .map((f) => f.featureKey);
const WIDGET_FEATURES: FeaturePermission[] = FEATURE_LIST.filter(f => WIDGET_FEATURE_KEYS.includes(f.featureKey));
// Menu = เมนู sidebar ทั้งหมดในระบบ (RotaryKnob access level)
const MENU_FEATURES: FeaturePermission[] = FEATURE_LIST.filter(f => !WIDGET_FEATURE_KEYS.includes(f.featureKey));

// ── Constants ──────────────────────────────────────────────────────────────────
const ROLES = [
  { key: 'sysadmin', label: 'SysAdmin', shortLabel: 'SYS', color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' }, // Violet
  { key: 'admin', label: 'ผู้บริหาร', shortLabel: 'ADM', color: '#0ea5e9', glow: 'rgba(14,165,233,0.35)' }, // Sky
  { key: 'teacher', label: 'ครูผู้สอน', shortLabel: 'TCH', color: '#f43f5e', glow: 'rgba(244,63,94,0.35)' },  // Rose
  { key: 'staff', label: 'เจ้าหน้าที่', shortLabel: 'STF', color: '#10b981', glow: 'rgba(16,185,129,0.35)' }, // Emerald
  { key: 'parent', label: 'ผู้ปกครอง', shortLabel: 'PAR', color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' }, // Blue
  { key: 'student', label: 'นักเรียน', shortLabel: 'STU', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' }, // Amber
] as const;

const KNOB_POSITIONS = [
  { level: null, label: '—', angle: -135, color: '#cbd5e1' },
  { level: 'view-only', label: 'View', angle: -45, color: '#f59e0b' },
  { level: 'edit', label: 'Edit', angle: 45, color: '#3b82f6' },
  { level: 'full', label: 'Full', angle: 135, color: '#10b981' },
] as const;

const CARD = 'rgba(255,255,255,0.85)';
const BORDER = '#e2e8f0';
const PER_PAGE = 8;
const LABEL_LONG_PRESS_MS = 450;

function FeatureRowLabel({ feature }: { feature: FeaturePermission }) {
  const [showFullLabel, setShowFullLabel] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = getFeatureIcon(feature.featureKey);
  const displayName = getFeatureDisplayName(feature);
  const categoryLabel = getFeatureCategoryLabel(feature);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const bindLongPress = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        setShowFullLabel(true);
        if (navigator.vibrate) navigator.vibrate(30);
      }, LABEL_LONG_PRESS_MS);
    },
    onPointerUp: () => {
      clearLongPressTimer();
      setShowFullLabel(false);
    },
    onPointerLeave: () => {
      clearLongPressTimer();
      setShowFullLabel(false);
    },
    onPointerCancel: () => {
      clearLongPressTimer();
      setShowFullLabel(false);
    },
    onContextMenu: (e: ReactMouseEvent) => {
      e.preventDefault();
      setShowFullLabel(true);
    },
  };

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2 px-2 py-2 sm:px-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 shadow-sm"
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>

      <div
        {...bindLongPress}
        className="min-w-0 flex-1 touch-manipulation select-none"
        title={displayName}
      >
        <div className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-800 sm:text-[12px]">
          {displayName}
        </div>
        <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-slate-400">
          {categoryLabel}
        </div>
      </div>

      {showFullLabel && (
        <div
          className="absolute left-2 right-2 bottom-full z-30 mb-1.5 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 shadow-lg"
          role="tooltip"
        >
          <p className="text-[12px] font-bold leading-snug text-white">{displayName}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-300">{categoryLabel}</p>
        </div>
      )}
    </div>
  );
}

// ── Rotary Knob ────────────────────────────────────────────────────────────────
interface KnobProps {
  position: number;
  color: string;
  glow: string;
  disabled?: boolean;
  onChange: (pos: number) => void;
}

function RotaryKnob({ position, color, glow, disabled, onChange }: KnobProps) {
  const startY      = useRef(0);
  const startPos    = useRef(0);
  const dragged     = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    startY.current   = e.clientY;
    startPos.current = position;
    dragged.current  = false;
    const onMove = (ev: MouseEvent) => {
      const delta = startY.current - ev.clientY;
      if (Math.abs(delta) > 3) dragged.current = true;
      onChangeRef.current(Math.max(0, Math.min(3, Math.round(startPos.current + delta / 18))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTimeout(() => { dragged.current = false; }, 50);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [disabled, position]);

  const handleClick = useCallback(() => {
    if (disabled || dragged.current) return;
    onChangeRef.current((position + 1) % 4);
  }, [disabled, position]);

  const knob = KNOB_POSITIONS[position];
  const active = position > 0;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* LED */}
      <div
        className="w-2 h-2 rounded-full transition-all duration-300"
        style={{
          background: active ? knob.color : '#e2e8f0',
          boxShadow: active ? `0 0 6px ${knob.color}, 0 0 12px ${glow}` : 'none',
        }}
      />
      {/* Knob body */}
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className="relative cursor-pointer"
        style={{ width: 40, height: 40 }}
      >
        <svg width={40} height={40} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={20} cy={20} r={16} fill="none" stroke={BORDER} strokeWidth={2.5}
            strokeDasharray="100 25" strokeLinecap="round" />
          {active && (
            <circle cx={20} cy={20} r={16} fill="none" stroke={color} strokeWidth={2.5}
              strokeDasharray={`${(position / 3) * 100} ${125 - (position / 3) * 100}`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${glow})`, transition: 'stroke-dasharray 0.2s ease' }}
            />
          )}
        </svg>
        <motion.div
          animate={{ rotate: knob.angle }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="absolute inset-[5px] rounded-full"
          style={{
            background: active
              ? `radial-gradient(circle at 38% 32%, ${color}20, ${color}08)`
              : 'radial-gradient(circle at 38% 32%, #f8fafc, #e2e8f0)',
            border: `1.5px solid ${active ? color : '#cbd5e1'}`,
            boxShadow: active
              ? `0 0 8px ${glow}, inset 0 1px 0 rgba(255,255,255,0.9)`
              : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.07)',
          }}
        >
          <div className="absolute rounded-full" style={{
            width: 3, height: 3,
            background: active ? color : '#94a3b8',
            top: 4, left: '50%', transform: 'translateX(-50%)',
            boxShadow: active ? `0 0 4px ${color}` : 'none',
          }} />
        </motion.div>
      </div>
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: active ? color : '#94a3b8' }}>
        {knob.label}
      </span>
    </div>
  );
}

// ── Push Button (Widget toggle) ────────────────────────────────────────────────
interface PushButtonProps {
  enabled: boolean;
  color: string;
  glow: string;
  disabled?: boolean;
  onPress: () => void;
}

function PushButton({ enabled, color, glow, disabled, onPress }: PushButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    if (disabled) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    onPress();
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {/* LED */}
      <div
        className="w-2 h-2 rounded-full transition-all duration-300"
        style={{
          background: enabled ? color : '#e2e8f0',
          boxShadow: enabled ? `0 0 6px ${color}, 0 0 12px ${glow}` : 'none',
        }}
      />
      {/* Button body */}
      <motion.button
        onMouseDown={handlePress}
        disabled={disabled}
        animate={pressed ? { scale: 0.82, y: 2 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
        className="relative rounded-full cursor-pointer focus:outline-none"
        style={{
          width: 34, height: 34,
          background: enabled
            ? `radial-gradient(circle at 38% 32%, ${color}44, ${color}18)`
            : 'radial-gradient(circle at 38% 32%, #f1f5f9, #e2e8f0)',
          border: `2px solid ${enabled ? color : '#cbd5e1'}`,
          boxShadow: enabled
            ? `0 0 10px ${glow}, 0 3px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)`
            : '0 3px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <div className="absolute rounded-full" style={{
          inset: 4,
          background: enabled
            ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), transparent 60%)`
            : 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.8), transparent 60%)',
        }} />
      </motion.button>
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: enabled ? color : '#94a3b8' }}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

// ── Widget Row (LEFT panel) ────────────────────────────────────────────────────
interface WidgetRowProps {
  feature: FeaturePermission;
  allConfigs: Record<string, any> | null;
  isUpdating: boolean;
  onToggle: (roleKey: string) => void;
}

function WidgetRow({ feature, allConfigs, isUpdating, onToggle }: WidgetRowProps) {
  const getPerm = (rk: string) =>
    allConfigs?.[rk]?.permissions?.find((p: FeaturePermission) => p.featureKey === feature.featureKey);

  return (
    <div className="relative flex items-center rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <FeatureRowLabel feature={feature} />
      {ROLES.map(role => {
        const enabled = getPerm(role.key)?.enabled ?? feature.enabled;
        return (
          <div key={role.key} className="flex items-center justify-center py-1.5"
            style={{ borderLeft: `1px solid ${BORDER}`, width: 46, minWidth: 46 }}>
            <PushButton
              enabled={enabled}
              color={role.color}
              glow={role.glow}
              disabled={isUpdating}
              onPress={() => onToggle(role.key)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Menu Row (RIGHT panel) ─────────────────────────────────────────────────────
interface MenuRowProps {
  feature: FeaturePermission;
  allConfigs: Record<string, any> | null;
  isUpdating: boolean;
  onKnob: (roleKey: string, pos: number) => void;
}

function MenuRow({ feature, allConfigs, isUpdating, onKnob }: MenuRowProps) {
  const getPerm = (rk: string) =>
    allConfigs?.[rk]?.permissions?.find((p: FeaturePermission) => p.featureKey === feature.featureKey);

  const getPos = (rk: string) => {
    const p = getPerm(rk);
    if (!p?.enabled) return 0;
    if (p.accessLevel === 'full') return 3;
    if (p.accessLevel === 'edit') return 2;
    return 1;
  };

  return (
    <div className="relative flex items-center rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <FeatureRowLabel feature={feature} />
      {ROLES.map(role => (
        <div key={role.key} className="flex items-center justify-center py-1.5"
          style={{ borderLeft: `1px solid ${BORDER}`, width: 46, minWidth: 46 }}>
          <RotaryKnob
            position={getPos(role.key)}
            color={role.color}
            glow={role.glow}
            disabled={isUpdating}
            onChange={pos => onKnob(role.key, pos)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────
interface PanelProps {
  title: string;
  icon: React.ReactNode;
  features: FeaturePermission[];
  searchTerm: string;
  onSearch: (v: string) => void;
  currentPage: number;
  onPage: (p: number) => void;
  children: (paged: FeaturePermission[]) => React.ReactNode;
}

function Panel({ title, icon, features, searchTerm, onSearch, currentPage, onPage, children }: PanelProps) {
  const filtered = features.filter(f =>
    f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getFeatureDisplayName(f).toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.featureKey.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const total = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE);

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">{title}</span>
      </div>

      {/* Role header + search */}
      <div className="flex items-center rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex-1 px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <Search size={11} style={{ color: '#94a3b8' }} />
            <input
              value={searchTerm}
              onChange={e => { onSearch(e.target.value); onPage(0); }}
              placeholder="ค้นหา..."
              className="bg-transparent text-[11px] outline-none w-full"
              style={{ color: '#475569' }}
            />
          </div>
        </div>
        {ROLES.map(role => (
          <div key={role.key} className="flex flex-col items-center justify-center py-2"
            style={{ borderLeft: `1px solid ${BORDER}`, minWidth: 46, width: 46 }}>
            <div className="w-5 h-0.5 rounded-full mb-1"
              style={{ background: role.color, boxShadow: `0 0 4px ${role.glow}` }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: role.color }}>
              {role.shortLabel}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <motion.div
        key={currentPage}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50 && currentPage < total - 1) onPage(currentPage + 1);
          if (info.offset.x > 50 && currentPage > 0) onPage(currentPage - 1);
        }}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex flex-col gap-1.5 overflow-visible cursor-grab active:cursor-grabbing"
      >
        <AnimatePresence mode="popLayout">
          {children(paged)}
        </AnimatePresence>
      </motion.div>

      {/* Pagination */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => onPage(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: currentPage === i ? 18 : 6,
                height: 6,
                background: currentPage === i ? '#6366f1' : '#e2e8f0',
                boxShadow: currentPage === i ? '0 0 6px rgba(99,102,241,0.4)' : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type MobilePanel = 'widget' | 'menu';

const MOBILE_PANEL_OPTIONS: Array<{
  id: MobilePanel;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'widget', label: 'วิดเจ็ต', icon: LayoutGrid },
  { id: 'menu', label: 'เมนู', icon: Menu },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RolePermissionManager() {
  const { data: allConfigs, isLoading } = useAllRolePermissions();
  const { mutate: updatePermission, isPending: isUpdating } = useUpdateRolePermission();
  const { mutate: initializeDefaults, isPending: isInitializing } = useInitializeRolePermissions();

  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [leftPage, setLeftPage] = useState(0);
  const [rightPage, setRightPage] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('widget');
  const [mobilePanelMenuOpen, setMobilePanelMenuOpen] = useState(false);
  const [mobileActionsEl, setMobileActionsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const handleToggle = (roleKey: string, featureKey: string) => {
    const roleConfig = allConfigs?.[roleKey];
    const existingPerm = roleConfig?.permissions?.find((p: FeaturePermission) => p.featureKey === featureKey);
    const feature = FEATURE_LIST.find(f => f.featureKey === featureKey);
    
    if (!feature) return;

    // Use existing perm if found, otherwise use default from FEATURE_LIST
    const currentEnabled = existingPerm?.enabled ?? feature.enabled;
    
    updatePermission({
      roleId: roleKey,
      permission: { 
        ...feature, 
        enabled: !currentEnabled, 
        accessLevel: existingPerm?.accessLevel ?? feature.accessLevel 
      },
    });
  };

  const handleKnob = (roleKey: string, featureKey: string, pos: number) => {
    const feature = FEATURE_LIST.find(f => f.featureKey === featureKey);
    if (!feature) return;
    const levelMap: Record<number, AccessLevel> = { 1: 'view-only', 2: 'edit', 3: 'full' };
    updatePermission({
      roleId: roleKey,
      permission: { ...feature, enabled: pos > 0, accessLevel: levelMap[pos] ?? 'view-only' },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin" />
        <span className="text-sm">กำลังโหลดข้อมูลสิทธิ์...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Portal to Header — desktop reset */}
      {typeof document !== 'undefined' && createPortal(
        <button
          onClick={() => initializeDefaults()}
          disabled={isInitializing}
          className="hidden lg:inline-flex px-5 py-2 rounded-full text-[11px] font-bold transition-all bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 shadow-lg shadow-slate-900/10 active:scale-95"
        >
          {isInitializing ? 'กำลังรีเซ็ต...' : 'RESET DEFAULT'}
        </button>,
        document.getElementById('header-portal-right-actions') || document.body
      )}

      {/* Mobile — hamburger menu: Widget / Menu */}
      {mobileActionsEl && createPortal(
        <div className="pointer-events-auto relative lg:hidden">
          <button
            type="button"
            onClick={() => setMobilePanelMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            title="เลือกวิดเจ็ตหรือเมนู"
            aria-label="เลือกวิดเจ็ตหรือเมนู"
            aria-expanded={mobilePanelMenuOpen}
          >
            <HiBars3 className="h-4 w-4" />
          </button>

          {mobilePanelMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[90]"
                aria-label="ปิดเมนู"
                onClick={() => setMobilePanelMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-[100] mt-1.5 w-48 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
                  จัดการสิทธิ์
                </p>
                {MOBILE_PANEL_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = mobilePanel === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setMobilePanel(option.id);
                        if (option.id === 'widget') setLeftPage(0);
                        else setRightPage(0);
                        setMobilePanelMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        mobileActionsEl,
      )}

      <div className="flex gap-4 flex-1 min-h-0 flex-col lg:flex-row">

        {/* LEFT — Widget push-button */}
        <div className={cn('flex min-h-0 flex-1 flex-col', mobilePanel !== 'widget' && 'hidden lg:flex')}>
        <Panel
          title="วิดเจ็ต"
          icon={<LayoutGrid size={14} />}
          features={WIDGET_FEATURES}
          searchTerm={leftSearch}
          onSearch={setLeftSearch}
          currentPage={leftPage}
          onPage={setLeftPage}
        >
          {(paged) => paged.map(feature => (
            <WidgetRow
              key={feature.featureKey}
              feature={feature}
              allConfigs={allConfigs}
              isUpdating={isUpdating}
              onToggle={(rk: string) => handleToggle(rk, feature.featureKey)}
            />
          ))}
        </Panel>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px self-stretch" style={{ background: BORDER }} />

        {/* RIGHT — Menu rotary knob */}
        <div className={cn('flex min-h-0 flex-1 flex-col', mobilePanel !== 'menu' && 'hidden lg:flex')}>
        <Panel
          title="เมนู"
          icon={<Menu size={14} />}
          features={MENU_FEATURES}
          searchTerm={rightSearch}
          onSearch={setRightSearch}
          currentPage={rightPage}
          onPage={setRightPage}
        >
          {(paged) => paged.map(feature => (
            <MenuRow
              key={feature.featureKey}
              feature={feature}
              allConfigs={allConfigs}
              isUpdating={isUpdating}
              onKnob={(rk: string, pos: number) => handleKnob(rk, feature.featureKey, pos)}
            />
          ))}
        </Panel>
        </div>
      </div>
    </div>
  );
}
