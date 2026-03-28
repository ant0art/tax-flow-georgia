import { useEffect, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/features/auth/store';
import { initUserSpreadsheet } from './initSpreadsheet';

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 min (token valid for ~60 min)

/**
 * Attempts to silently obtain a new Google access token without showing UI.
 * Works only if the user already has an active Google session in the browser.
 * On mobile, this avoids the "log in again after refresh" problem.
 */
export function useSilentRefresh() {
  const token = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setSpreadsheetId = useAuthStore((s) => s.setSpreadsheetId);
  const hasAttempted = useRef(false);

  const silentLogin = useGoogleLogin({
    prompt: 'none',         // no UI popup — silent only
    onSuccess: async (tokenResponse) => {
      const newToken = tokenResponse.access_token;
      setToken(newToken);

      // Refresh user info
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        const userInfo = await res.json();
        setUser({ name: userInfo.name, email: userInfo.email, picture: userInfo.picture });
      } catch {
        // Non-critical
      }

      // Re-init spreadsheet ID (in case localStorage was cleared)
      try {
        const ssId = await initUserSpreadsheet(newToken);
        setSpreadsheetId(ssId);
      } catch {
        // Non-critical
      }
    },
    onError: () => {
      // Silent refresh failed — user must log in manually. This is expected
      // when they have no active Google session (e.g., incognito, logged out).
    },
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' '),
  });

  // On mount: if no token in memory, try silent refresh
  useEffect(() => {
    if (!token && !hasAttempted.current) {
      hasAttempted.current = true;
      silentLogin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactive refresh: re-fetch token 15 min before expiry
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      silentLogin();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
