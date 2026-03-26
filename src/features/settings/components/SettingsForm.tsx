import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { settingsSchema, type SettingsFormData, SETTINGS_DEFAULTS } from '@/entities/settings/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useDraftPersist } from '@/shared/hooks/useDraftPersist';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import './SettingsForm.css';

export function SettingsForm() {
  const { settings, isLoading, save, isSaving } = useSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: SETTINGS_DEFAULTS,
  });

  // Load from Sheets when data arrives
  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  // Draft persistence
  const watchAll = watch();
  const restore = useCallback((data: SettingsFormData) => reset(data), [reset]);
  const { clearDraft } = useDraftPersist('settings', watchAll, restore);

  const onSubmit = async (data: SettingsFormData) => {
    await save(data);
    clearDraft();
  };

  if (isLoading) {
    return <div className="settings-skeleton">Загрузка настроек...</div>;
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit(onSubmit)}>
      <section className="settings-section">
        <h2 className="settings-section__title">👤 Личные данные</h2>
        <div className="settings-grid">
          <Input
            label="Полное имя / название ИП"
            hint="Как указано в свидетельстве (Individual Entrepreneur ...)"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label="TIN (идентификационный номер)"
            hint="9 или 11 цифр из rs.ge"
            error={errors.tin?.message}
            {...register('tin')}
          />
          <Input
            label="Адрес"
            error={errors.address?.message}
            {...register('address')}
          />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Телефон"
            hint="Необязательно"
            {...register('phone')}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">🏦 Банковские реквизиты</h2>
        <div className="settings-grid">
          <Input
            label="Название банка"
            hint="JSC TBC Bank, Tbilisi, Georgia"
            error={errors.bankName?.message}
            {...register('bankName')}
          />
          <Input
            label="Получатель (Beneficiary)"
            error={errors.beneficiary?.message}
            {...register('beneficiary')}
          />
          <Input
            label="IBAN"
            hint="Начинается с GE, 22 символа"
            error={errors.iban?.message}
            mono
            {...register('iban')}
          />
          <Input
            label="SWIFT"
            hint="8 или 11 символов (например TBCBGE22)"
            error={errors.swift?.message}
            mono
            {...register('swift')}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">📋 Настройки по умолчанию</h2>
        <div className="settings-grid">
          <div className="field">
            <label className="field__label" htmlFor="defaultCurrency">Валюта по умолчанию</label>
            <select className="field__select" id="defaultCurrency" {...register('defaultCurrency')}>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="GEL">GEL (₾)</option>
            </select>
          </div>
          <Input
            label="Налоговая ставка"
            hint="От 0 до 1 (1% = 0.01)"
            type="number"
            step="0.001"
            mono
            error={errors.taxRate?.message}
            {...register('taxRate')}
          />
          <Input
            label="Текст НДС"
            hint="Zero rated, Not applicable и т.п."
            error={errors.vatText?.message}
            {...register('vatText')}
          />
          <Input
            label="Префикс нумерации инвойсов"
            hint="Необязательно"
            {...register('invoicePrefix')}
          />
        </div>
      </section>

      <div className="settings-form__actions">
        <Button type="submit" loading={isSaving} disabled={!isDirty}>
          Сохранить
        </Button>
        {isDirty && (
          <Button type="button" variant="ghost" onClick={() => reset(settings)}>
            Отменить
          </Button>
        )}
      </div>
    </form>
  );
}
