/**
 * StaffAttendancePage.refactored.example.tsx
 *
 * This is an EXAMPLE showing how you COULD refactor the existing
 * StaffAttendancePage to use the new AttendanceCheckInWidget.
 *
 * NOTE: This is NOT meant to replace the current page immediately.
 * It shows how the widget extraction allows cleaner code organization.
 *
 * USAGE: You can either:
 * 1. Keep StaffAttendancePage.tsx as-is (no changes needed)
 * 2. Gradually refactor to use AttendanceCheckInWidget
 * 3. Use AttendanceCheckInWidget in other pages (home, dashboard, etc.)
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminStaffAttendance, type AttendanceStatus } from '@/hooks/useStaffAttendance';
import AttendanceCheckInWidget from '@/components/attendance/AttendanceCheckInWidget';
import AttendanceSettingsPanel from './AttendanceSettingsPanel';
import { WIDGET_GLASS } from '@/features/home/widgetStyles';

// ── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  present: { label: 'มาตรงเวลา', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  late: { label: 'มาสาย', bg: 'bg-amber-100', text: 'text-amber-700' },
  absent: { label: 'ขาดงาน', bg: 'bg-red-100', text: 'text-red-700' },
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ── Admin Panel (Simplified) ──────────────────────────────────────────────────
function AdminPanel() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'late' | 'absent'>('all');
  const { records, loading, refresh } = useAdminStaffAttendance(selectedDate);

  const filtered = records.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const summary = {
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
  };


  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'มาตรงเวลา', value: summary.present, bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'มาสาย', value: summary.late, bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'ขาดงาน', value: summary.absent, bg: 'bg-red-50', text: 'text-red-700' },
        ].map(c => (
          <div key={c.label} style={WIDGET_GLASS} className={`rounded-2xl p-3 text-center ${c.bg}`}>
            <p className={`text-2xl font-black ${c.text}`}>{c.value}</p>
            <p className={`text-xs font-medium ${c.text}`}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={WIDGET_GLASS} className="rounded-3xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: 'ทั้งหมด' },
            { key: 'late' as const, label: 'มาสาย' },
            { key: 'absent' as const, label: 'ยังไม่เข้า' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === t.key ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={WIDGET_GLASS} className="rounded-3xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">ไม่มีข้อมูล</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {r.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-700 truncate">{r.displayName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page (Using AttendanceCheckInWidget) ───────────────────────────────
export default function StaffAttendancePageRefactored() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const [tab, setTab] = useState<'checkin' | 'team' | 'settings'>(isAdmin ? 'team' : 'checkin');

  const tabs = isAdmin
    ? [
      { key: 'team' as const, label: 'ภาพรวมทีม' },
      { key: 'settings' as const, label: <span className="flex items-center gap-1"><Settings size={13} />ตั้งค่า</span> },
    ]
    : [];

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header Portal for Tabs */}
      {tabs.length > 1 && typeof document !== 'undefined' && document.getElementById('header-portal-center') && createPortal(
        <div className="flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-6 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${tab === t.key
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>,
        document.getElementById('header-portal-center')!
      )}

      <AnimatePresence mode="wait">
        {tab === 'checkin' && (
          <motion.div key="checkin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            {/* ← REFACTORED: Now uses AttendanceCheckInWidget directly */}
            <AttendanceCheckInWidget
              compact={false}
              showHistory={true}
              onStatusChange={(status) => {
                // Optional: Log, analytics, notifications, etc.
                console.log('Attendance status updated:', status);
              }}
            />
          </motion.div>
        )}
        {tab === 'team' && (
          <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <AdminPanel />
          </motion.div>
        )}
        {tab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AttendanceSettingsPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * KEY BENEFITS OF THIS REFACTORING:
 *
 * 1. Separation of Concerns
 *    - AttendanceCheckInWidget handles user check-in/out
 *    - AdminPanel handles team overview
 *    - Settings remain independent
 *
 * 2. Reusability
 *    - Widget can be used in home, dashboard, staff portal, etc.
 *    - No duplication of check-in logic
 *
 * 3. Maintainability
 *    - Single source of truth for UI
 *    - Easier to add features (offline support, biometric, etc.)
 *    - Consistent styling across app
 *
 * 4. Testability
 *    - Widget can be tested independently
 *    - Admin panel can be tested separately
 *
 * 5. Code Size
 *    - StaffAttendancePage is ~150 lines instead of ~450 lines
 *    - Admin panel logic is concentrated and clear
 */
