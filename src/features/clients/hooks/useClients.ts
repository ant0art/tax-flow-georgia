import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { ClientFormData, ClientAccount } from '@/entities/client/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

// ── Row ↔ Object mappers ──────────────────────────────────────────────────────

function rowToClientBase(row: string[]): Omit<ClientFormData, 'accounts'> {
  return {
    id: row[0] ?? '',
    name: row[1] ?? '',
    email: row[2] ?? '',
    address: row[3] ?? '',
    tin: row[4] ?? '',
    defaultProject: row[5] ?? '',
    createdAt: row[6] ?? '',
    updatedAt: row[7] ?? '',
  };
}

function rowToAccount(row: string[]): ClientAccount {
  return {
    id: row[0] ?? '',
    clientId: row[1] ?? '',
    currency: (row[2] ?? 'USD') as 'USD' | 'EUR' | 'GBP' | 'GEL',
    bankName: row[3] ?? '',
    iban: row[4] ?? '',
    isDefault: row[5] === 'true',
    createdAt: row[6] ?? '',
  };
}

function clientToRow(data: ClientFormData, updatedAt: string, createdAt?: string): string[] {
  return [
    data.id,
    data.name,
    data.email,
    data.address,
    data.tin,
    data.defaultProject,
    createdAt ?? data.createdAt ?? '',
    updatedAt,
  ];
}

function accountToRow(acc: ClientAccount): string[] {
  return [
    acc.id,
    acc.clientId,
    acc.currency,
    acc.bankName,
    acc.iban,
    acc.isDefault ? 'true' : 'false',
    acc.createdAt || new Date().toISOString().split('T')[0],
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useClients() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  // Single batch read: clients + client_accounts in one API call
  const query = useQuery({
    queryKey: ['clients'],
    queryFn: async (): Promise<ClientFormData[]> => {
      const [clientRows, accountRows] = await getClient().batchRead([
        'clients',
        'client_accounts',
      ]);

      // Parse accounts first (skip header row)
      const allAccounts: ClientAccount[] =
        accountRows.length > 1 ? accountRows.slice(1).map(rowToAccount) : [];

      // Parse clients (skip header row) and join accounts
      if (clientRows.length <= 1) return [];
      return clientRows.slice(1).map((row) => {
        const base = rowToClientBase(row);
        return {
          ...base,
          accounts: allAccounts.filter((a) => a.clientId === base.id),
        };
      });
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addClient = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const now = new Date().toISOString().split('T')[0];
      const sheets = getClient();
      // Write client row (without accounts)
      await sheets.appendRow('clients', clientToRow(data, now, now));
      // Write each account as a separate row
      for (const acc of data.accounts ?? []) {
        const accWithClient: ClientAccount = { ...acc, clientId: data.id };
        await sheets.appendRow('client_accounts', accountToRow(accWithClient));
      }
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
      const sheets = getClient();
      // Update the client row (accounts are managed separately)
      await sheets.updateRow('clients', rowIndex, clientToRow(data, now, data.createdAt));

      // Sync accounts: delete removed, add new, update existing
      const accountRows = await sheets.getSheet('client_accounts');
      const existingAccounts = accountRows.length > 1
        ? accountRows.slice(1).map((r, i) => ({ acc: rowToAccount(r), sheetRow: i + 2 }))
            .filter((x) => x.acc.clientId === data.id)
        : [];

      const newIds = new Set((data.accounts ?? []).map((a) => a.id));
      const existingIds = new Set(existingAccounts.map((x) => x.acc.id));

      // Delete removed accounts (reverse order to keep indices stable)
      const toDelete = existingAccounts.filter((x) => !newIds.has(x.acc.id));
      for (const item of toDelete.reverse()) {
        await sheets.deleteRow('client_accounts', item.sheetRow);
      }

      // Add new accounts
      for (const acc of data.accounts ?? []) {
        if (!existingIds.has(acc.id)) {
          const accWithClient: ClientAccount = { ...acc, clientId: data.id };
          await sheets.appendRow('client_accounts', accountToRow(accWithClient));
        }
      }

      // Update existing accounts that may have changed
      // Re-read after deletes to get fresh indices
      if (data.accounts?.some((a) => existingIds.has(a.id))) {
        const freshRows = await sheets.getSheet('client_accounts');
        for (const acc of data.accounts ?? []) {
          if (!existingIds.has(acc.id)) continue;
          const freshIdx = freshRows.findIndex((r) => r[0] === acc.id);
          if (freshIdx > 0) { // skip header (index 0)
            const accWithClient: ClientAccount = { ...acc, clientId: data.id };
            await sheets.updateRow('client_accounts', freshIdx + 1, accountToRow(accWithClient));
          }
        }
      }
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
      // Note: orphan accounts in client_accounts are harmless
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Клиент удалён', 'info');
    },
    onError: () => addToast('Ошибка при удалении клиента', 'error'),
  });

  // Simple: just append a row to client_accounts
  const addAccountToClient = useMutation({
    mutationFn: async ({ clientId, account }: { clientId: string; account: ClientAccount }) => {
      const accWithClient: ClientAccount = { ...account, clientId };
      await getClient().appendRow('client_accounts', accountToRow(accWithClient));
      return accWithClient;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast('Реквизиты добавлены', 'success');
    },
    onError: () => addToast('Ошибка при добавлении реквизитов', 'error'),
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addClient: addClient.mutateAsync,
    updateClient: updateClient.mutateAsync,
    deleteClient: deleteClient.mutateAsync,
    addAccountToClient: addAccountToClient.mutateAsync,
  };
}
