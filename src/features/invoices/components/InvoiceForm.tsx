import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceSchema, generateInvoiceNumber } from '@/entities/invoice/schemas';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useClients } from '@/features/clients/hooks/useClients';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
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
      createdAt: '',
      updatedAt: '',
    },
  });

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

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = Number(item.quantity) * Number(item.unitPrice);
      }
      next[index] = item;

      // Recalculate invoice totals
      const subtotal = next.reduce((sum, it) => sum + it.total, 0);
      setValue('subtotal', subtotal);
      setValue('total', subtotal); // VAT = 0 for now
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), invoiceId, description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
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
  };

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value;
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

  return (
    <form className="invoice-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="invoice-form__header">
        <h2>{isEdit ? '✏️ Редактировать инвойс' : '📄 Новый инвойс'}</h2>
      </div>

      <div className="invoice-form__meta">
        <Input
          label="Номер"
          error={errors.number?.message}
          mono
          {...register('number')}
        />
        <Input
          label="Дата"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />
        <Input
          label="Срок оплаты"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate')}
        />
      </div>

      <div className="invoice-form__client">
        <div className="field">
          <label className="field__label" htmlFor="inv-client">Клиент</label>
          <select
            className="field__select"
            id="inv-client"
            value={watch('clientId')}
            onChange={handleClientChange}
          >
            <option value="">— Выберите клиента —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.clientName && (
            <span className="field__error">{errors.clientName.message}</span>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="inv-currency">Валюта</label>
          <select className="field__select" id="inv-currency" {...register('currency')}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="GEL">GEL (₾)</option>
          </select>
        </div>

        <Input label="Проект" {...register('project')} />
      </div>

      {/* Line items */}
      <section className="invoice-form__items">
        <h3>Услуги</h3>
        <div className="items-table">
          <div className="items-table__head">
            <span>Описание</span>
            <span>Кол-во</span>
            <span>Цена</span>
            <span>Итого</span>
            <span></span>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} className="items-table__row">
              <input
                className="field__input"
                placeholder="Описание услуги..."
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <input
                className="field__input amount"
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
              />
              <input
                className="field__input amount"
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
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
          + Добавить строку
        </Button>
      </section>

      {/* Totals */}
      <div className="invoice-form__totals">
        <div className="invoice-form__total-row">
          <span>Subtotal</span>
          <span className="amount">{currency} {subtotal.toFixed(2)}</span>
        </div>
        <div className="invoice-form__total-row">
          <span>{watch('vatText')}</span>
          <span className="amount">{currency} 0.00</span>
        </div>
        <div className="invoice-form__total-row invoice-form__total-row--grand">
          <strong>Итого</strong>
          <strong className="amount">{currency} {total.toFixed(2)}</strong>
        </div>
      </div>

      <Input label="Примечания" {...register('notes')} />

      <div className="invoice-form__actions">
        <Button type="submit" loading={isSaving}>
          {isEdit ? 'Сохранить' : 'Создать инвойс'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
