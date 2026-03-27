import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, type TransactionFormData } from '@/entities/transaction/schemas';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { fetchNBGRate } from '@/shared/api/nbg-rate';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/ui/DatePicker';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './TransactionForm.css';

interface Props {
  onDone: () => void;
}

export function TransactionForm({ onDone }: Props) {
  const { addTransaction } = useTransactions();
  const { invoices } = useInvoices();
  const { settings } = useSettings();
  const [fetchingRate, setFetchingRate] = useState(false);
  const t = useT();

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

  useEffect(() => {
    if (nbgRate > 0 && amountOriginal > 0) {
      const gel = amountOriginal * nbgRate;
      setValue('amountGEL', Math.round(gel * 100) / 100);
      setValue('taxAmount', Math.round(gel * taxRate * 100) / 100);
    }
  }, [amountOriginal, nbgRate, taxRate, setValue]);

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
      <h3 className="transaction-form__title">
        <Icon name="dollar-sign" size={16} />
        {t['transaction_new']}
      </h3>

      {/* Link to invoice */}
      {unpaidInvoices.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="tx-invoice">{t['transaction_link_invoice']}</label>
          <select className="field__select" id="tx-invoice" onChange={handleInvoiceSelect}>
            <option value="">{t['transaction_no_link']}</option>
            {unpaidInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {inv.clientName} ({inv.currency} {Number(inv.total).toFixed(2)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row 1: Date + Client */}
      <div className="transaction-form__grid">
        <DatePicker
          label={t['transaction_date']}
          value={date}
          onChange={(v) => setValue('date', v)}
          error={errors.date?.message}
        />
        <Input label={t['transaction_client']} error={errors.clientName?.message} {...register('clientName')} />
        <Input label={t['transaction_description']} error={errors.description?.message} {...register('description')} />
        <Input label={t['transaction_project']} {...register('project')} />
      </div>

      {/* Row 2: Amounts */}
      <div className="transaction-form__amounts">
        <Input
          label={t['transaction_amount']}
          type="number"
          step="0.01"
          mono
          error={errors.amountOriginal?.message}
          {...register('amountOriginal', { valueAsNumber: true })}
        />
        <div className="field">
          <label className="field__label" htmlFor="tx-currency">{t['transaction_currency']}</label>
          <select className="field__select" id="tx-currency" {...register('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{currencyLabel(c)}</option>
            ))}
          </select>
        </div>
        <div className="field-with-indicator">
          <Input
            label={t['transaction_nbg_rate']}
            type="number"
            step="0.0001"
            mono
            hint={fetchingRate ? undefined : t['transaction_nbg_auto']}
            error={errors.nbgRate?.message}
            {...register('nbgRate', { valueAsNumber: true })}
          />
          {fetchingRate && (
            <span className="field-loading-indicator">
              <Icon name="loader" size={13} className="icon--spin" />
            </span>
          )}
        </div>

        {/* Computed result */}
        <div className="transaction-form__computed">
          <div className="transaction-form__gel">
            <span className="field__label">{t['transaction_gel_amount']}</span>
            <span className="amount">{watch('amountGEL').toFixed(2)} ₾</span>
          </div>
          <div className="transaction-form__tax">
            <span className="field__label">{t['transaction_tax']} ({(taxRate * 100).toFixed(1)}%)</span>
            <span className="amount">{watch('taxAmount').toFixed(2)} ₾</span>
          </div>
        </div>
      </div>

      <div className="transaction-form__actions">
        <Button type="submit" loading={isSubmitting}>{t['transaction_submit']}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t['transaction_cancel']}</Button>
      </div>
    </form>
  );
}
