// src/hooks/useAuth.ts
import { useAuthStore } from "@/store/authStore";

export const useAuth = () => {
  const { user, role, isLoading, logout } = useAuthStore();

  const isAuthorized = (allowedRoles: string[]) => {
    return role ? allowedRoles.includes(role) : false;
  };

  return { user, role, isLoading, logout, isAuthorized };
};