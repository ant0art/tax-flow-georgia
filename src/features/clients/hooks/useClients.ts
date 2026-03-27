import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { ClientFormData } from '@/entities/client/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

const CLIENT_FIELDS: (keyof ClientFormData)[] = [
  'id', 'name', 'email', 'address', 'tin',
  'bankName', 'iban', 'defaultCurrency', 'defaultProject',
  'createdAt', 'updatedAt',
];

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

function rowToClient(row: string[]): ClientFormData {
  const result: Record<string, unknown> = {};
  CLIENT_FIELDS.forEach((f, i) => {
    result[f] = row[i] ?? '';
  });
  return result as ClientFormData;
}

export function useClients() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const query = useQuery({
    queryKey: ['clients'],
    queryFn: async (): Promise<ClientFormData[]> => {
      const rows = await getClient().getSheet('clients');
      if (rows.length <= 1) return []; // only headers
      return rows.slice(1).map(rowToClient);
    },
  });

  const addClient = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const now = new Date().toISOString().split('T')[0];
      const row = CLIENT_FIELDS.map((f) => {
        if (f === 'createdAt' || f === 'updatedAt') return now;
        return String(data[f] ?? '');
      });
      await getClient().appendRow('clients', row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Клиент добавлен', 'success');
    },
    onError: () => addToast('Ошибка при добавлении клиента', 'error'),
  });

  const updateClient = useMutation({
    mutationFn: async ({ data, rowIndex }: { data: ClientFormData; rowIndex: number }) => {
      const now = new Date().toISOString().split('T')[0];
      const row = CLIENT_FIELDS.map((f) => {
        if (f === 'updatedAt') return now;
        return String(data[f] ?? '');
      });
      await getClient().updateRow('clients', rowIndex, row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Клиент обновлён', 'success');
    },
    onError: () => addToast('Ошибка при обновлении клиента', 'error'),
  });

  const deleteClient = useMutation({
    mutationFn: async (rowIndex: number) => {
      await getClient().deleteRow('clients', rowIndex);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Клиент удалён', 'info');
    },
    onError: () => addToast('Ошибка при удалении клиента', 'error'),
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addClient: addClient.mutateAsync,
    updateClient: updateClient.mutateAsync,
    deleteClient: deleteClient.mutateAsync,
  };
}
