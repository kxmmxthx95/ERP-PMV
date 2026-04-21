import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllRolePermissions, useUpdateRolePermission, useInitializeRolePermissions } from '@/hooks/useRolePermissions';
import type { AccessLevel, FeaturePermission } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';

// ── Types ──────────────────────────────────────────────────────────────────
const ROLES = [
  { key: 'sysadmin', label: 'SysAdmin',    color: '#64748b', bg: '#f1f5f9' },
  { key: 'admin',    label: 'ผู้บริหาร',   color: '#d97706', bg: '#fef3c7' },
  { key: 'teacher',  label: 'ครูผู้สอน',   color: '#e11d48', bg: '#ffe4e6' },
  { key: 'staff',    label: 'เจ้าหน้าที่', color: '#059669', bg: '#d1fae5' },
  { key: 'parent',   label: 'ผู้ปกครอง',  color: '#2563eb', bg: '#dbeafe' },
  { key: 'student',  label: 'นักเรียน',    color: '#7c3aed', bg: '#f3e8ff' },
] as const;

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function RolePermissionManager() {
  const [selectedRole, setSelectedRole] = useState<string>('sysadmin');
  const { data: allConfigs, isLoading } = useAllRolePermissions();
  const { mutate: updatePermission, isPending: isUpdating } = useUpdateRolePermission();
  const { mutate: initializeDefaults, isPending: isInitializing } = useInitializeRolePermissions();

  const currentConfig = allConfigs?.[selectedRole];
  const categories = [...new Set(FEATURE_LIST.map(f => f.category))];

  const handleToggle = (featureKey: string, currentPermission?: FeaturePermission) => {
    const feature = FEATURE_LIST.find(f => f.featureKey === featureKey);
    if (!feature) return;

    const enabled = !(currentPermission?.enabled ?? false);
    const accessLevel = currentPermission?.accessLevel ?? 'view-only';

    updatePermission({
      roleId: selectedRole,
      permission: { ...feature, enabled, accessLevel },
    });
  };

  const handleAccessLevelChange = (featureKey: string, newLevel: AccessLevel) => {
    const feature = FEATURE_LIST.find(f => f.featureKey === featureKey);
    if (!feature) return;

    const permission = currentConfig?.permissions.find(p => p.featureKey === featureKey);
    const enabled = permission?.enabled ?? false;

    updatePermission({
      roleId: selectedRole,
      permission: { ...feature, enabled, accessLevel: newLevel },
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center">กำลังโหลด...</div>;
  }

  const permissionMap = new Map(currentConfig?.permissions.map(p => [p.featureKey, p]));
  const roleConfig = ROLES.find(r => r.key === selectedRole);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 shadow-sm">
            <ShieldCheck size={22} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">จัดการสิทธิ์แต่ละ Role</h1>
            <p className="text-xs text-slate-500 mt-0.5">กำหนดฟีเจอร์และสิทธิ์การเข้าถึงแยกตามบทบาท</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => initializeDefaults()}
            disabled={isInitializing}
            className="hidden md:flex gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 h-9 rounded-xl text-xs font-semibold"
          >
            <Zap size={14} />
            ค่า Default
          </Button>

          <div
            className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full p-1"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
            }}
          >
            {ROLES.map((role) => {
              const active = selectedRole === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => setSelectedRole(role.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex-shrink-0"
                  style={{
                    background: active ? '#1e1e1e' : 'transparent',
                    color: active ? '#fff' : 'rgba(0, 0, 0, 0.5)',
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Permissions Table */}
      {roleConfig && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {categories.map((category) => {
            const features = FEATURE_LIST.filter(f => f.category === category);
            return (
              <div key={category} className="rounded-2xl overflow-hidden" style={glassCard}>
                {/* Category Header */}
                <div className="px-5 py-3 border-b border-white/60 bg-slate-50/60">
                  <span className="text-sm font-semibold text-slate-700">{category}</span>
                </div>

                {/* Feature Rows */}
                <div className="divide-y divide-slate-100">
                  {features.map((feature) => {
                    const perm = permissionMap.get(feature.featureKey);
                    const isEnabled = perm?.enabled ?? false;

                    return (
                      <div
                        key={feature.featureKey}
                        className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-4"
                      >
                        {/* Left: Feature label + toggle */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => handleToggle(feature.featureKey, perm)}
                            disabled={isUpdating}
                            className="flex-shrink-0 transition-all hover:scale-110"
                          >
                            {isEnabled ? (
                              <ToggleRight size={24} className="text-emerald-500" />
                            ) : (
                              <ToggleLeft size={24} className="text-slate-300" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium transition-colors ${
                              isEnabled ? 'text-slate-700' : 'text-slate-400'
                            }`}>
                              {feature.label}
                            </p>
                          </div>
                        </div>

                        {/* Right: Access level dropdown */}
                        {isEnabled && (
                          <div className="flex-shrink-0 w-40">
                            <Select
                              value={perm?.accessLevel ?? 'view-only'}
                              onValueChange={(val) =>
                                handleAccessLevelChange(feature.featureKey, val as AccessLevel)
                              }
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full">เต็มสิทธิ์</SelectItem>
                                <SelectItem value="edit">แก้ไข</SelectItem>
                                <SelectItem value="view-only">ดูเท่านั้น</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {!isEnabled && (
                          <div className="flex-shrink-0">
                            <span className="text-xs text-slate-400">—</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-slate-400 text-center pb-2"
      >
        ต้องสร้างค่า Default ครั้งแรก โดยการกด "สร้างค่า Default" ก่อนจึงจะสามารถแก้ไขได้
      </motion.p>
    </div>
  );
}
