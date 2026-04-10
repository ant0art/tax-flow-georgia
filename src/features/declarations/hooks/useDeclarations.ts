import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { Declaration } from '@/entities/declaration/schemas';
import { DECLARATION_FIELDS } from '@/entities/declaration/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

const NUMERIC_FIELDS: (keyof Declaration)[] = [
  'field15', 'field16', 'field17', 'field18', 'field19', 'field21',
  'rsgeIncome', 'rsgeTax', 'rsgeCumulativeIncome',
];

/** Default values for new columns that might not exist in old Sheet rows */
const FIELD_DEFAULTS: Partial<Record<keyof Declaration, string>> = {
  transactionIds: '',
  rsgeSeqNum: '',
  rsgeDocNum: '',
  rsgeSyncState: 'unlinked',
  rsgeSyncedHash: '',
  rsgeIncome: '0',
  rsgeTax: '0',
  rsgeCumulativeIncome: '0',
  rsgeStatusText: '',
  rsgeImportedAt: '',
};

/**
 * Normalize period from various Google Sheets representations back to YYYY-MM.
 *
 * Google Sheets may auto-convert "2026-04" to:
 *   - A serial date number (e.g. 46143)
 *   - A formatted date string ("4/1/2026", "Apr 2026", "2026-04-01", etc.)
 *   - The original "2026-04" (if column format is plain text)
 */
function normalizePeriod(raw: string): string {
  if (!raw) return '';

  // Already valid YYYY-MM
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;

  // Serial date number (Google Sheets epoch = 1899-12-30)
  const num = Number(raw);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + num);
    const y = epoch.getFullYear();
    const m = String(epoch.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // ISO-like "2026-04-01" or "2026-04-01T..."
  const isoMatch = raw.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  // US format "4/1/2026" or "04/01/2026"
  const usMatch = raw.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (usMatch) return `${usMatch[2]}-${String(usMatch[1]).padStart(2, '0')}`;

  // "Apr 2026" or "April 2026"
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const nameMatch = raw.match(/^(\w+)\s+(\d{4})$/i);
  if (nameMatch) {
    const idx = monthNames.findIndex((m) => nameMatch[1].toLowerCase().startsWith(m));
    if (idx >= 0) return `${nameMatch[2]}-${String(idx + 1).padStart(2, '0')}`;
  }

  return raw; // Fallback — return as-is
}

function rowToDeclaration(row: string[]): Declaration {
  const result: Record<string, unknown> = {};
  DECLARATION_FIELDS.forEach((f, i) => {
    const v = row[i] ?? FIELD_DEFAULTS[f] ?? '';
    if (NUMERIC_FIELDS.includes(f)) {
      result[f] = parseFloat(v) || 0;
    } else {
      result[f] = v;
    }
  });

  // Fix period: Google Sheets may auto-format "2026-04" as a date.
  // Recover YYYY-MM from various representations.
  result.period = normalizePeriod(String(result.period ?? ''));

  // Backward compat: old rows have 'status' in position 8 (index 8).
  // The field is now called 'localStatus' in the schema, but the Sheet
  // column value is the same. If localStatus is empty, default to 'draft'.
  if (!result.localStatus) {
    result.localStatus = 'draft';
  }

  // Ensure rsgeSyncState always has a valid value
  if (!result.rsgeSyncState) {
    result.rsgeSyncState = 'unlinked';
  }

  return result as Declaration;
}

export function useDeclarations() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const query = useQuery({
    queryKey: ['declarations'],
    queryFn: async (): Promise<Declaration[]> => {
      const rows = await getClient().getSheet('declarations');
      if (rows.length <= 1) return [];
      return rows.slice(1).map(rowToDeclaration);
    },
    staleTime: 5 * 60 * 1000,
  });

/**
 * Fields that look like dates (YYYY-MM) and must be prefixed with `'` (apostrophe)
 * when using USER_ENTERED to prevent Google Sheets from auto-formatting them
 * as Date type. The apostrophe is NOT stored — it's a Sheets hint for "plain text".
 */
const TEXT_FORCE_FIELDS: ReadonlySet<keyof Declaration> = new Set(['period']);

/** Serialize a Declaration into a row array for Google Sheets */
function serializeRow(data: Declaration, isNew: boolean): string[] {
  const now = new Date().toISOString().split('T')[0];
  return DECLARATION_FIELDS.map((f) => {
    if (isNew && (f === 'createdAt' || f === 'updatedAt')) return now;
    if (!isNew && f === 'updatedAt') return now;
    if (f === 'rsgeSyncState' && !data[f]) return 'unlinked';
    return String(data[f] ?? '');
  });
}

  const addDeclaration = useMutation({
    mutationFn: async (data: Declaration) => {
      const row = serializeRow(data, true);
      await getClient().appendRow('declarations', row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['declarations'] });
      addToast('Декларация сохранена', 'success');
    },
    onError: () => addToast('Ошибка при сохранении декларации', 'error'),
  });

  const updateDeclaration = useMutation({
    mutationFn: async ({ data, rowIndex }: { data: Declaration; rowIndex: number }) => {
      const row = serializeRow(data, false);
      await getClient().updateRow('declarations', rowIndex, row);
    },
    onMutate: async ({ data, rowIndex }) => {
      // Cancel in-flight refetches so they don't overwrite optimistic update
      await qc.cancelQueries({ queryKey: ['declarations'] });
      const prev = qc.getQueryData<Declaration[]>(['declarations']);
      if (prev) {
        const idx = rowIndex - 2; // Convert back to 0-indexed array position
        if (idx >= 0 && idx < prev.length) {
          const updated = [...prev];
          updated[idx] = { ...data, updatedAt: new Date().toISOString().split('T')[0] };
          qc.setQueryData(['declarations'], updated);
        }
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic update on error
      if (context?.prev) {
        qc.setQueryData(['declarations'], context.prev);
      }
      addToast('Ошибка при обновлении декларации', 'error');
    },
    onSettled: () => {
      // Always refetch from source of truth after mutation completes
      qc.invalidateQueries({ queryKey: ['declarations'] });
    },
    onSuccess: () => {
      addToast('Декларация обновлена', 'success');
    },
  });

  const deleteDeclaration = useMutation({
    mutationFn: async (rowIndex: number) => {
      await getClient().deleteRow('declarations', rowIndex);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['declarations'] });
      addToast('Декларация удалена', 'success');
    },
    onError: () => addToast('Ошибка при удалении декларации', 'error'),
  });

  return {
    declarations: query.data ?? [],
    isLoading: query.isLoading,
    addDeclaration: addDeclaration.mutateAsync,
    updateDeclaration: updateDeclaration.mutateAsync,
    deleteDeclaration: deleteDeclaration.mutateAsync,
  };
}
