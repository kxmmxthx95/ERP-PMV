import { create } from 'zustand';

interface UserState {
  user: any | null;
  role: string | null;
  isLoading: boolean;
  setUser: (user: any | null, role: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<UserState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  setUser: (user, role) => set({ user, role, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, role: null, isLoading: false }),
}));