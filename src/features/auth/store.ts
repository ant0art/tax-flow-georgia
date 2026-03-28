import { create } from 'zustand';

const SESSION_TOKEN_KEY = 'tax-flow:sessionToken';
const SESSION_USER_KEY = 'tax-flow:sessionUser';

type UserInfo = {
  name: string;
  email: string;
  picture: string;
};

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  spreadsheetId: string | null;
  setToken: (token: string) => void;
  setUser: (user: UserInfo | null) => void;
  setSpreadsheetId: (id: string) => void;
  logout: () => void;
}

function readSessionUser(): UserInfo | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  /**
   * Token is stored in sessionStorage (Security: D-003 update).
   * sessionStorage survives page refresh but is cleared when the tab closes.
   * It is NOT localStorage — never persisted to disk across sessions.
   */
  accessToken: sessionStorage.getItem(SESSION_TOKEN_KEY),
  user: readSessionUser(),
  // spreadsheetId is safe to persist across sessions — it's a public identifier
  spreadsheetId: localStorage.getItem('tax-flow:spreadsheetId'),

  setToken: (token) => {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    set({ accessToken: token });
  },

  setUser: (user) => {
    if (user) {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_USER_KEY);
    }
    set({ user });
  },

  setSpreadsheetId: (id) => {
    localStorage.setItem('tax-flow:spreadsheetId', id);
    set({ spreadsheetId: id });
  },

  logout: () => {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    Object.keys(localStorage)
      .filter((key) => key.startsWith('tax-flow:'))
      .forEach((key) => localStorage.removeItem(key));
    set({ accessToken: null, user: null, spreadsheetId: null });
  },
}));
