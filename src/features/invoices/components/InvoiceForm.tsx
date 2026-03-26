import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceSchema, generateInvoiceNumber } from '@/entities/invoice/schemas';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useClients } from '@/features/clients/hooks/useClients';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { ClientCombobox } from '@/features/clients/components/ClientCombobox';
import { DatePicker } from '@/shared/ui/DatePicker';
import './InvoiceForm.css';

interface InvoiceFormProps {
  initial?: { invoice: InvoiceFormData; items: InvoiceItem[]; rowIndex: number };
  onDone: () => void;
}

export function InvoiceForm({ initial, onDone }: InvoiceFormProps) {
  const isEdit = !!initial;
  const { invoices, saveInvoice, isSaving } = useInvoices();
  const { clients } = useClients();
  const { settings } = useSettings();
  const t = useT();

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
    resolver: zodResolver(invoiceSchema),
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
    if (client?.defaultCurrency) setValue('currency', client.defaultCurrency);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    await saveInvoice({
      invoice: data,
      items,
      isNew: !isEdit,
      invoiceRowIndex: initial?.rowIndex,
    });
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
      <div className="invoice-form__header">
        <h2 className="section-title">
          <Icon name={isEdit ? 'edit' : 'file-text'} size={18} />
          {isEdit ? t['invoice_edit'] : t['invoice_new']}
        </h2>
      </div>

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
        />
        <DatePicker
          label={t['invoice_due_date']}
          value={watch('dueDate')}
          onChange={(v: string) => {
            dueDateManualRef.current = true;
            setValue('dueDate', v);
          }}
          error={errors.dueDate?.message}
        />
      </div>

      <div className="invoice-form__client">
        <ClientCombobox
          clients={clients}
          value={watch('clientId')}
          onChange={handleClientSelect}
          error={errors.clientName?.message}
        />

        <div className="field">
          <label className="field__label" htmlFor="inv-currency">{t['invoice_currency']}</label>
          <select className="field__select" id="inv-currency" {...register('currency')}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="GEL">GEL (₾)</option>
          </select>
        </div>

        <Input label={t['invoice_project']} {...register('project')} />
      </div>

      {/* ── Business Entity selector ── */}
      {showEntitySelector && (
        <div className="invoice-form__entity">
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
        </div>
      )}

      <section className="invoice-form__items">
        <h3>{t['invoice_services']}</h3>
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
              <input
                className="field__input"
                placeholder={t['invoice_desc']}
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <input
                className="field__input amount"
                inputMode="decimal"
                placeholder="1"
                value={itemDisplayValues[`qty-${idx}`] ?? String(item.quantity)}
                onChange={(e) => handleAmountChange(idx, 'quantity', e.target.value)}
                onBlur={() => handleAmountBlur(idx, 'quantity')}
                onFocus={handleAmountFocus}
              />
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
      </section>

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

      <Input label={t['invoice_notes']} {...register('notes')} />

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
