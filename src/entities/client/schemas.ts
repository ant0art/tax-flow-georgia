import { z } from 'zod';

export const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Имя клиента — минимум 2 символа'),
  email: z.string(),
  address: z.string(),
  tin: z.string(),
  bankName: z.string(),
  iban: z.string(),
  defaultCurrency: z.enum(['USD', 'EUR', 'GBP', 'GEL']),
  defaultProject: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

export const CLIENT_DEFAULTS: Omit<ClientFormData, 'id'> = {
  name: '',
  email: '',
  address: '',
  tin: '',
  bankName: '',
  iban: '',
  defaultCurrency: 'USD',
  defaultProject: '',
  createdAt: '',
  updatedAt: '',
};
