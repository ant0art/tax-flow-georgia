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

  const addDeclaration = useMutation({
    mutationFn: async (data: Declaration) => {
      const now = new Date().toISOString().split('T')[0];
      const row = DECLARATION_FIELDS.map((f) => {
        if (f === 'createdAt' || f === 'updatedAt') return now;
        if (f === 'rsgeSyncState' && !data[f]) return 'unlinked';
        return String(data[f] ?? '');
      });
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
      const now = new Date().toISOString().split('T')[0];
      const row = DECLARATION_FIELDS.map((f) => {
        if (f === 'updatedAt') return now;
        return String(data[f] ?? '');
      });
      await getClient().updateRow('declarations', rowIndex, row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['declarations'] });
      addToast('Декларация обновлена', 'success');
    },
    onError: () => addToast('Ошибка при обновлении декларации', 'error'),
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
