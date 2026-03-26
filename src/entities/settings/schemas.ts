import { z } from 'zod';

export const settingsSchema = z.object({
  fullName: z.string().min(3, 'Имя должно содержать минимум 3 символа'),
  tin: z.string().regex(/^\d{9}$|^\d{11}$/, 'TIN должен содержать 9 или 11 цифр'),
  address: z.string().min(5, 'Укажите адрес'),
  email: z.string().email('Укажите корректный email'),
  phone: z.string().optional().or(z.literal('')),
  bankName: z.string().min(2, 'Укажите название банка'),
  beneficiary: z.string().min(2, 'Укажите получателя'),
  iban: z.string().regex(
    /^GE\d{2}[A-Z]{2}\d{16}$/,
    'IBAN должен начинаться с GE и содержать 22 символа (пример: GE37TB7831445064400006)'
  ),
  swift: z.string().regex(
    /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
    'SWIFT должен содержать 8 или 11 символов (пример: TBCBGE22)'
  ),
  defaultCurrency: z.enum(['USD', 'EUR', 'GBP', 'GEL']),
  taxRate: z.number().min(0, 'Ставка ≥ 0').max(1, 'Ставка ≤ 1 (100%)'),
  vatText: z.string(),
  invoicePrefix: z.string(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

export const SETTINGS_DEFAULTS: SettingsFormData = {
  fullName: '',
  tin: '',
  address: '',
  email: '',
  phone: '',
  bankName: '',
  beneficiary: '',
  iban: '',
  swift: '',
  defaultCurrency: 'USD',
  taxRate: 0.01,
  vatText: 'Zero rated',
  invoicePrefix: '',
};
