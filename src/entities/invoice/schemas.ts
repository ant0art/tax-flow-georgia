import { z } from 'zod';

export const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  description: z.string().min(1, 'Укажите описание'),
  quantity: z.number().min(0.01, 'Мин. 0.01'),
  unitPrice: z.number().min(0, 'Цена ≥ 0'),
  total: z.number(),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.string().min(1, 'Номер обязателен'),
  clientId: z.string(),
  clientName: z.string().min(1, 'Выберите клиента'),
  date: z.string().min(1, 'Укажите дату'),
  dueDate: z.string().min(1, 'Укажите срок оплаты'),
  currency: z.string().min(1, 'Укажите валюту'),
  subtotal: z.number(),
  vatText: z.string(),
  vatAmount: z.number(),
  total: z.number(),
  project: z.string(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']),
  linkedTransactionId: z.string(),
  notes: z.string(),
  businessEntityId: z.string(),
  // Snapshot of client bank details at invoice creation time (immutable)
  clientBankName: z.string().optional().default(''),
  clientIban: z.string().optional().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const INVOICE_FIELDS: (keyof InvoiceFormData)[] = [
  'id', 'number', 'clientId', 'clientName', 'date', 'dueDate',
  'currency', 'subtotal', 'vatText', 'vatAmount', 'total',
  'project', 'status', 'linkedTransactionId', 'notes',
  'createdAt', 'updatedAt',
  'businessEntityId', 'clientBankName', 'clientIban', // NEW — appended last for sheet compat
];

export const ITEM_FIELDS: (keyof InvoiceItem)[] = [
  'id', 'invoiceId', 'description', 'quantity', 'unitPrice', 'total',
];

/**
 * Генерация идемпотентного номера: YYYY-MM-DD-NNN
 * NNN — порядковый номер за дату
 */
export function generateInvoiceNumber(
  date: string,
  existingNumbers: string[],
  prefix = ''
): string {
  const datePrefix = prefix ? `${prefix}-${date}` : date;
  const sameDateNumbers = existingNumbers
    .filter((n) => n.startsWith(datePrefix))
    .map((n) => {
      const parts = n.split('-');
      return parseInt(parts[parts.length - 1], 10) || 0;
    });
  const nextSeq = Math.max(0, ...sameDateNumbers) + 1;
  return `${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
}
