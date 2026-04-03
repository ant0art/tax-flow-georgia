import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSilentRefresh } from '@/features/auth/lib/useSilentRefresh';
import { useAuthBootstrap } from '@/features/auth/lib/useAuthBootstrap';
import { AuthError } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// ── Global 401 handler ──────────────────────────────────────────────
// AuthError is thrown by SheetsClient on 401 (expired token).
// Without this handler, React Query would retry (pointless for 401)
// and show a broken error state with no recovery action.

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    useAuthStore.getState().logout();
    window.location.hash = '#/login';
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min
      gcTime: 10 * 60 * 1000,    // 10 min
      retry: (failureCount, error) => {
        if (error instanceof AuthError) return false; // never retry 401
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Subscribe to query/mutation errors globally
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    handleAuthError(event.query.state.error);
  }
});
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'updated' && event.mutation?.state.status === 'error') {
    handleAuthError(event.mutation.state.error);
  }
});
// ─────────────────────────────────────────────────────────────────────

/** Must be inside GoogleOAuthProvider to use useGoogleLogin */
function SilentRefreshInit() {
  useSilentRefresh();
  return null;
}

/** Loads missing user info / spreadsheet after redirect or page refresh */
function AuthBootstrapInit() {
  useAuthBootstrap();
  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SilentRefreshInit />
      <AuthBootstrapInit />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
