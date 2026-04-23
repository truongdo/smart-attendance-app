import type { User } from 'firebase/auth';
import { create } from 'zustand';
import type { UserProfile } from '@/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setAuth: (user: User | null, profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setAuth: (user, profile) => set({ user, profile, loading: false }),
  setLoading: (loading) => set({ loading }),
}));

