import { useState, useCallback } from 'react';
import { rsgeAuthInit, rsgeAuthComplete } from '@/shared/api/rsge-client';

export type RsgeAuthState =
  | 'idle'
  | 'loading'
  | 'otp'
  | 'authenticating'
  | 'connected'
  | 'error';

interface UseRsgeAuthReturn {
  state: RsgeAuthState;
  error: string | null;
  tempToken: string | null;
  initAuth: (login: string, password: string) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  disconnect: () => void;
}

// ── Session persistence ──────────────────────────────────────────────────────
// Same security model as Google auth (sessionStorage, tab-scoped).
// sessionStorage survives page refresh but is cleared when the tab closes.
// TTL provides an additional safety net — auto-expire before RS.GE does.

const SESSION_KEY = 'rsge:temp_token';
const EXPIRES_KEY = 'rsge:expires_at';
/** RS.GE sessions last ~60 min; we expire at 50 min for safety margin */
const SESSION_TTL_MS = 50 * 60 * 1000;

function saveSession(token: string): void {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));
}

function loadSession(): string | null {
  const token = sessionStorage.getItem(SESSION_KEY);
  const expiresAt = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return null;

  if (Date.now() > Number(expiresAt)) {
    // Expired — clean up
    clearSession();
    return null;
  }
  return token;
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRsgeAuth(): UseRsgeAuthReturn {
  // On first render: check if a valid session exists in sessionStorage
  const existingToken = loadSession();

  const [state, setState] = useState<RsgeAuthState>(existingToken ? 'connected' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(existingToken);

  const initAuth = useCallback(async (login: string, password: string) => {
    setState('loading');
    setError(null);
    try {
      const res = await rsgeAuthInit(login, password);
      setTempToken(res.temp_token);
      // Don't persist yet — we only persist after full auth (post-OTP)

      if (res.status === 'otp_required') {
        setState('otp');
      } else {
        // No OTP needed — already authenticated
        saveSession(res.temp_token);
        setState('connected');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setState('error');
    }
  }, []);

  const confirmOtp = useCallback(async (code: string) => {
    if (!tempToken) {
      setError('No session token — please re-authenticate');
      setState('error');
      return;
    }

    setState('authenticating');
    setError(null);
    try {
      const res = await rsgeAuthComplete(tempToken, code);
      setTempToken(res.temp_token);
      saveSession(res.temp_token);
      setState('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      setError(msg);
      setState('error');
    }
  }, [tempToken]);

  const disconnect = useCallback(() => {
    setTempToken(null);
    clearSession();
    setState('idle');
    setError(null);
  }, []);

  return { state, error, tempToken, initAuth, confirmOtp, disconnect };
}
