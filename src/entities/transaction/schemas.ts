import { z } from 'zod';

export const transactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string().min(1, 'Укажите дату'),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  clientName: z.string(),
  description: z.string().min(1, 'Укажите описание'),
  amountOriginal: z.number().min(0.01, 'Сумма > 0'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'GEL']),
  nbgRate: z.number().min(0, 'Курс ≥ 0'),
  amountGEL: z.number(),
  taxRate: z.number(),
  taxAmount: z.number(),
  project: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

export const TRANSACTION_FIELDS: (keyof TransactionFormData)[] = [
  'id', 'date', 'invoiceId', 'invoiceNumber', 'clientName',
  'description', 'amountOriginal', 'currency', 'nbgRate', 'amountGEL',
  'taxRate', 'taxAmount', 'project', 'createdAt', 'updatedAt',
];
