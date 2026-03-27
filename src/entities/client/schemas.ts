import { z } from 'zod';

// ── Bank account sub-entity (stored in `client_accounts` sheet) ──────────────
export const clientAccountSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),   // FK → clients.id
  currency: z.enum(['USD', 'EUR', 'GBP', 'GEL']),
  bankName: z.string(),
  iban: z.string(),
  isDefault: z.boolean().optional(),
  createdAt: z.string(),
});

export type ClientAccount = z.infer<typeof clientAccountSchema>;

export const CLIENT_ACCOUNT_FIELDS: (keyof ClientAccount)[] = [
  'id', 'clientId', 'currency', 'bankName', 'iban', 'isDefault', 'createdAt',
];

// ── Client entity (stored in `clients` sheet) ────────────────────────────────
export const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Имя клиента — минимум 2 символа'),
  email: z.string(),
  address: z.string(),
  tin: z.string(),
  defaultProject: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Computed in memory — NOT stored in the clients sheet
  accounts: z.array(clientAccountSchema).default([]),
});

export type ClientFormData = z.infer<typeof clientSchema>;

export const CLIENT_FIELDS: (keyof Omit<ClientFormData, 'accounts'>)[] = [
  'id', 'name', 'email', 'address', 'tin',
  'defaultProject', 'createdAt', 'updatedAt',
];

export const CLIENT_DEFAULTS: Omit<ClientFormData, 'id'> = {
  name: '',
  email: '',
  address: '',
  tin: '',
  defaultProject: '',
  accounts: [],
  createdAt: '',
  updatedAt: '',
};
