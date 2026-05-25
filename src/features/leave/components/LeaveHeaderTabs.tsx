import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const TABS = [
  { id: 'request', label: 'คำขอลา', path: '/portal/leave' },
  { id: 'report', label: 'รายงาน', path: '/portal/leave/report' },
];

export default function LeaveHeaderTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';

  // Determine active tab
  let activeTab = 'request';
  if (location.pathname.includes('/report')) {
    activeTab = 'report';
  } else if (location.search.includes('view=settings')) {
    activeTab = 'settings';
  }

  const visibleTabs = TABS.filter(t => t.id !== 'settings' || isAdmin);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center h-9 border border-black/[0.07] p-1 rounded-full bg-white/50 backdrop-blur-md"
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`relative flex items-center justify-center h-full px-5 rounded-full text-[10.5px] font-black transition-colors z-10 ${
              isActive ? 'text-white' : 'text-black/35 hover:text-black/60'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabCapsule"
                className="absolute inset-0 bg-blue-600 rounded-full shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20">{tab.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
