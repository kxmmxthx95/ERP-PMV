// src/hooks/useAuth.ts
import { useAuthStore } from "@/store/authStore";

export const useAuth = () => {
  const { user, userData, role, isLoading, logout } = useAuthStore();

  const isAuthorized = (allowedRoles: string[]) => {
    if (!role) return false;
    // God Mode: SysAdmin เข้าได้ทุกที่
    if (role === 'sysadmin') return true;
    return allowedRoles.includes(role);
  };

  return { user, userData, role, isLoading, logout, isAuthorized };
};