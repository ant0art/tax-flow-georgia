import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceSchema, generateInvoiceNumber } from '@/entities/invoice/schemas';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import type { ClientAccount } from '@/entities/client/schemas';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useClients } from '@/features/clients/hooks/useClients';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { fetchNBGRate } from '@/shared/api/nbg-rate';
import { CURRENCIES, currencyLabel } from '@/shared/lib/currencies';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { useUIStore } from '@/shared/hooks/useTheme';
import { Icon } from '@/shared/ui/Icon';
import { ClientCombobox } from '@/features/clients/components/ClientCombobox';
import { AccountCombobox } from '@/features/clients/components/AccountCombobox';
import { DatePicker } from '@/shared/ui/DatePicker';
import './InvoiceForm.css';
import { FieldSelect } from '@/shared/ui/FieldSelect';

interface InvoiceFormProps {
  initial?: { invoice: InvoiceFormData; items: InvoiceItem[]; rowIndex: number };
  onDone: () => void;
}

export function InvoiceForm({ initial, onDone }: InvoiceFormProps) {
  const isEdit = !!initial;
  const { invoices, items: allItems, saveInvoice, isSaving } = useInvoices();
  const { addTransaction, updateTransaction, transactions } = useTransactions();
  const { clients } = useClients();
  const { settings } = useSettings();
  const t = useT();
  const lang = useUIStore((s) => s.lang);
  const [createTransaction, setCreateTransaction] = useState(false);

  // Account selection — AccountCombobox manages filtering, we just track selected ID
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    // In edit mode: try to match existing bank details to an account
    if (initial?.invoice.clientBankName) {
      const client = clients.find((c) => c.id === initial.invoice.clientId);
      const match = (client?.accounts ?? []).find(
        (a) => a.bankName === initial.invoice.clientBankName && a.iban === initial.invoice.clientIban
      );
      return match?.id ?? null;
    }
    return null;
  });

  // Top-5 most-used projects from past invoices
  const pastProjects = useMemo(() => {
    const freq: Record<string, number> = {};
    invoices.forEach((inv) => { if (inv.project) freq[inv.project] = (freq[inv.project] ?? 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v);
  }, [invoices]);

  // Top-5 most-used descriptions from past invoice items
  const pastDescriptions = useMemo(() => {
    const freq: Record<string, number> = {};
    allItems.forEach((it) => { if (it.description) freq[it.description] = (freq[it.description] ?? 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v);
  }, [allItems]);


  const today = new Date().toISOString().split('T')[0];
  const defaultDue = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

  const invoiceId = initial?.invoice.id ?? crypto.randomUUID();
  const existingNumbers = invoices.map((inv) => inv.number);
  const defaultNumber = initial?.invoice.number ?? generateInvoiceNumber(
    today,
    existingNumbers,
    settings?.invoicePrefix
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema) as Resolver<InvoiceFormData>,
    defaultValues: initial?.invoice ?? {
      id: invoiceId,
      number: defaultNumber,
      clientId: '',
      clientName: '',
      date: today,
      dueDate: defaultDue,
      currency: settings?.defaultCurrency ?? 'USD',
      subtotal: 0,
      vatText: settings?.vatText ?? 'Zero rated',
      vatAmount: 0,
      total: 0,
      project: '',
      status: 'draft',
      linkedTransactionId: '',
      notes: '',
      businessEntityId: '',
      clientBankName: '',
      clientIban: '',
      createdAt: '',
      updatedAt: '',
    },
  });

  // ── Due date auto-calc: date + 10 days ──
  const dueDateManualRef = useRef(false);
  const watchedDate = watch('date');

  useEffect(() => {
    if (dueDateManualRef.current || !watchedDate) return;
    try {
      const d = new Date(watchedDate);
      if (isNaN(d.getTime())) return;
      d.setDate(d.getDate() + 10);
      setValue('dueDate', d.toISOString().split('T')[0]);
    } catch {
      /* invalid date — skip */
    }
  }, [watchedDate, setValue]);

  // ── Invoice items (services) ──
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items?.length
      ? initial.items
      : [{
          id: crypto.randomUUID(),
          invoiceId,
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        }]
  );

  // ── Controlled amount inputs as strings for clean UX ──
  const [itemDisplayValues, setItemDisplayValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const initItems = initial?.items?.length ? initial.items : [{ id: '', quantity: 1, unitPrice: 0 }];
    initItems.forEach((item, idx) => {
      map[`qty-${idx}`] = String(item.quantity);
      map[`price-${idx}`] = item.unitPrice === 0 ? '' : String(item.unitPrice);
    });
    return map;
  });

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = Number(item.quantity) * Number(item.unitPrice);
      }
      next[index] = item;
      const subtotal = next.reduce((sum, it) => sum + it.total, 0);
      setValue('subtotal', subtotal);
      setValue('total', subtotal);
      return next;
    });
  };

  const handleAmountChange = (
    index: number,
    field: 'quantity' | 'unitPrice',
    raw: string
  ) => {
    const displayKey = field === 'quantity' ? `qty-${index}` : `price-${index}`;
    // Allow free text entry (digits, dots, commas)
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
    setItemDisplayValues((prev) => ({ ...prev, [displayKey]: cleaned }));

    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      updateItem(index, field, num);
    }
  };

  const handleAmountBlur = (index: number, field: 'quantity' | 'unitPrice') => {
    const displayKey = field === 'quantity' ? `qty-${index}` : `price-${index}`;
    setItemDisplayValues((prev) => {
      const raw = prev[displayKey] ?? '0';
      const num = parseFloat(raw);
      const formatted = isNaN(num) ? '0' : String(num);
      return { ...prev, [displayKey]: formatted };
    });
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const addItem = () => {
    const idx = items.length;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), invoiceId, description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
    setItemDisplayValues((prev) => ({
      ...prev,
      [`qty-${idx}`]: '1',
      [`price-${idx}`]: '',
    }));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const subtotal = next.reduce((sum, it) => sum + it.total, 0);
      setValue('subtotal', subtotal);
      setValue('total', subtotal);
      return next;
    });
    // Rebuild display values for remaining items
    setItemDisplayValues((prev) => {
      const next: Record<string, string> = {};
      items.forEach((item, i) => {
        if (i === index) return;
        const newIdx = i > index ? i - 1 : i;
        next[`qty-${newIdx}`] = prev[`qty-${i}`] ?? String(item.quantity);
        next[`price-${newIdx}`] = prev[`price-${i}`] ?? String(item.unitPrice);
      });
      return next;
    });
  };

  // ── Client selection via combobox ──
  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setValue('clientId', clientId);
    setValue('clientName', client?.name ?? '');
    if (client?.defaultProject) setValue('project', client.defaultProject);
    // Reset account — AccountCombobox will auto-select if only 1 match
    setSelectedAccountId(null);
    setValue('clientBankName', '');
    setValue('clientIban', '');
  };

  // AccountCombobox callback
  const handleAccountSelect = (acc: ClientAccount) => {
    setSelectedAccountId(acc.id);
    setValue('clientBankName', acc.bankName);
    setValue('clientIban', acc.iban);
  };

  const watchedCurrency = watch('currency');
  const watchedClientId = watch('clientId');

  // Auto-select when currency changes and exactly 1 account matches
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip on initial render in edit mode — data is already set from defaultValues
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!watchedClientId) return;
    const client = clients.find((c) => c.id === watchedClientId);
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
  }, [watchedCurrency, watchedClientId]);


  const onSubmit = async (data: InvoiceFormData) => {
    // If creating invoice AND immediately creating a transaction, mark invoice as paid
    const invoiceStatus = (!isEdit && createTransaction) ? 'paid' : data.status;
    await saveInvoice({
      invoice: { ...data, status: invoiceStatus },
      items,
      isNew: !isEdit,
      invoiceRowIndex: initial?.rowIndex,
    });

    // ─── Auto-create linked transaction if checkbox is set ───
    if (!isEdit && createTransaction) {
      const today = data.date;
      let nbgRate = 1;
      if (data.currency !== 'GEL') {
        nbgRate = (await fetchNBGRate(data.currency, today)) || 1;
      }
      const amountGEL = Math.round(data.total * nbgRate * 100) / 100;
      const taxRate = settings?.taxRate ?? 0.01;
      await addTransaction({
        id: crypto.randomUUID(),
        date: today,
        invoiceId: data.id,
        invoiceNumber: data.number,
        clientName: data.clientName,
        description: `Payment for invoice ${data.number}`,
        amountOriginal: data.total,
        currency: data.currency,
        nbgRate,
        amountGEL,
        taxRate,
        taxAmount: Math.round(amountGEL * taxRate * 100) / 100,
        project: data.project,
        clientBankName: data.clientBankName ?? '',
        clientIban: data.clientIban ?? '',
        createdAt: '',
        updatedAt: '',
      });
    }

    // ─── Bidirectional sync: update linked transaction on edit ───
    if (isEdit && data.linkedTransactionId) {
      const txIdx = transactions.findIndex((tx) => tx.id === data.linkedTransactionId);
      if (txIdx >= 0) {
        const tx = transactions[txIdx];
        const needsUpdate =
          tx.clientBankName !== (data.clientBankName ?? '') ||
          tx.clientIban !== (data.clientIban ?? '') ||
          tx.currency !== data.currency ||
          tx.amountOriginal !== data.total;
        if (needsUpdate) {
          let nbgRate = tx.nbgRate;
          let amountGEL = tx.amountGEL;
          let taxAmount = tx.taxAmount;
          // Recalc if currency or amount changed
          if (tx.currency !== data.currency || tx.amountOriginal !== data.total) {
            nbgRate = data.currency === 'GEL' ? 1 : ((await fetchNBGRate(data.currency, tx.date)) || 1);
            amountGEL = Math.round(data.total * nbgRate * 100) / 100;
            taxAmount = Math.round(amountGEL * tx.taxRate * 100) / 100;
          }
          await updateTransaction({
            data: {
              ...tx,
              clientBankName: data.clientBankName ?? '',
              clientIban: data.clientIban ?? '',
              currency: data.currency,
              amountOriginal: data.total,
              nbgRate,
              amountGEL,
              taxAmount,
            },
            rowIndex: txIdx + 2, // 1-indexed, skip header
          });
        }
      }
    }

    onDone();
  };

  const subtotal = watch('subtotal');
  const total = watch('total');
  const currency = watch('currency');

  // ── Business entities (ИП profiles) ──
  const businessEntities = settings?.businessEntities ?? [];
  const showEntitySelector = businessEntities.length > 0;

  return (
    <form className="invoice-form" onSubmit={handleSubmit(onSubmit)}>
      {/* Suggestion datalists */}
      <datalist id="inv-project-list">
        {pastProjects.map((p) => <option key={p} value={p} />)}
      </datalist>
      <datalist id="inv-desc-list">
        {pastDescriptions.map((d) => <option key={d} value={d} />)}
      </datalist>

      {/* ── Section 1: Invoice details ── */}
      <section className="invoice-form__section">
        <h2 className="invoice-form__section-title">
          <Icon name={isEdit ? 'edit' : 'file-text'} size={13} />
          {isEdit ? t['invoice_edit'] : t['invoice_new']}
        </h2>

        {/* Row 1: Number · Date · Due date · Currency */}
        <div className="invoice-form__field-group">
          <div className="invoice-form__meta">
            <Input
              label={t['invoice_number']}
              error={errors.number?.message}
              mono
              {...register('number')}
            />
            <DatePicker
              label={t['invoice_date']}
              value={watch('date')}
              onChange={(v: string) => setValue('date', v)}
              error={errors.date?.message}
              locale={lang}
            />
            <DatePicker
              label={t['invoice_due_date']}
              value={watch('dueDate')}
              onChange={(v: string) => {
                dueDateManualRef.current = true;
                setValue('dueDate', v);
              }}
              error={errors.dueDate?.message}
              locale={lang}
            />
            <FieldSelect
              label={t['invoice_currency']}
              id="inv-currency"
              options={CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c) }))}
              value={watch('currency')}
              onChange={(val) => setValue('currency', val)}
            />
          </div>
        </div>

        {/* Row 2: Client · Account · Project · Entity */}
        <div className="invoice-form__field-group invoice-form__field-group--divider">
          <div className="invoice-form__client">
            <ClientCombobox
              clients={clients}
              value={watch('clientId')}
              onChange={handleClientSelect}
              error={errors.clientName?.message}
            />

            {/* ── Client account picker (AccountCombobox) ── */}
            <AccountCombobox
              clients={clients}
              clientId={watch('clientId')}
              currency={watch('currency')}
              selectedAccountId={selectedAccountId}
              onChange={handleAccountSelect}
            />

            <Input
              label={t['invoice_project']}
              list="inv-project-list"
              autoComplete="off"
              {...register('project')}
            />
            {showEntitySelector && (
              <div className="field">
                <label className="field__label" htmlFor="inv-entity">
                  {t['invoice_entity'] ?? 'Business Entity'}
                </label>
                <select
                  className="field__select"
                  id="inv-entity"
                  {...register('businessEntityId')}
                >
                  <option value="">{t['invoice_entity_default'] ?? '— Default (Settings) —'}</option>
                  {businessEntities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.label || ent.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Section 2: Services ── */}
      <section className="invoice-form__section">
        <h2 className="invoice-form__section-title">
          <Icon name="file-text" size={13} />
          {t['invoice_services']}
        </h2>

        <div className="items-table">
          <div className="items-table__head">
            <span>{t['invoice_desc']}</span>
            <span>{t['invoice_qty']}</span>
            <span>{t['invoice_price']}</span>
            <span>{t['invoice_total']}</span>
            <span></span>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} className="items-table__row">
              <textarea
                className="items-table__desc"
                placeholder={t['invoice_desc']}
                autoComplete="off"
                rows={1}
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                onKeyDown={(e) => {
                  // Prevent form submit on Enter; Shift+Enter also just inserts newline
                  if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
                }}
              />
              <div className="qty-stepper">
                <input
                  className="qty-stepper__input"
                  inputMode="decimal"
                  placeholder="1"
                  value={itemDisplayValues[`qty-${idx}`] ?? String(item.quantity)}
                  onChange={(e) => handleAmountChange(idx, 'quantity', e.target.value)}
                  onBlur={() => handleAmountBlur(idx, 'quantity')}
                  onFocus={handleAmountFocus}
                />
                <div className="qty-stepper__side">
                  <button
                    type="button"
                    className="qty-stepper__btn"
                    tabIndex={-1}
                    aria-label="Increase quantity"
                    onClick={() => {
                      const cur = parseFloat(itemDisplayValues[`qty-${idx}`] ?? '1') || 0;
                      const next = String(cur + 1);
                      setItemDisplayValues((prev) => ({ ...prev, [`qty-${idx}`]: next }));
                      updateItem(idx, 'quantity', cur + 1);
                    }}
                  >
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden="true">
                      <path d="M4 0.5L7.5 5.5H0.5L4 0.5Z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="qty-stepper__btn"
                    tabIndex={-1}
                    aria-label="Decrease quantity"
                    onClick={() => {
                      const cur = parseFloat(itemDisplayValues[`qty-${idx}`] ?? '1') || 0;
                      const next = String(Math.max(0, cur - 1));
                      setItemDisplayValues((prev) => ({ ...prev, [`qty-${idx}`]: next }));
                      updateItem(idx, 'quantity', Math.max(0, cur - 1));
                    }}
                  >
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden="true">
                      <path d="M4 5.5L0.5 0.5H7.5L4 5.5Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>
              <input
                className="field__input amount"
                inputMode="decimal"
                placeholder="0.00"
                value={itemDisplayValues[`price-${idx}`] ?? (item.unitPrice === 0 ? '' : String(item.unitPrice))}
                onChange={(e) => handleAmountChange(idx, 'unitPrice', e.target.value)}
                onBlur={() => handleAmountBlur(idx, 'unitPrice')}
                onFocus={handleAmountFocus}
              />
              <span className="items-table__total amount">
                {item.total.toFixed(2)}
              </span>
              <button
                type="button"
                className="items-table__remove"
                onClick={() => removeItem(idx)}
                disabled={items.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>
          {t['invoice_add_row']}
        </Button>

        {/* Totals + Notes side by side on desktop */}
        <div className="invoice-form__bottom">
          <div className="invoice-form__notes">
            <Input label={t['invoice_notes']} {...register('notes')} />
          </div>

          <div className="invoice-form__totals">
            <div className="invoice-form__total-row">
              <span>{t['invoice_subtotal']}</span>
              <span className="amount">{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="invoice-form__total-row invoice-form__total-row--editable">
              <div className="invoice-form__vat-label">
                <span>VAT:</span>
                <input
                  className="field__input field__input--inline"
                  placeholder={t['invoice_vat_hint'] ?? 'Zero rated'}
                  {...register('vatText')}
                />
              </div>
              <input
                className="field__input field__input--inline amount"
                inputMode="decimal"
                value={watch('vatAmount') === 0 ? '0.00' : String(watch('vatAmount'))}
                onChange={(e) => {
                  const v = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
                  const amt = isNaN(v) ? 0 : v;
                  setValue('vatAmount', amt);
                  setValue('total', subtotal + amt);
                }}
              />
            </div>
            <div className="invoice-form__total-row invoice-form__total-row--grand">
              <strong>{t['invoice_grand_total']}</strong>
              <strong className="amount">{currency} {total.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Create transaction shortcut — only in Add mode */}
      {!isEdit && (
        <label className="create-linked">
          <input
            type="checkbox"
            className="create-linked__checkbox"
            checked={createTransaction}
            onChange={(e) => setCreateTransaction(e.target.checked)}
          />
          <Icon name="dollar-sign" size={13} className="create-linked__icon" />
          <span>{t['invoice_create_transaction']}</span>
        </label>
      )}

      <div className="invoice-form__actions">
        <Button type="submit" loading={isSaving}>
          {isEdit ? t['invoice_save'] : t['invoice_submit']}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t['invoice_cancel']}
        </Button>
      </div>
    </form>
  );
}
