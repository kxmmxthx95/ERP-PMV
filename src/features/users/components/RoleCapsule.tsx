import { motion } from 'framer-motion';
import { ROLE_LABELS } from '@/types/mockUsers';

type RoleKey = keyof typeof ROLE_LABELS;

interface RoleCapsuleProps {
  filterRole: string;
  onRoleChange: (role: RoleKey) => void;
}

export default function RoleCapsule({ filterRole, onRoleChange }: RoleCapsuleProps) {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-wrap gap-2 justify-center">
      {Object.entries(ROLE_LABELS)
        .filter(([key]) => key !== 'sysadmin')
        .map(([key, style]) => (
          <motion.button
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => onRoleChange(key as RoleKey)}
            className={`px-4 py-2 rounded-full text-[11px] font-black transition-colors ${
              filterRole === key
                ? 'bg-[#0f172a] text-white shadow-md'
                : 'bg-white/60 text-slate-500 hover:text-slate-900 hover:bg-black/5'
            }`}
          >
            {style.label}
          </motion.button>
        ))}
    </div>
  );
}
