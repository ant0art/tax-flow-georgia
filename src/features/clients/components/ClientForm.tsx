import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientFormData, CLIENT_DEFAULTS } from '@/entities/client/schemas';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { FieldSelect } from '@/shared/ui/FieldSelect';
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
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initial ?? { ...CLIENT_DEFAULTS, id: crypto.randomUUID() },
  });

  return (
    <form className="client-form" onSubmit={handleSubmit(onSubmit)}>
      <h3 className="client-form__title">
        {isEdit ? `✏️ ${t['client_edit'] ?? 'Edit client'}` : `➕ ${t['client_new'] ?? 'New client'}`}
      </h3>

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
          label={t['client_bank'] ?? 'Bank'}
          {...register('bankName')}
        />
        <Input
          label={t['client_iban'] ?? 'IBAN'}
          error={errors.iban?.message}
          mono
          {...register('iban')}
        />
        <FieldSelect
          label={t['client_default_currency'] ?? 'Default currency'}
          id="client-currency"
          options={CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c) }))}
          value={watch('defaultCurrency') ?? 'USD'}
          onChange={(val) => setValue('defaultCurrency', val as 'USD' | 'EUR' | 'GBP' | 'GEL')}
        />
        <Input
          label={t['client_default_project'] ?? 'Default project'}
          hint={t['client_default_project_hint'] ?? 'For invoice autofill'}
          {...register('defaultProject')}
        />
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
