import { useForm, useFieldArray } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientFormData, CLIENT_DEFAULTS } from '@/entities/client/schemas';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { FieldSelect } from '@/shared/ui/FieldSelect';
import { Icon } from '@/shared/ui/Icon';
import './ClientForm.css';

interface ClientFormProps {
  initial?: ClientFormData;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
}

export function ClientForm({ initial, onSubmit, onCancel }: ClientFormProps) {
  const isEdit = !!initial;
  const t = useT();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormData>,
    defaultValues: initial ?? { ...CLIENT_DEFAULTS, id: crypto.randomUUID() },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'accounts',
  });

  return (
    <form className="client-form" onSubmit={handleSubmit(onSubmit)}>
      <h3 className="client-form__title">
        {isEdit ? `✏️ ${t['client_edit'] ?? 'Edit client'}` : `➕ ${t['client_new'] ?? 'New client'}`}
      </h3>

      {/* ── Personal details ── */}
      <div className="client-form__grid">
        <Input
          label={t['client_name'] ?? 'Name'}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label={t['client_email'] ?? 'Email'}
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label={t['client_address'] ?? 'Address'}
          {...register('address')}
        />
        <Input
          label={t['client_tin'] ?? 'TIN'}
          hint={t['optional'] ?? 'Optional'}
          {...register('tin')}
        />
        <Input
          label={t['client_default_project'] ?? 'Default project'}
          hint={t['client_default_project_hint'] ?? 'For invoice autofill'}
          {...register('defaultProject')}
        />
      </div>

      {/* ── Bank accounts ── */}
      <div className="client-form__accounts">
        <div className="client-form__accounts-header">
          <span className="client-form__accounts-title">
            <Icon name="bank" size={13} />
            {t['client_accounts'] ?? 'Bank accounts'}
          </span>
          <button
            type="button"
            className="client-form__accounts-add"
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                clientId: watch('id'),
                currency: 'USD',
                bankName: '',
                iban: '',
                isDefault: fields.length === 0,
                createdAt: new Date().toISOString().split('T')[0],
              })
            }
          >
            <Icon name="plus" size={13} />
            {t['client_account_add'] ?? 'Add account'}
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="client-form__accounts-empty">
            {t['client_accounts_empty'] ?? 'No bank accounts yet. Add one to enable PDF invoice generation.'}
          </p>
        ) : (
          <div className="client-form__accounts-list">
            {fields.map((field, idx) => (
              <div key={field.id} className="client-account-row">
                <FieldSelect
                  label={t['client_account_currency'] ?? 'Currency'}
                  id={`acc-currency-${idx}`}
                  options={CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c) }))}
                  value={watch(`accounts.${idx}.currency`) ?? 'USD'}
                  onChange={(val) =>
                    setValue(`accounts.${idx}.currency`, val as 'USD' | 'EUR' | 'GBP' | 'GEL')
                  }
                />
                <Input
                  label={t['client_bank'] ?? 'Bank'}
                  {...register(`accounts.${idx}.bankName`)}
                />
                <Input
                  label={t['client_iban'] ?? 'IBAN'}
                  mono
                  {...register(`accounts.${idx}.iban`)}
                />
                <button
                  type="button"
                  className="client-account-row__remove"
                  aria-label={t['client_account_remove'] ?? 'Remove account'}
                  onClick={() => remove(idx)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="client-form__actions">
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? (t['save'] ?? 'Save') : (t['add'] ?? 'Add')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t['cancel'] ?? 'Cancel'}
        </Button>
      </div>
    </form>
  );
}
