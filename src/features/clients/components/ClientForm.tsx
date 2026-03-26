import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientFormData, CLIENT_DEFAULTS } from '@/entities/client/schemas';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import './ClientForm.css';

interface ClientFormProps {
  initial?: ClientFormData;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
}

export function ClientForm({ initial, onSubmit, onCancel }: ClientFormProps) {
  const isEdit = !!initial;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initial ?? { ...CLIENT_DEFAULTS, id: crypto.randomUUID() },
  });

  return (
    <form className="client-form" onSubmit={handleSubmit(onSubmit)}>
      <h3 className="client-form__title">{isEdit ? '✏️ Редактировать' : '➕ Новый клиент'}</h3>

      <div className="client-form__grid">
        <Input
          label="Название / Имя"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Адрес"
          {...register('address')}
        />
        <Input
          label="TIN"
          hint="Необязательно"
          {...register('tin')}
        />
        <Input
          label="Банк"
          {...register('bankName')}
        />
        <Input
          label="IBAN"
          error={errors.iban?.message}
          mono
          {...register('iban')}
        />
        <div className="field">
          <label className="field__label" htmlFor="client-currency">Валюта по умолчанию</label>
          <select className="field__select" id="client-currency" {...register('defaultCurrency')}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="GEL">GEL (₾)</option>
          </select>
        </div>
        <Input
          label="Проект по умолчанию"
          hint="Для автозаполнения инвойсов"
          {...register('defaultProject')}
        />
      </div>

      <div className="client-form__actions">
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Сохранить' : 'Добавить'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
