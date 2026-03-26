import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: {
    name: string;
    email: string;
    picture: string;
  } | null;
  spreadsheetId: string | null;
  setToken: (token: string) => void;
  setUser: (user: AuthState['user']) => void;
  setSpreadsheetId: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Token is in-memory ONLY — never persisted to storage (Security: D-003)
  accessToken: null,
  user: null,
  // spreadsheetId is safe to persist — it's a public identifier (Security checklist)
  spreadsheetId: localStorage.getItem('tax-flow:spreadsheetId'),

  setToken: (token) => set({ accessToken: token }),

  setUser: (user) => set({ user }),

  setSpreadsheetId: (id) => {
    localStorage.setItem('tax-flow:spreadsheetId', id);
    set({ spreadsheetId: id });
  },

  logout: () => {
    // Clear all tax-flow: keys from localStorage
    Object.keys(localStorage)
      .filter((key) => key.startsWith('tax-flow:'))
      .forEach((key) => localStorage.removeItem(key));
    set({ accessToken: null, user: null, spreadsheetId: null });
  },
}));
