import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('tax-flow:theme') as Theme | null;
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),

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
}));
