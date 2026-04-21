import { useMemo } from 'react';

export interface RoleOption {
  value: string;
  label: string;
  color?: string;
  bg?: string;
}

export function useRoleOptions() {
  const roleOptions = useMemo<RoleOption[]>(() => [
    { value: 'student',  label: 'นักเรียน',   color: '#7c3aed', bg: '#f3e8ff' },
    { value: 'parent',   label: 'ผู้ปกครอง', color: '#2563eb', bg: '#dbeafe' },
    { value: 'teacher',  label: 'ครูผู้สอน',  color: '#e11d48', bg: '#ffe4e6' },
    { value: 'staff',    label: 'เจ้าหน้าที่', color: '#059669', bg: '#d1fae5' },
    { value: 'admin',    label: 'ผู้บริหาร',   color: '#d97706', bg: '#fef3c7' },
    { value: 'sysadmin', label: 'SysAdmin', color: '#64748b', bg: '#f1f5f9' },
  ], []);

  const getRoleLabel = (value: string) => {
    return roleOptions.find(opt => opt.value === value)?.label || value;
  };

  return { roleOptions, getRoleLabel };
}
