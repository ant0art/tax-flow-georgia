import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, type TransactionFormData } from '@/entities/transaction/schemas';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { generateInvoiceNumber } from '@/entities/invoice/schemas';
import { useClients } from '@/features/clients/hooks/useClients';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { fetchNBGRate } from '@/shared/api/nbg-rate';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/ui/DatePicker';
import { ClientCombobox } from '@/features/clients/components/ClientCombobox';
import { useT } from '@/shared/i18n/useT';
import { useUIStore } from '@/shared/hooks/useTheme';
import { Icon } from '@/shared/ui/Icon';
import './TransactionForm.css';

interface Props {
  onDone: () => void;
  initial?: TransactionFormData;
  rowIndex?: number;
}

export function TransactionForm({ onDone, initial, rowIndex }: Props) {
  const { addTransaction, updateTransaction, transactions } = useTransactions();
  const { invoices, saveInvoice, changeStatus } = useInvoices();
  const { clients, isLoading: clientsLoading } = useClients();
  const { settings } = useSettings();
  const [fetchingRate, setFetchingRate] = useState(false);
  const [clientId, setClientId] = useState('');
  const [createInvoice, setCreateInvoice] = useState(false);
  const t = useT();
  const lang = useUIStore((s) => s.lang);

  const isEdit = !!initial && rowIndex !== undefined;
  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: initial ?? {
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

  // Init clientId from initial data (match by name)
  useEffect(() => {
    if (initial?.clientName) {
      const match = clients.find((c) => c.name === initial.clientName);
      if (match) setClientId(match.id);
    }
  }, [initial, clients]);

  const date = watch('date');
  const currency = watch('currency');
  const amountOriginal = watch('amountOriginal');
  const nbgRate = watch('nbgRate');
  const taxRate = watch('taxRate');
  const description = watch('description');

  // Auto-fetch NBG rate when date or currency changes
  useEffect(() => {
    if (!date || currency === 'GEL') {
      if (currency === 'GEL') setValue('nbgRate', 1);
      return;
    }
    let cancelled = false;
    setFetchingRate(true);
    fetchNBGRate(currency, date).then((rate) => {
      if (!cancelled && rate > 0) setValue('nbgRate', rate);
      setFetchingRate(false);
    });
    return () => { cancelled = true; };
  }, [date, currency, setValue]);

  // Auto-compute GEL amount + tax
  useEffect(() => {
    if (nbgRate > 0 && amountOriginal > 0) {
      const gel = amountOriginal * nbgRate;
      setValue('amountGEL', Math.round(gel * 100) / 100);
      setValue('taxAmount', Math.round(gel * taxRate * 100) / 100);
    }
  }, [amountOriginal, nbgRate, taxRate, setValue]);

  // Client combobox selection → populate clientName
  const handleClientChange = (id: string) => {
    setClientId(id);
    const c = clients.find((cl) => cl.id === id);
    if (c) {
      setValue('clientName', c.name);
      if (!currency || currency === 'USD') {
        setValue('currency', c.defaultCurrency || settings?.defaultCurrency || 'USD');
      }
    }
  };

  // Invoice link selector
  const handleInvoiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invId = e.target.value;
    if (!invId) {
      setValue('invoiceId', '');
      setValue('invoiceNumber', '');
      return;
    }
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setValue('invoiceId', inv.id);
      setValue('invoiceNumber', inv.number);
      setValue('clientName', inv.clientName);
      setValue('amountOriginal', Number(inv.total));
      setValue('currency', inv.currency);
      setValue('project', inv.project);
      if (!description)
        setValue('description', `Payment for invoice ${inv.number}`);
      // Sync combobox
      const c = clients.find((cl) => cl.name === inv.clientName);
      if (c) setClientId(c.id);
    }
  };

  // Unique descriptions from past transactions for datalist autocomplete
  const pastDescriptions = [...new Set(
    transactions
      .map((tx) => tx.description)
      .filter(Boolean)
  )];

  // Unique projects from past transactions for datalist autocomplete
  const pastProjects = [...new Set(
    transactions
      .map((tx) => tx.project)
      .filter(Boolean)
  )];

  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');

  const onSubmit = async (data: TransactionFormData) => {
    try {
      if (isEdit) {
        await updateTransaction({ data, rowIndex: rowIndex! });

        // ─── If editing and an invoice is linked, mark it paid ───
        if (data.invoiceId) {
          const inv = invoices.find((i) => i.id === data.invoiceId);
          if (inv && inv.status !== 'paid') {
            const invRowIndex = invoices.findIndex((i) => i.id === data.invoiceId) + 2;
            await changeStatus({ id: data.invoiceId, rowIndex: invRowIndex, status: 'paid' });
          }
        }
      } else {
        // ─── Auto-create linked invoice FIRST so we can link the transaction back ───
        let linkedInvId = data.invoiceId;
        let linkedInvNumber = data.invoiceNumber;

        if (createInvoice) {
          const invId = crypto.randomUUID();
          const existingNumbers = invoices.map((i) => i.number);
          const invDate = data.date; // invoice date = transaction (payment) date
          const dueDate = (() => {
            try {
              const d = new Date(invDate);
              d.setDate(d.getDate() + 10);
              return d.toISOString().split('T')[0];
            } catch {
              return invDate;
            }
          })();
          const invNumber = generateInvoiceNumber(invDate, existingNumbers, settings?.invoicePrefix);
          await saveInvoice({
            invoice: {
              id: invId,
              number: invNumber,
              clientId: clientId,
              clientName: data.clientName,
              date: invDate,
              dueDate,
              currency: data.currency,
              subtotal: data.amountOriginal,
              vatText: settings?.vatText ?? 'Zero rated',
              vatAmount: 0,
              total: data.amountOriginal,
              project: data.project,
              status: 'paid', // payment already received
              linkedTransactionId: data.id,
              notes: '',
              businessEntityId: '',
              createdAt: '',
              updatedAt: '',
            },
            items: [
              {
                id: crypto.randomUUID(),
                invoiceId: invId,
                description: data.description || 'Payment',
                quantity: 1,
                unitPrice: data.amountOriginal,
                total: data.amountOriginal,
              },
            ],
            isNew: true,
          });
          linkedInvId = invId;
          linkedInvNumber = invNumber;
        }

        // ─── Add transaction (with invoice link if applicable) ───
        await addTransaction({ ...data, invoiceId: linkedInvId, invoiceNumber: linkedInvNumber });

        // ─── If a pre-existing invoice was linked, mark it paid ───
        if (data.invoiceId && !createInvoice) {
          const inv = invoices.find((i) => i.id === data.invoiceId);
          if (inv && inv.status !== 'paid') {
            const invRowIndex = invoices.findIndex((i) => i.id === data.invoiceId) + 2;
            await changeStatus({ id: data.invoiceId, rowIndex: invRowIndex, status: 'paid' });
          }
        }
      }
      onDone();
    } catch {
      // Error toast is shown by onError in useTransactions/useInvoices — stay on form
    }
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit(onSubmit)}>
      {/* Description datalist */}
      <datalist id="tx-desc-list">
        {pastDescriptions.map((d) => <option key={d} value={d} />)}
      </datalist>

      {/* Project datalist */}
      <datalist id="tx-project-list">
        {pastProjects.map((p) => <option key={p} value={p} />)}
      </datalist>

      <h3 className="transaction-form__title">
        <Icon name="dollar-sign" size={16} />
        {isEdit ? t['transaction_edit'] ?? 'Edit transaction' : t['transaction_new']}
      </h3>

      {/* Link to invoice */}
      <div className="field">
        <label className="field__label" htmlFor="tx-invoice">{t['transaction_link_invoice']}</label>
        <select
          className="field__select"
          id="tx-invoice"
          value={watch('invoiceId')}
          onChange={handleInvoiceSelect}
        >
          <option value="">{t['transaction_no_link']}</option>
          {unpaidInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number} — {inv.clientName} ({inv.currency} {Number(inv.total).toFixed(2)})
            </option>
          ))}
          {/* If editing and there's a linked invoice that's now paid, still show it */}
          {isEdit && initial?.invoiceId &&
            !unpaidInvoices.find(i => i.id === initial.invoiceId) &&
            invoices.find(i => i.id === initial.invoiceId) && (
              <option value={initial.invoiceId}>
                {invoices.find(i => i.id === initial.invoiceId)?.number} (paid)
              </option>
            )
          }
        </select>
      </div>

      {/* Row 1a: Date + Client */}
      <div className="transaction-form__grid">
        <DatePicker
          label={t['transaction_date']}
          value={date}
          onChange={(v) => setValue('date', v)}
          error={errors.date?.message}
          locale={lang}
        />
        <ClientCombobox
          clients={clients}
          value={clientId}
          onChange={handleClientChange}
          error={errors.clientName?.message}
          isLoading={clientsLoading}
        />
      </div>

      {/* Row 1b: Description + Project */}
      <div className="transaction-form__grid transaction-form__grid--desc">
        <Input
          label={t['transaction_description']}
          error={errors.description?.message}
          list="tx-desc-list"
          autoComplete="off"
          {...register('description')}
        />
        <Input
          label={t['transaction_project']}
          list="tx-project-list"
          autoComplete="off"
          {...register('project')}
        />
      </div>

      {/* Row 2: Amounts — outer 2fr|1fr mirrors description row */}
      <div className="transaction-form__grid transaction-form__grid--desc">
        {/* Left: Amount + Currency + NBG Rate */}
        <div className="transaction-form__amounts-inner">
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
        </div>

        {/* Right: Computed panel — aligns with Project */}
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

      {/* Create invoice shortcut — only in Add mode, only without a linked invoice */}
      {!isEdit && !watch('invoiceId') && (
        <label className="create-linked">
          <input
            type="checkbox"
            className="create-linked__checkbox"
            checked={createInvoice}
            onChange={(e) => setCreateInvoice(e.target.checked)}
          />
          <Icon name="file-text" size={13} className="create-linked__icon" />
          <span>{t['transaction_create_invoice']}</span>
        </label>
      )}

      <div className="transaction-form__actions">
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? (t['save'] ?? 'Save') : t['transaction_submit']}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t['transaction_cancel']}</Button>
      </div>
    </form>
  );
}
