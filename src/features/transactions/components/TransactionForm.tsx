import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema, type TransactionFormData } from '@/entities/transaction/schemas';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { generateInvoiceNumber } from '@/entities/invoice/schemas';
import { useClients } from '@/features/clients/hooks/useClients';
import type { ClientAccount } from '@/entities/client/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { fetchNBGRate } from '@/shared/api/nbg-rate';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/ui/DatePicker';
import { ClientCombobox } from '@/features/clients/components/ClientCombobox';
import { AccountCombobox } from '@/features/clients/components/AccountCombobox';
import { useT } from '@/shared/i18n/useT';
import { useUIStore } from '@/shared/hooks/useTheme';
import { Icon } from '@/shared/ui/Icon';
import { FieldSelect } from '@/shared/ui/FieldSelect';
import type { SelectOption } from '@/shared/ui/FieldSelect';
import { FieldStepper } from '@/shared/ui/FieldStepper';
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
  const [clientId, setClientId] = useState(initial
    ? clients.find((c) => c.name === initial.clientName)?.id ?? ''
    : '');
  const [createInvoice, setCreateInvoice] = useState(false);

  // Account selection — AccountCombobox manages filtering
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    // In edit mode: match by bankName+iban
    if (initial?.clientBankName) {
      const client = clients.find((c) => c.name === initial.clientName);
      const match = (client?.accounts ?? []).find(
        (a) => a.bankName === initial.clientBankName && a.iban === initial.clientIban
      );
      return match?.id ?? null;
    }
    return null;
  });

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
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormData>,
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
      clientBankName: '',
      clientIban: '',
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Client combobox selection → populate clientName, reset account
  const handleClientChange = (id: string) => {
    setClientId(id);
    const c = clients.find((cl) => cl.id === id);
    if (c) {
      setValue('clientName', c.name);
      // Reset account — AccountCombobox auto-selects if 1 match
      setSelectedAccountId(null);
      setValue('clientBankName', '');
      setValue('clientIban', '');
    }
  };

  // AccountCombobox callback
  const handleAccountSelect = (acc: ClientAccount) => {
    setSelectedAccountId(acc.id);
    setValue('clientBankName', acc.bankName);
    setValue('clientIban', acc.iban);
  };

  // Auto-select account when currency changes
  const watchedCurrency = watch('currency');
  useEffect(() => {
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const matching = (client.accounts ?? []).filter((a) => a.currency === watchedCurrency);
    if (matching.length === 1) {
      setSelectedAccountId(matching[0].id);
      setValue('clientBankName', matching[0].bankName);
      setValue('clientIban', matching[0].iban);
    } else {
      setSelectedAccountId(null);
      setValue('clientBankName', '');
      setValue('clientIban', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCurrency, clientId]);

  // Invoice link selector — pulls bank details + amount + currency from invoice
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
      // Pull bank details from invoice snapshot
      setValue('clientBankName', inv.clientBankName ?? '');
      setValue('clientIban', inv.clientIban ?? '');
      if (!description)
        setValue('description', `Payment for invoice ${inv.number}`);
      // Sync client combobox + find account by bank details
      const c = clients.find((cl) => cl.name === inv.clientName);
      if (c) {
        setClientId(c.id);
        const matchAcc = (c.accounts ?? []).find(
          (a) => a.bankName === (inv.clientBankName ?? '') && a.iban === (inv.clientIban ?? '')
        );
        setSelectedAccountId(matchAcc?.id ?? null);
      }
    }
  };

  // Top-5 most-used descriptions from past transactions
  const pastDescriptions = useMemo(() => {
    const freq: Record<string, number> = {};
    transactions.forEach((tx) => { if (tx.description) freq[tx.description] = (freq[tx.description] ?? 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v);
  }, [transactions]);

  // Top-5 most-used projects from past transactions
  const pastProjects = useMemo(() => {
    const freq: Record<string, number> = {};
    transactions.forEach((tx) => { if (tx.project) freq[tx.project] = (freq[tx.project] ?? 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v);
  }, [transactions]);

  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');

  // Build invoice link options for FieldSelect
  const invoiceLinkOptions: SelectOption[] = [
    { value: '', label: t['transaction_no_link'] },
    ...unpaidInvoices.map((inv) => ({
      value: inv.id,
      label: `${inv.number} — ${inv.clientName} (${inv.currency} ${Number(inv.total).toFixed(2)})`,
    })),
    // In edit mode: if the linked invoice is already paid, still show it
    ...(isEdit && initial?.invoiceId && !unpaidInvoices.find((i) => i.id === initial.invoiceId)
      ? (invoices.find((i) => i.id === initial.invoiceId)
          ? [{ value: initial.invoiceId, label: `${invoices.find((i) => i.id === initial.invoiceId)?.number} (paid)` }]
          : [])
      : []),
  ];

  const onSubmit = async (data: TransactionFormData) => {
    try {
      if (isEdit) {
        await updateTransaction({ data, rowIndex: rowIndex! });

        // ─── Bidirectional sync: update linked invoice on edit ───
        if (data.invoiceId) {
          const invIdx = invoices.findIndex((i) => i.id === data.invoiceId);
          if (invIdx >= 0) {
            const inv = invoices[invIdx];
            const needsSync =
              inv.clientBankName !== (data.clientBankName ?? '') ||
              inv.clientIban !== (data.clientIban ?? '') ||
              inv.currency !== data.currency ||
              inv.total !== data.amountOriginal;
            if (needsSync) {
              await saveInvoice({
                invoice: {
                  ...inv,
                  clientBankName: data.clientBankName ?? '',
                  clientIban: data.clientIban ?? '',
                  currency: data.currency,
                  // If amount changed, update subtotal+total (simple 1-item case)
                  subtotal: data.amountOriginal,
                  total: data.amountOriginal,
                },
                items: [], // keep existing items — saveInvoice skips item re-write on update if items empty
                isNew: false,
                invoiceRowIndex: invIdx + 2,
              });
            }
            // Mark paid if applicable
            if (inv.status !== 'paid') {
              await changeStatus({ id: data.invoiceId, rowIndex: invIdx + 2, status: 'paid' });
            }
          }
        }
      } else {
        // ─── Auto-create linked invoice FIRST so we can link the transaction back ───
        let linkedInvId = data.invoiceId;
        let linkedInvNumber = data.invoiceNumber;

        if (createInvoice) {
          const invId = crypto.randomUUID();
          const existingNumbers = invoices.map((i) => i.number);
          const invDate = data.date;
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
              status: 'paid',
              linkedTransactionId: data.id,
              notes: '',
              businessEntityId: '',
              clientBankName: data.clientBankName ?? '',
              clientIban: data.clientIban ?? '',
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
      <hr className="transaction-form__divider" />

      {/* Link to invoice */}
      <div className="field">
        <FieldSelect
          label={t['transaction_link_invoice']}
          id="tx-invoice"
          options={invoiceLinkOptions}
          value={watch('invoiceId')}
          onChange={(val) => {
            // Reuse existing handler logic via synthetic select event
            handleInvoiceSelect({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>);
          }}
        />
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

      {/* Account picker — AccountCombobox */}
      <AccountCombobox
        clients={clients}
        clientId={clientId}
        currency={watch('currency')}
        selectedAccountId={selectedAccountId}
        onChange={handleAccountSelect}
      />

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
      <div className="transaction-form__grid transaction-form__grid--desc transaction-form__grid--amounts">
        {/* Left: Amount + Currency + NBG Rate */}
        <div className="transaction-form__amounts-inner">
          <FieldStepper
            label={t['transaction_amount']}
            step={0.01}
            mono
            error={errors.amountOriginal?.message}
            value={amountOriginal}
            onChange={(e) => setValue('amountOriginal', parseFloat(e.target.value) || 0, { shouldValidate: true })}
          />
          <FieldSelect
            label={t['transaction_currency']}
            id="tx-currency"
            options={CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c) }))}
            value={currency}
            onChange={(val) => setValue('currency', val)}
          />
          <div className="field-with-indicator">
            <FieldStepper
              label={t['transaction_nbg_rate']}
              step={0.0001}
              mono
              hint={fetchingRate ? undefined : t['transaction_nbg_auto']}
              error={errors.nbgRate?.message}
              value={nbgRate}
              onChange={(e) => setValue('nbgRate', parseFloat(e.target.value) || 0, { shouldValidate: true })}
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
