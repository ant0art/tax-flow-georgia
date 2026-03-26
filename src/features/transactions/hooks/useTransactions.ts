import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { TransactionFormData } from '@/entities/transaction/schemas';
import { TRANSACTION_FIELDS } from '@/entities/transaction/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

function rowToTransaction(row: string[]): TransactionFormData {
  const result: Record<string, unknown> = {};
  TRANSACTION_FIELDS.forEach((f, i) => {
    const v = row[i] ?? '';
    if (['amountOriginal', 'nbgRate', 'amountGEL', 'taxRate', 'taxAmount'].includes(f)) {
      result[f] = parseFloat(v) || 0;
    } else {
      result[f] = v;
    }
  });
  return result as TransactionFormData;
}

export function useTransactions() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const query = useQuery({
    queryKey: ['transactions'],
    queryFn: async (): Promise<TransactionFormData[]> => {
      const rows = await getClient().getSheet('transactions');
      if (rows.length <= 1) return [];
      return rows.slice(1).map(rowToTransaction);
    },
  });

  const addTransaction = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const now = new Date().toISOString().split('T')[0];
      const row = TRANSACTION_FIELDS.map((f) => {
        if (f === 'createdAt' || f === 'updatedAt') return now;
        return String(data[f] ?? '');
      });
      await getClient().appendRow('transactions', row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      addToast('Транзакция добавлена', 'success');
    },
    onError: () => addToast('Ошибка при добавлении транзакции', 'error'),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (rowIndex: number) => {
      await getClient().deleteRow('transactions', rowIndex);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      addToast('Транзакция удалена', 'info');
    },
    onError: () => addToast('Ошибка при удалении', 'error'),
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    addTransaction: addTransaction.mutateAsync,
    deleteTransaction: deleteTransaction.mutateAsync,
  };
}
