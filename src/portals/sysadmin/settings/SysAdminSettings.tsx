import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2 } from 'lucide-react';
import AcademicYearTab from './AcademicYearTab';
import GeneralTab from './GeneralTab';
import NotificationTab from './NotificationTab';
import SecurityTab from './SecurityTab';
import ImportTab from './ImportTab';
import BackupTab from './BackupTab';
import RolePermissionManager from '@/features/roles/RolePermissionManager';
import { useAuth } from '@/hooks/useAuth';
import { setActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { SETTINGS_TABS, GLASS_CARD } from './constants';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AcademicYear } from './types';

// ── Main Component ────────────────────────────────────────────────────────────
export default function SysAdminSettings() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('academic-year');
  const [years, setYears] = useState<AcademicYear[]>([]);

  // Sync active academic year to localStorage when it changes
  useEffect(() => {
    const activeYear = years.find(y => y.isActive);
    setActiveAcademicYear(activeYear || null);
  }, [years]);

  // Fetch from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'academic_years'), (snapshot) => {
      const fetchedYears = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AcademicYear[];
      fetchedYears.sort((a, b) => Number(b.year) - Number(a.year));
      setYears(fetchedYears);
    });
    return () => unsubscribe();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddYear = async (year: Omit<AcademicYear, 'id' | 'isActive'>) => {
    await addDoc(collection(db, 'academic_years'), { ...year, isActive: false });
  };

  const handleEditYear = async (id: string, year: Omit<AcademicYear, 'id' | 'isActive'>) => {
    await updateDoc(doc(db, 'academic_years', id), year as any);
  };

  const handleDeleteYear = async (id: string) => {
    await deleteDoc(doc(db, 'academic_years', id));
  };

  const handleSetActive = async (id: string) => {
    const batch = writeBatch(db);
    years.forEach(y => {
      batch.update(doc(db, 'academic_years', y.id), { isActive: y.id === id });
    });
    await batch.commit();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 text-black">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-black/85 tracking-tight">ตั้งค่าระบบ</h1>
          <p className="text-xs text-black/40 mt-0.5">จัดการการตั้งค่าระบบและข้อมูลพื้นฐาน</p>
        </motion.div>

        {/* Horizontal Tabs */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.25rem',
          }}
        >
          {SETTINGS_TABS.filter(tab => {
            if (tab.id === 'curriculum') return false;
            // Only sysadmin can see 'roles' tab
            if (tab.id === 'roles' && role !== 'sysadmin') return false;
            return true;
          }).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 flex-shrink-0"
              style={{
                background: active
                  ? '#1e1e1e'
                  : 'transparent',
                color: active ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <Icon
                size={14}
                className="flex-shrink-0"
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
        </motion.div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'academic-year' && (
          <AcademicYearTab
            key="academic-year"
            years={years}
            onAddYear={handleAddYear}
            onEditYear={handleEditYear}
            onDeleteYear={handleDeleteYear}
            onSetActive={handleSetActive}
          />
        )}

        {activeTab === 'general' && (
          <GeneralTab key="general" />
        )}

        {activeTab === 'notification' && (
          <NotificationTab key="notification" />
        )}

        {activeTab === 'security' && (
          <SecurityTab key="security" />
        )}

        {activeTab === 'import' && (
          <ImportTab key="import" />
        )}

        {activeTab === 'backup' && (
          <BackupTab key="backup" />
        )}

        {activeTab === 'roles' && role === 'sysadmin' && (
          <motion.div
            key="roles"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl overflow-hidden shadow-sm"
            style={GLASS_CARD}
          >
            <RolePermissionManager />
          </motion.div>
        )}

        {activeTab !== 'academic-year' && activeTab !== 'general' && activeTab !== 'notification' && activeTab !== 'security' && activeTab !== 'import' && activeTab !== 'backup' && activeTab !== 'roles' && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl p-12 flex flex-col items-center justify-center text-black/25"
            style={GLASS_CARD}
          >
            <Settings2 size={40} className="opacity-30 mb-3" />
            <p className="text-sm">ส่วนนี้กำลังพัฒนา</p>
            <p className="text-xs mt-1 opacity-60">{SETTINGS_TABS.find(t => t.id === activeTab)?.label}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
