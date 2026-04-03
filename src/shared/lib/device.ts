/**
 * Detect mobile devices for OAuth UX mode selection.
 *
 * On mobile, Google OAuth popup opens as a new tab which breaks
 * the authentication flow (tab closes but user isn't returned).
 * We use redirect flow on mobile instead.
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Primary: UA string matching for known mobile platforms
  const uaMatch = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Fallback: touch-capable device with narrow viewport
  const touchNarrow =
    navigator.maxTouchPoints > 0 && window.innerWidth < 768;

  return uaMatch || touchNarrow;
}
