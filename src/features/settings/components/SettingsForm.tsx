import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { settingsSchema, type SettingsFormData, SETTINGS_DEFAULTS } from '@/entities/settings/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useDraftPersist } from '@/shared/hooks/useDraftPersist';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { TaxPaymentDescription } from './TaxPaymentDescription';
import './SettingsForm.css';

export function SettingsForm() {
  const { settings, isLoading, save, isSaving } = useSettings();
  const t = useT();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: SETTINGS_DEFAULTS,
  });

  // Business entities field array
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'businessEntities',
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
      <section id="section-personal" className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="user" size={14} />
          {t['settings_personal']}
        </h2>
        {/* Group 1: Identity */}
        <div className="settings-field-group">
          <div className="settings-grid settings-grid--wide-narrow">
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
          </div>
        </div>
        {/* Tax payment description block */}
        <TaxPaymentDescription tin={watchAll.tin} />
        {/* Group 2: Contacts */}
        <div className="settings-field-group">
          <div className="settings-grid settings-grid--single">
            <Input
              label={t['settings_address']}
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
          <div className="settings-grid">
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
        </div>
      </section>

      <section id="section-bank" className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="bank" size={14} />
          {t['settings_bank']}
        </h2>
        {/* Group 1: Bank identity */}
        <div className="settings-field-group">
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
          </div>
        </div>
        {/* Group 2: Codes */}
        <div className="settings-field-group">
          <div className="settings-grid settings-grid--wide-narrow">
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
        </div>
      </section>

      <section id="section-defaults" className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="sliders" size={14} />
          {t['settings_defaults']}
        </h2>
        {/* Group 1: Currency + Tax rate */}
        <div className="settings-field-group">
          <div className="settings-grid settings-grid--wide-narrow">
            <div className="field">
              <label className="field__label" htmlFor="defaultCurrency">{t['settings_default_currency']}</label>
              <select className="field__select" id="defaultCurrency" {...register('defaultCurrency')}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{currencyLabel(c)}</option>
                ))}
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
          </div>
        </div>
        {/* Group 2: Text defaults */}
        <div className="settings-field-group">
          <div className="settings-grid">
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
        </div>
      </section>

      {/* ── Business Entities (ИП profiles) ── */}
      <section id="section-entities" className="settings-section">
        <h2 className="settings-section__title section-title">
          <Icon name="address-book" size={14} />
          {t['settings_entities']}
        </h2>
        <p className="settings-section__hint">{t['settings_entities_hint']}</p>

        {fields.map((field, index) => (
          <div key={field.id} className="entity-card">
            <div className="entity-card__head">
              <span className="entity-card__index">#{index + 1}</span>
              <button
                type="button"
                className="entity-card__remove"
                title={t['settings_entity_remove']}
                onClick={() => remove(index)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
            <div className="settings-grid">
              <Input
                label={t['settings_entity_label']}
                error={errors.businessEntities?.[index]?.label?.message}
                {...register(`businessEntities.${index}.label`)}
              />
              <Input
                label={t['settings_fullname']}
                error={errors.businessEntities?.[index]?.fullName?.message}
                {...register(`businessEntities.${index}.fullName`)}
              />
              <Input
                label={t['settings_tin']}
                error={errors.businessEntities?.[index]?.tin?.message}
                {...register(`businessEntities.${index}.tin`)}
              />
              <Input
                label={t['settings_address']}
                {...register(`businessEntities.${index}.address`)}
              />
              <Input
                label={t['settings_email']}
                type="email"
                {...register(`businessEntities.${index}.email`)}
              />
              <Input
                label={t['settings_bank_name']}
                {...register(`businessEntities.${index}.bankName`)}
              />
              <Input
                label={t['settings_beneficiary']}
                {...register(`businessEntities.${index}.beneficiary`)}
              />
              <Input
                label={t['settings_iban']}
                mono
                {...register(`businessEntities.${index}.iban`)}
              />
              <Input
                label={t['settings_swift']}
                mono
                {...register(`businessEntities.${index}.swift`)}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              label: '',
              fullName: '',
              tin: '',
              address: '',
              email: '',
              phone: '',
              bankName: '',
              beneficiary: '',
              iban: '',
              swift: '',
            })
          }
        >
          {t['settings_entity_add']}
        </Button>
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
