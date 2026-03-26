import { useEffect, useRef, useCallback } from 'react';

/**
 * Auto-save form drafts to localStorage with debounce.
 * Key namespaced: tax-flow:draft:{name}
 */
export function useDraftPersist<T extends Record<string, unknown>>(name: string, watch: T, restore: (data: T) => void) {
  const key = `tax-flow:draft:${name}`;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const restored = useRef(false);

  // Restore on mount
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved) as T;
        restore(data);
      }
    } catch {
      // Corrupted draft — ignore
    }
  }, [key, restore]);

  // Debounced save on change
  useEffect(() => {
    if (!restored.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(watch));
      } catch {
        // localStorage full — silently skip
      }
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, watch]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { clearDraft };
}
