import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { settingsSchema, type SettingsFormData, SETTINGS_DEFAULTS } from '@/entities/settings/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useDraftPersist } from '@/shared/hooks/useDraftPersist';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './SettingsForm.css';

export function SettingsForm() {
  const { settings, isLoading, save, isSaving } = useSettings();
  const t = useT();

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

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const watchAll = watch();
  const restore = useCallback((data: SettingsFormData) => reset(data), [reset]);
  const { clearDraft } = useDraftPersist('settings', watchAll, restore);

  const onSubmit = async (data: SettingsFormData) => {
    await save(data);
    clearDraft();
  };

  if (isLoading) {
    return <div className="settings-skeleton">{t['loading_settings']}</div>;
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit(onSubmit)}>
      <section className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="user" size={18} />
          {t['settings_personal']}
        </h2>
        <div className="settings-grid">
          <Input
            label={t['settings_fullname']}
            hint={t['settings_fullname_hint']}
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label={t['settings_tin']}
            hint={t['settings_tin_hint']}
            error={errors.tin?.message}
            {...register('tin')}
          />
          <Input
            label={t['settings_address']}
            error={errors.address?.message}
            {...register('address')}
          />
          <Input
            label={t['settings_email']}
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label={t['settings_phone']}
            hint={t['settings_phone_hint']}
            {...register('phone')}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="bank" size={18} />
          {t['settings_bank']}
        </h2>
        <div className="settings-grid">
          <Input
            label={t['settings_bank_name']}
            hint={t['settings_bank_name_hint']}
            error={errors.bankName?.message}
            {...register('bankName')}
          />
          <Input
            label={t['settings_beneficiary']}
            error={errors.beneficiary?.message}
            {...register('beneficiary')}
          />
          <Input
            label={t['settings_iban']}
            hint={t['settings_iban_hint']}
            error={errors.iban?.message}
            mono
            {...register('iban')}
          />
          <Input
            label={t['settings_swift']}
            hint={t['settings_swift_hint']}
            error={errors.swift?.message}
            mono
            {...register('swift')}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="sliders" size={18} />
          {t['settings_defaults']}
        </h2>
        <div className="settings-grid">
          <div className="field">
            <label className="field__label" htmlFor="defaultCurrency">{t['settings_default_currency']}</label>
            <select className="field__select" id="defaultCurrency" {...register('defaultCurrency')}>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="GEL">GEL (₾)</option>
            </select>
          </div>
          <Input
            label={t['settings_tax_rate']}
            hint={t['settings_tax_rate_hint']}
            type="number"
            step="0.001"
            mono
            error={errors.taxRate?.message}
            {...register('taxRate')}
          />
          <Input
            label={t['settings_vat_text']}
            hint={t['settings_vat_text_hint']}
            error={errors.vatText?.message}
            {...register('vatText')}
          />
          <Input
            label={t['settings_invoice_prefix']}
            hint={t['settings_invoice_prefix_hint']}
            {...register('invoicePrefix')}
          />
        </div>
      </section>

      <div className="settings-form__actions">
        <Button type="submit" loading={isSaving} disabled={!isDirty}>
          {t['settings_save']}
        </Button>
        {isDirty && (
          <Button type="button" variant="ghost" onClick={() => reset(settings)}>
            {t['settings_cancel']}
          </Button>
        )}
      </div>
    </form>
  );
}
