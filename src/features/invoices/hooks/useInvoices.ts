import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { INVOICE_FIELDS, ITEM_FIELDS } from '@/entities/invoice/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

function rowToInvoice(row: string[]): InvoiceFormData {
  const result: Record<string, unknown> = {};
  INVOICE_FIELDS.forEach((f, i) => {
    const v = row[i] ?? '';
    if (['subtotal', 'vatAmount', 'total'].includes(f)) {
      result[f] = parseFloat(v) || 0;
    } else {
      result[f] = v;
    }
  });
  return result as InvoiceFormData;
}

function rowToItem(row: string[]): InvoiceItem {
  const result: Record<string, unknown> = {};
  ITEM_FIELDS.forEach((f, i) => {
    const v = row[i] ?? '';
    if (['quantity', 'unitPrice', 'total'].includes(f)) {
      result[f] = parseFloat(v) || 0;
    } else {
      result[f] = v;
    }
  });
  return result as InvoiceItem;
}

export function useInvoices() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async (): Promise<InvoiceFormData[]> => {
      const rows = await getClient().getSheet('invoices');
      if (rows.length <= 1) return [];
      return rows.slice(1).map(rowToInvoice);
    },
  });

  const itemsQuery = useQuery({
    queryKey: ['invoice_items'],
    queryFn: async (): Promise<InvoiceItem[]> => {
      const rows = await getClient().getSheet('invoice_items');
      if (rows.length <= 1) return [];
      return rows.slice(1).map(rowToItem);
    },
  });

  const saveInvoice = useMutation({
    mutationFn: async ({
      invoice,
      items,
      isNew,
      invoiceRowIndex,
    }: {
      invoice: InvoiceFormData;
      items: InvoiceItem[];
      isNew: boolean;
      invoiceRowIndex?: number;
    }) => {
      const client = getClient();
      const now = new Date().toISOString().split('T')[0];

      // Save invoice row
      const invoiceRow = INVOICE_FIELDS.map((f) => {
        if (f === 'createdAt' && isNew) return now;
        if (f === 'updatedAt') return now;
        return String(invoice[f] ?? '');
      });

      if (isNew) {
        await client.appendRow('invoices', invoiceRow);
      } else if (invoiceRowIndex) {
        await client.updateRow('invoices', invoiceRowIndex, invoiceRow);
      }

      // For items: delete old items and re-append (simplest approach for multi-row)
      if (!isNew && invoiceRowIndex) {
        // Get existing items to find their rows
        const allItems = await client.getSheet('invoice_items');
        const rowsToDelete: number[] = [];
        allItems.forEach((row, idx) => {
          if (idx > 0 && row[1] === invoice.id) {
            rowsToDelete.push(idx + 1); // 1-indexed, skip header
          }
        });
        // Delete in reverse order to preserve indices
        for (const ri of rowsToDelete.reverse()) {
          await client.deleteRow('invoice_items', ri);
        }
      }

      // Append new items
      for (const item of items) {
        const itemRow = ITEM_FIELDS.map((f) => String(item[f] ?? ''));
        await client.appendRow('invoice_items', itemRow);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice_items'] });
      addToast('Инвойс сохранён', 'success');
    },
    onError: () => addToast('Ошибка сохранения инвойса', 'error'),
  });

  const deleteInvoice = useMutation({
    mutationFn: async ({ id, rowIndex }: { id: string; rowIndex: number }) => {
      const client = getClient();
      await client.deleteRow('invoices', rowIndex);
      // Delete associated items
      const allItems = await client.getSheet('invoice_items');
      const rowsToDelete: number[] = [];
      allItems.forEach((row, idx) => {
        if (idx > 0 && row[1] === id) {
          rowsToDelete.push(idx + 1);
        }
      });
      for (const ri of rowsToDelete.reverse()) {
        await client.deleteRow('invoice_items', ri);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice_items'] });
      addToast('Инвойс удалён', 'info');
    },
    onError: () => addToast('Ошибка удаления', 'error'),
  });

  const changeStatus = useMutation({
    mutationFn: async ({
      id,
      rowIndex,
      status,
    }: {
      id: string;
      rowIndex: number;
      status: string;
    }) => {
      // Read the current row, update just status + updatedAt
      const client = getClient();
      const rows = await client.getSheet('invoices');
      const currentRow = rows[rowIndex - 1] ?? []; // rowIndex is 1-indexed (header=row1, first data=row2)
      const now = new Date().toISOString().split('T')[0];
      const statusIdx = INVOICE_FIELDS.indexOf('status');
      const updatedAtIdx = INVOICE_FIELDS.indexOf('updatedAt');
      const newRow = [...currentRow];
      newRow[statusIdx] = status;
      newRow[updatedAtIdx] = now;
      // Pad row to match field count
      while (newRow.length < INVOICE_FIELDS.length) newRow.push('');
      await client.updateRow('invoices', rowIndex, newRow.slice(0, INVOICE_FIELDS.length));
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      addToast('Статус инвойса обновлён', 'success');
    },
    onError: () => addToast('Ошибка при обновлении статуса', 'error'),
  });

  return {
    invoices: invoicesQuery.data ?? [],
    items: itemsQuery.data ?? [],
    isLoading: invoicesQuery.isLoading || itemsQuery.isLoading,
    saveInvoice: saveInvoice.mutateAsync,
    isSaving: saveInvoice.isPending,
    deleteInvoice: deleteInvoice.mutateAsync,
    changeStatus: changeStatus.mutateAsync,
    getItemsForInvoice: (invoiceId: string) =>
      (itemsQuery.data ?? []).filter((i) => i.invoiceId === invoiceId),
  };
}

