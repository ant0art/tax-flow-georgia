import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SheetsClient } from '@/shared/api/sheets-client';
import { useAuthStore } from '@/features/auth/store';
import type { SettingsFormData } from '@/entities/settings/schemas';
import { SETTINGS_DEFAULTS } from '@/entities/settings/schemas';
import { useToastStore } from '@/shared/ui/Toast.store';

const SETTINGS_FIELDS: (keyof SettingsFormData)[] = [
  'fullName', 'tin', 'address', 'email', 'phone',
  'bankName', 'beneficiary', 'iban', 'swift',
  'defaultCurrency', 'taxRate', 'vatText', 'invoicePrefix',
];

function getClient() {
  return new SheetsClient(() => useAuthStore.getState().accessToken);
}

export function useSettings() {
  const qc = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<SettingsFormData> => {
      const rows = await getClient().getSheet('settings');
      if (rows.length < 2) return SETTINGS_DEFAULTS;
      const values = rows[1]; // row 2 = data
      const result: Record<string, unknown> = {};
      SETTINGS_FIELDS.forEach((field, i) => {
        result[field] = values[i] ?? '';
      });
      // Parse numeric
      result.taxRate = parseFloat(result.taxRate as string) || 0.01;
      return result as SettingsFormData;
    },
    staleTime: 30 * 60 * 1000, // 30 min
  });

  const mutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const row = SETTINGS_FIELDS.map((f) => String(data[f] ?? ''));
      await getClient().updateRow('settings', 2, row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      addToast('Настройки сохранены', 'success');
    },
    onError: () => {
      addToast('Ошибка сохранения настроек', 'error');
    },
  });

  return { settings: query.data, isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}
