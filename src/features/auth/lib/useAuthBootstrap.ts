import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { initUserSpreadsheet } from '@/features/auth/lib/initSpreadsheet';

/**
 * Bootstraps missing auth data when a token exists but context is incomplete.
 *
 * This covers two scenarios:
 * 1. **Mobile redirect flow** — after Google redirects back, `onSuccess` never
 *    fires (the page reloaded). The token was saved by `main.tsx` hash
 *    interception, but user info and spreadsheet are missing.
 * 2. **Page refresh** — sessionStorage preserves the token, but Zustand
 *    user info may have been lost if sessionUser was cleared.
 */
export function useAuthBootstrap() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const spreadsheetId = useAuthStore((s) => s.spreadsheetId);
  const setUser = useAuthStore((s) => s.setUser);
  const setSpreadsheetId = useAuthStore((s) => s.setSpreadsheetId);

  useEffect(() => {
    if (!token) return;

    if (!user) {
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((info) =>
          setUser({
            name: info.name,
            email: info.email,
            picture: info.picture,
          }),
        )
        .catch(() => {
          // Non-critical — app works without user info
        });
    }

    if (!spreadsheetId) {
      initUserSpreadsheet(token)
        .then((id) => setSpreadsheetId(id))
        .catch((err) =>
          console.error('Bootstrap: spreadsheet init failed', err),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, spreadsheetId]);
}
