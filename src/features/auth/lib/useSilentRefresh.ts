import { useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/features/auth/store';

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 min — token valid for ~60 min

/**
 * Proactively refreshes the Google access token in the background before it
 * expires (~60 min). This prevents API calls from failing mid-session.
 *
 * Page-refresh persistence is handled by sessionStorage in the auth store —
 * no silent OAuth flow is needed on mount. See D-003 in dev-journal.
 */
export function useSilentRefresh() {
  const token = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);

  const refreshToken = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setToken(tokenResponse.access_token);
    },
    onError: () => {
      // Proactive refresh failed — token will expire naturally.
      // User will be prompted again when their next API call fails (401).
    },
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' '),
  });

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      refreshToken();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
