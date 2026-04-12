import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardSidebar from './DashboardSidebar';

const COLLAPSED_W = 72;
const EXPANDED_W = 240;

export default function DashboardLayout() {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const SIDEBAR_SLOT = isSidebarExpanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <div
      className="min-h-screen flex relative"
      style={{ background: '#efefef' }}
    >
      {/* ── Subtle ambient noise for depth ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full bg-white/60 blur-[140px]" />
        <div className="absolute bottom-20 right-20 w-[600px] h-[600px] rounded-full bg-white/40 blur-[120px]" />
      </div>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              key="mobile-sidebar"
              initial={{ x: -EXPANDED_W }}
              animate={{ x: 0 }}
              exit={{ x: -EXPANDED_W }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              style={{ width: EXPANDED_W }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <DashboardSidebar onMobileClose={() => setIsMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar slot ── */}
      <motion.div
        animate={{ width: SIDEBAR_SLOT }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ flexShrink: 0 }}
        className="hidden lg:flex sticky top-0 h-screen z-20"
      >
        <DashboardSidebar onExpandChange={setIsSidebarExpanded} />
      </motion.div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <main className="flex-1 p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
