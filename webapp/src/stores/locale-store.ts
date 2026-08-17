'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/i18n';
import { setApiLocale } from '@/lib/api';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'uz',
      setLocale: (locale) => {
        setApiLocale(locale);
        set({ locale });
      },
    }),
    {
      name: 'mp-locale',
      onRehydrateStorage: () => (state) => {
        if (state) setApiLocale(state.locale);
      },
    },
  ),
);
