import { useState, useCallback } from 'react';

export type WidgetId = 'chart' | 'recent-transactions' | 'quick-links';

export interface WidgetConfig {
  id: WidgetId;
  colSpan: 1 | 2;
  locked: boolean;
  order: number;
}

const STORAGE_KEY = 'tfg-dashboard-layout';

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'chart',               colSpan: 2, locked: true,  order: 0 },
  { id: 'recent-transactions', colSpan: 1, locked: false, order: 1 },
  { id: 'quick-links',         colSpan: 1, locked: false, order: 2 },
];

function loadLayout(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: WidgetConfig[] = JSON.parse(raw);
    // Merge with defaults so new widgets are always included
    const merged = DEFAULT_LAYOUT.map((def) => {
      const saved = parsed.find((p) => p.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: WidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<WidgetConfig[]>(loadLayout);

  const update = useCallback((next: WidgetConfig[]) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  const reorder = useCallback((dragId: WidgetId, dropId: WidgetId) => {
    if (dragId === dropId) return;
    setLayout((prev) => {
      const dragged = prev.find((w) => w.id === dragId);
      const target  = prev.find((w) => w.id === dropId);
      if (!dragged || !target || dragged.locked) return prev;
      const next = prev.map((w) => {
        if (w.id === dragId) return { ...w, order: target.order };
        if (w.id === dropId) return { ...w, order: dragged.order };
        return w;
      }).sort((a, b) => a.order - b.order)
        .map((w, i) => ({ ...w, order: i }));
      saveLayout(next);
      return next;
    });
  }, []);

  const resize = useCallback((id: WidgetId, colSpan: 1 | 2) => {
    setLayout((prev) => {
      const next = prev.map((w) => {
        if (w.id !== id) return w;
        // Chart must always be ≥ 2
        const safe: 1 | 2 = (id === 'chart' && colSpan < 2) ? 2 : colSpan;
        return { ...w, colSpan: safe };
      });
      saveLayout(next);
      return next;
    });
  }, []);

  const toggleLock = useCallback((id: WidgetId) => {
    setLayout((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, locked: !w.locked } : w,
      );
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    update([...DEFAULT_LAYOUT]);
  }, [update]);

  return { layout, reorder, resize, toggleLock, resetLayout };
}
