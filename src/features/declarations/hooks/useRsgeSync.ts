import { useState, useCallback } from 'react';
import {
  rsgeDraftCreate,
  rsgeDraftSave,
  rsgeDraftDelete,
} from '@/shared/api/rsge-client';
import { useDeclarations } from './useDeclarations';
import { periodToRsge, computeSyncHash, isSyncDirty } from '@/features/declarations/lib/rsge-field-mapper';
import { useToastStore } from '@/shared/ui/Toast.store';
import type { Declaration } from '@/entities/declaration/schemas';

export interface UseRsgeSyncReturn {
  /** Push a local declaration to RS.GE as a new draft */
  pushToRsge: (decl: Declaration, rowIndex: number) => Promise<void>;
  /** Re-sync an already linked declaration (update fields on RS.GE) */
  reSyncToRsge: (decl: Declaration, rowIndex: number) => Promise<void>;
  /** Unlink a declaration from RS.GE (optionally delete the RS.GE draft) */
  unlinkFromRsge: (decl: Declaration, rowIndex: number, deleteDraft: boolean) => Promise<void>;
  /** Check if a linked declaration has local changes not yet synced */
  isDirty: (decl: Declaration) => boolean;
  /** ID of the declaration currently being synced (null if idle) */
  syncingId: string | null;
  /** Last error message from a sync operation */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
}

export function useRsgeSync(tempToken: string | null): UseRsgeSyncReturn {
  const { updateDeclaration } = useDeclarations();
  const addToast = useToastStore.getState().addToast;
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Push local declaration → RS.GE draft.
   * 1. Create draft on RS.GE with the period
   * 2. Save mapped fields to the draft
   * 3. Update local declaration with rsgeSeqNum + rsgeSyncState='linked'
   */
  const pushToRsge = useCallback(async (decl: Declaration, rowIndex: number) => {
    if (!tempToken) {
      setError('RS.GE session not active — connect first');
      return;
    }

    setSyncingId(decl.id);
    setError(null);

    try {
      // Step 1: Create draft on RS.GE
      const rsgePeriod = periodToRsge(decl.period);
      const created = await rsgeDraftCreate(tempToken, rsgePeriod);

      if (!created.ok || !created.seq_num) {
        throw new Error('Failed to create draft on RS.GE');
      }

      // Step 2: Map local fields → human-readable and save
      const saved = await rsgeDraftSave(tempToken, created.seq_num, {
        ytdIncome: decl.field15.toFixed(2),
        monthlyIncome: decl.field17.toFixed(2),
        deduction: decl.field18,
      });

      if (!saved.ok && saved.validation_error) {
        throw new Error(`RS.GE validation: ${saved.validation_error}`);
      }

      // Step 3: Update local declaration with sync info
      const syncHash = computeSyncHash(decl);
      await updateDeclaration({
        data: {
          ...decl,
          rsgeSeqNum: String(created.seq_num),
          rsgeDocNum: '',  // Doc number is assigned only after submission
          rsgeSyncState: 'linked',
          rsgeSyncedHash: syncHash,
        },
        rowIndex,
      });

      addToast('Draft created on RS.GE', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSyncingId(null);
    }
  }, [tempToken, updateDeclaration, addToast]);

  /**
   * Re-sync: update fields on an existing RS.GE draft.
   * Uses the saved rsgeSeqNum — doesn't create a new draft.
   */
  const reSyncToRsge = useCallback(async (decl: Declaration, rowIndex: number) => {
    if (!tempToken) {
      setError('RS.GE session not active — connect first');
      return;
    }

    if (!decl.rsgeSeqNum) {
      setError('Declaration is not linked to RS.GE');
      return;
    }

    setSyncingId(decl.id);
    setError(null);

    try {
      const seqNum = Number(decl.rsgeSeqNum);
      const saved = await rsgeDraftSave(tempToken, seqNum, {
        ytdIncome: decl.field15.toFixed(2),
        monthlyIncome: decl.field17.toFixed(2),
        deduction: decl.field18,
      });

      if (!saved.ok && saved.validation_error) {
        throw new Error(`RS.GE validation: ${saved.validation_error}`);
      }

      // Update sync hash to reflect current state
      const syncHash = computeSyncHash(decl);
      await updateDeclaration({
        data: {
          ...decl,
          rsgeSyncState: 'linked',
          rsgeSyncedHash: syncHash,
        },
        rowIndex,
      });

      addToast('RS.GE draft updated', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Re-sync failed';
      setError(msg);

      // Mark as out_of_sync if save failed
      try {
        await updateDeclaration({
          data: { ...decl, rsgeSyncState: 'out_of_sync' },
          rowIndex,
        });
      } catch {
        // Ignore local update failure
      }

      addToast(msg, 'error');
    } finally {
      setSyncingId(null);
    }
  }, [tempToken, updateDeclaration, addToast]);

  /**
   * Unlink declaration from RS.GE.
   * Optionally deletes the draft on RS.GE side.
   */
  const unlinkFromRsge = useCallback(async (
    decl: Declaration,
    rowIndex: number,
    deleteDraft: boolean,
  ) => {
    if (!tempToken && deleteDraft) {
      setError('RS.GE session required to delete remote draft');
      return;
    }

    setSyncingId(decl.id);
    setError(null);

    try {
      // Optionally delete the draft on RS.GE
      if (deleteDraft && tempToken && decl.rsgeSeqNum) {
        const seqNum = Number(decl.rsgeSeqNum);
        await rsgeDraftDelete(tempToken, seqNum);
      }

      // Update local declaration to remove link
      await updateDeclaration({
        data: {
          ...decl,
          rsgeSeqNum: '',
          rsgeDocNum: '',
          rsgeSyncState: 'unlinked',
          rsgeSyncedHash: '',
        },
        rowIndex,
      });

      addToast(
        deleteDraft ? 'Unlinked and draft deleted from RS.GE' : 'Unlinked from RS.GE',
        'success',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unlink failed';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSyncingId(null);
    }
  }, [tempToken, updateDeclaration, addToast]);

  /** Check if local changes exist that haven't been synced to RS.GE */
  const isDirty = useCallback((decl: Declaration): boolean => {
    return isSyncDirty(decl);
  }, []);

  return {
    pushToRsge,
    reSyncToRsge,
    unlinkFromRsge,
    isDirty,
    syncingId,
    error,
    clearError,
  };
}
