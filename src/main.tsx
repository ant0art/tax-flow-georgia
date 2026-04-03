import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'

// ── OAuth redirect interception (before React) ─────────────────────
// On mobile, Google OAuth uses redirect flow. Google returns the token
// in the URL hash: #access_token=xxx&token_type=bearer&expires_in=...
// HashRouter would treat this as a route path and fail.
// We intercept here — synchronously, before React mounts.
const rawHash = window.location.hash;
if (rawHash.includes('access_token=')) {
  const params = new URLSearchParams(rawHash.substring(1));
  const accessToken = params.get('access_token');
  if (accessToken) {
    sessionStorage.setItem('tax-flow:sessionToken', accessToken);
  }
  // Clean hash so HashRouter sees #/ (home) instead of token params
  history.replaceState(null, '', window.location.pathname + '#/');
}
// ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
