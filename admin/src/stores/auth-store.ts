'use client';

import { create } from 'zustand';
import type { AdminDto } from '@/lib/types';

interface AuthState {
  admin: AdminDto | null;
  initialized: boolean;
  setAdmin: (a: AdminDto | null) => void;
  setInitialized: (b: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  initialized: false,
  setAdmin: (admin) => set({ admin }),
  setInitialized: (initialized) => set({ initialized }),
}));
