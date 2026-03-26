import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, type TransactionFormData } from '@/entities/transaction/schemas';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { fetchNBGRate } from '@/shared/api/nbg-rate';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import './TransactionForm.css';

interface Props {
  onDone: () => void;
}

export function TransactionForm({ onDone }: Props) {
  const { addTransaction } = useTransactions();
  const { invoices } = useInvoices();
  const { settings } = useSettings();
  const [fetchingRate, setFetchingRate] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: crypto.randomUUID(),
      date: today,
      invoiceId: '',
      invoiceNumber: '',
      clientName: '',
      description: '',
      amountOriginal: 0,
      currency: settings?.defaultCurrency ?? 'USD',
      nbgRate: 0,
      amountGEL: 0,
      taxRate: settings?.taxRate ?? 0.01,
      taxAmount: 0,
      project: '',
      createdAt: '',
      updatedAt: '',
    },
  });

  const date = watch('date');
  const currency = watch('currency');
  const amountOriginal = watch('amountOriginal');
  const nbgRate = watch('nbgRate');
  const taxRate = watch('taxRate');

  // Auto-fetch NBG rate when date or currency changes
  useEffect(() => {
    if (!date || currency === 'GEL') {
      if (currency === 'GEL') setValue('nbgRate', 1);
      return;
    }
    let cancelled = false;
    setFetchingRate(true);
    fetchNBGRate(currency, date).then((rate) => {
      if (!cancelled && rate > 0) {
        setValue('nbgRate', rate);
      }
      setFetchingRate(false);
    });
    return () => { cancelled = true; };
  }, [date, currency, setValue]);

  // Recalculate GEL amount and tax when inputs change
  useEffect(() => {
    if (nbgRate > 0 && amountOriginal > 0) {
      const gel = amountOriginal * nbgRate;
      setValue('amountGEL', Math.round(gel * 100) / 100);
      setValue('taxAmount', Math.round(gel * taxRate * 100) / 100);
    }
  }, [amountOriginal, nbgRate, taxRate, setValue]);

  // Invoice linking
  const handleInvoiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invId = e.target.value;
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setValue('invoiceId', inv.id);
      setValue('invoiceNumber', inv.number);
      setValue('clientName', inv.clientName);
      setValue('amountOriginal', Number(inv.total));
      setValue('currency', inv.currency);
      setValue('project', inv.project);
      setValue('description', `Payment for invoice ${inv.number}`);
    }
  };

  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');

  const onSubmit = async (data: TransactionFormData) => {
    await addTransaction(data);
    onDone();
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit(onSubmit)}>
      <h3 className="transaction-form__title">💸 Новая транзакция</h3>

      {/* Link to invoice */}
      {unpaidInvoices.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="tx-invoice">Привязать к инвойсу (опционально)</label>
          <select className="field__select" id="tx-invoice" onChange={handleInvoiceSelect}>
            <option value="">— Без привязки —</option>
            {unpaidInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {inv.clientName} ({inv.currency} {Number(inv.total).toFixed(2)})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="transaction-form__grid">
        <Input label="Дата" type="date" error={errors.date?.message} {...register('date')} />
        <Input label="Клиент" error={errors.clientName?.message} {...register('clientName')} />
        <Input label="Описание" error={errors.description?.message} {...register('description')} />
        <Input label="Проект" {...register('project')} />
      </div>

      <div className="transaction-form__amounts">
        <Input
          label="Сумма"
          type="number"
          step="0.01"
          mono
          error={errors.amountOriginal?.message}
          {...register('amountOriginal', { valueAsNumber: true })}
        />
        <div className="field">
          <label className="field__label" htmlFor="tx-currency">Валюта</label>
          <select className="field__select" id="tx-currency" {...register('currency')}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="GEL">GEL (₾)</option>
          </select>
        </div>
        <Input
          label={`Курс NBG ${fetchingRate ? '⏳' : ''}`}
          type="number"
          step="0.0001"
          mono
          hint="Заполняется автоматически"
          error={errors.nbgRate?.message}
          {...register('nbgRate', { valueAsNumber: true })}
        />
        <div className="transaction-form__computed">
          <div className="transaction-form__gel">
            <span className="field__label">Сумма в GEL</span>
            <span className="amount">{watch('amountGEL').toFixed(2)} ₾</span>
          </div>
          <div className="transaction-form__tax">
            <span className="field__label">Налог ({(taxRate * 100).toFixed(1)}%)</span>
            <span className="amount">{watch('taxAmount').toFixed(2)} ₾</span>
          </div>
        </div>
      </div>

      <div className="transaction-form__actions">
        <Button type="submit" loading={isSubmitting}>Добавить</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Отмена</Button>
      </div>
    </form>
  );
}
