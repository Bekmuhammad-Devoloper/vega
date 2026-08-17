'use client';

import { create } from 'zustand';
import type { PlatformAdminDto, PlatformRole } from '@/lib/types';

interface AuthState {
  admin: PlatformAdminDto | null;
  initialized: boolean;
  setAdmin: (a: PlatformAdminDto | null) => void;
  setInitialized: (b: boolean) => void;
  hasRole: (...roles: PlatformRole[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  admin: null,
  initialized: false,
  setAdmin: (admin) => set({ admin }),
  setInitialized: (initialized) => set({ initialized }),
  hasRole: (...roles) => {
    const admin = get().admin;
    if (!admin) return false;
    if (admin.role === 'OWNER') return true;
    return roles.includes(admin.role);
  },
}));
