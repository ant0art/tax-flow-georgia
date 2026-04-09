import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RsgeDeclaration } from '@/shared/api/rsge-client';
import type { Declaration } from '@/entities/declaration/schemas';
import { useDeclarations } from './useDeclarations';
import { useToastStore } from '@/shared/ui/Toast.store';
import {
  periodFromRsge,
  rsgeToLocalSnapshot,
  compareAmounts,
  rsgeStatusToLocal,
  type AmountComparison,
} from '@/features/declarations/lib/rsge-field-mapper';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;    // New declarations created from RS.GE
  linked: number;      // Existing local declarations linked to RS.GE
  relinked: number;    // Stale links updated to new SEQ_NUM
  mismatched: number;  // Linked but with amount discrepancies
  skipped: number;     // Already linked, no changes needed
  errors: number;      // Failed operations
}

export interface ImportProgress {
  current: number;
  total: number;
  currentPeriod: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseRsgeImportReturn {
  /** Import all RS.GE declarations, matching by period to existing local ones */
  importAll: (rsgeDeclarations: RsgeDeclaration[]) => Promise<ImportResult>;
  /** Find local declaration matching an RS.GE period */
  findLocalMatch: (period: string, declarations: Declaration[]) => Declaration | undefined;
  /** Compare amounts between local and RS.GE declarations */
  getComparison: (local: Declaration, rsge: RsgeDeclaration) => AmountComparison;
  /** Whether import is in progress */
  importing: boolean;
  /** Import progress (during import) */
  progress: ImportProgress | null;
  /** Last import result */
  lastResult: ImportResult | null;
}

export function useRsgeImport(): UseRsgeImportReturn {
  const { declarations, addDeclaration, updateDeclaration } = useDeclarations();
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  /**
   * Find a local declaration that matches the given RS.GE period.
   * Period matching: RS.GE "202601" → local "2026-01"
   */
  const findLocalMatch = useCallback(
    (rsgePeriod: string, decls: Declaration[]): Declaration | undefined => {
      const localPeriod = periodFromRsge(rsgePeriod);
      return decls.find((d) => d.period === localPeriod);
    },
    [],
  );

  /** Get amount comparison between local and RS.GE */
  const getComparison = useCallback(
    (local: Declaration, rsge: RsgeDeclaration): AmountComparison => {
      return compareAmounts(local, rsge);
    },
    [],
  );

  /**
   * Import all RS.GE declarations into local storage.
   *
   * Algorithm:
   * - For each RS.GE declaration:
   *   1. Convert RS.GE period to local format
   *   2. Find matching local declaration by period
   *   3. If local exists and already linked to same SEQ_NUM → skip (already imported)
   *   4. If local exists but not linked → link & compare amounts → update
   *   5. If no local → create new local declaration from RS.GE data
   *
   * Each operation is processed sequentially (one write at a time) for
   * Google Sheets consistency. Re-import is idempotent by period.
   */
  const importAll = useCallback(
    async (rsgeDeclarations: RsgeDeclaration[]): Promise<ImportResult> => {
      setImporting(true);
      setProgress({ current: 0, total: rsgeDeclarations.length, currentPeriod: '' });

      const result: ImportResult = {
        imported: 0,
        linked: 0,
        relinked: 0,
        mismatched: 0,
        skipped: 0,
        errors: 0,
      };

      // Get fresh copy of declarations for matching
      // (we use the hook's state, which is stable within this render cycle)
      let localDecls = [...declarations];

      for (let i = 0; i < rsgeDeclarations.length; i++) {
        const rsge = rsgeDeclarations[i];
        const rsgePeriod = rsge.period || rsge.SAG_PERIODI;
        const localPeriod = periodFromRsge(rsgePeriod);

        setProgress({ current: i + 1, total: rsgeDeclarations.length, currentPeriod: localPeriod });

        try {
          const localMatch = localDecls.find((d) => d.period === localPeriod);
          const snapshot = rsgeToLocalSnapshot(rsge);

          if (localMatch) {
            // Already linked to the same SEQ_NUM → skip
            if (
              localMatch.rsgeSeqNum === String(rsge.SEQ_NUM) &&
              localMatch.rsgeSyncState !== 'unlinked'
            ) {
              result.skipped++;
              continue;
            }

            // Link existing local declaration to RS.GE
            const comparison = compareAmounts(localMatch, rsge);
            const syncState = comparison.match ? 'linked' : 'out_of_sync';
            const isRelink = !!(localMatch.rsgeSeqNum && localMatch.rsgeSeqNum !== String(rsge.SEQ_NUM));

            // Propagate RS.GE status → localStatus (e.g. draft → submitted)
            const newLocalStatus = rsgeStatusToLocal(rsge);
            const rsgeSubmittedAt = rsge.WARM_TAR
              ? rsge.WARM_TAR.split(/[\sT]/)[0].split(/[./-]/).reverse().join('-')
              : '';

            // Find row index (1-indexed header + 1-indexed data)
            const originalIndex = declarations.findIndex((d) => d.id === localMatch.id);
            if (originalIndex === -1) {
              result.errors++;
              continue;
            }

            const rowIndex = originalIndex + 2;

            const mergedData = {
              ...localMatch,
              ...snapshot,
              rsgeSyncState: syncState,
              rsgeSyncedHash: '', // Will be set if user pushes back
              localStatus: newLocalStatus,
              submittedAt: localMatch.submittedAt || rsgeSubmittedAt,
            };

            await updateDeclaration({
              data: mergedData,
              rowIndex,
            });

            if (isRelink) {
              result.relinked++;
            } else {
              result.linked++;
            }
            if (!comparison.match) {
              result.mismatched++;
            }
          } else {
            // No local declaration for this period → create from RS.GE data
            const rsgeSubmittedAt = rsge.WARM_TAR
              ? rsge.WARM_TAR.split(/[\sT]/)[0].split(/[./-]/).reverse().join('-')
              : '';

            const newDecl: Declaration = {
              id: crypto.randomUUID(),
              period: localPeriod,
              field15: Number(rsge.SHEM_JAM) || 0,
              field16: 0.01, // Standard small business rate
              field17: Number(rsge.SHEM) || 0,
              field18: 0,
              field19: Number(rsge.DAR) || 0,
              field21: 0, // Will be recalculated when needed
              localStatus: 'submitted',
              submittedAt: rsgeSubmittedAt,
              paidAt: '',
              notes: '',
              createdAt: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString().split('T')[0],
              transactionIds: '',
              rsgeSeqNum: String(rsge.SEQ_NUM || ''),
              rsgeDocNum: rsge.DOC_MOS_NOM || '',
              rsgeSyncState: 'linked',
              rsgeSyncedHash: '',
              rsgeIncome: Number(rsge.SHEM) || 0,
              rsgeTax: Number(rsge.DAR) || 0,
              rsgeCumulativeIncome: Number(rsge.SHEM_JAM) || 0,
              rsgeStatusText: rsge.STATUS_TXT || '',
              rsgeImportedAt: new Date().toISOString().split('T')[0],
            };

            await addDeclaration(newDecl);

            // Add to local tracking array so next iterations can find it
            localDecls = [...localDecls, newDecl];

            result.imported++;
          }
        } catch (err) {
          console.error(`Import error for period ${localPeriod}:`, err);
          result.errors++;
        }
      }

      setImporting(false);
      setProgress(null);
      setLastResult(result);

      // Force-await declarations refetch so React state is current
      // before the caller uses the result (fixes stale "Link outdated" badges)
      await queryClient.refetchQueries({ queryKey: ['declarations'] });

      // Show summary toast
      const parts: string[] = [];
      if (result.imported > 0) parts.push(`импортировано: ${result.imported}`);
      if (result.linked > 0) parts.push(`привязано: ${result.linked}`);
      if (result.relinked > 0) parts.push(`перепривязано: ${result.relinked}`);
      if (result.mismatched > 0) parts.push(`расхождений: ${result.mismatched}`);
      if (result.skipped > 0) parts.push(`пропущено: ${result.skipped}`);
      if (result.errors > 0) parts.push(`ошибок: ${result.errors}`);

      const hasIssues = result.errors > 0 || result.mismatched > 0;
      addToast(
        `Импорт завершён: ${parts.join(', ')}`,
        hasIssues ? 'error' : 'success',
      );

      return result;
    },
    [declarations, addDeclaration, updateDeclaration, addToast, queryClient],
  );

  return {
    importAll,
    findLocalMatch,
    getComparison,
    importing,
    progress,
    lastResult,
  };
}
