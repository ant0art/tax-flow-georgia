import { useState, useEffect, useCallback, useRef } from 'react';
import { rsgeGetDeclarations, type RsgeDeclaration } from '@/shared/api/rsge-client';

export type RsgeDeclState = 'idle' | 'loading' | 'done' | 'error';

interface UseRsgeDeclarationsReturn {
  state: RsgeDeclState;
  declarations: RsgeDeclaration[];
  error: string | null;
  year: number;
  setYear: (y: number) => void;
  refetch: () => void;
}

export function useRsgeDeclarations(tempToken: string | null): UseRsgeDeclarationsReturn {
  const [state, setState] = useState<RsgeDeclState>('idle');
  const [declarations, setDeclarations] = useState<RsgeDeclaration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Trigger refetch manually
  const refetch = useCallback(() => {
    setFetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!tempToken) {
      setDeclarations([]);
      setState('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('loading');
    setError(null);

    rsgeGetDeclarations(tempToken, year)
      .then((res) => {
        if (!cancelled) {
          setDeclarations(res.declarations ?? []);
          setState('done');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch declarations');
          setState('error');
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tempToken, year, fetchTrigger]);

  return {
    state,
    declarations,
    error,
    year,
    setYear,
    refetch,
  };
}
