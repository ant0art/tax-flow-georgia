import { create } from 'zustand';
import type { Lang } from '@/shared/i18n/translations';

type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  lang: Lang;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleLang: () => void;
  toggleSidebar: () => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('tax-flow:theme') as Theme | null;
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialLang = (): Lang => {
  return (localStorage.getItem('tax-flow:lang') as Lang | null) ?? 'en';
};

const getInitialSidebarCollapsed = (): boolean => {
  return localStorage.getItem('tax-flow:sidebar-collapsed') === 'true';
};

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  lang: getInitialLang(),
  sidebarCollapsed: getInitialSidebarCollapsed(),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('tax-flow:theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    localStorage.setItem('tax-flow:theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  toggleLang: () =>
    set((state) => {
      const next: Lang = state.lang === 'en' ? 'ru' : 'en';
      localStorage.setItem('tax-flow:lang', next);
      return { lang: next };
    }),

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      localStorage.setItem('tax-flow:sidebar-collapsed', String(next));
      return { sidebarCollapsed: next };
    }),
}));
