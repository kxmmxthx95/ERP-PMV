import { create } from 'zustand';

interface UserState {
  user: any | null;
  userData: any | null;
  role: string | null;
  isLoading: boolean;
  setUser: (user: any | null, role: string | null, userData?: any) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<UserState>((set) => ({
  user: null,
  userData: null,
  role: null,
  isLoading: true,
  setUser: (user, role, userData = null) => set({ user, role, userData, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, role: null, userData: null, isLoading: false }),
}));