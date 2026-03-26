import { useState, useMemo } from 'react';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { InvoiceForm } from './InvoiceForm';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { InvoicePDFButton } from './InvoicePDFButton';
import { Button } from '@/shared/ui/Button';
import { useSettings } from '@/features/settings/hooks/useSettings';
import './InvoiceList.css';

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  draft: { label: 'Черновик', emoji: '📝' },
  sent: { label: 'Отправлен', emoji: '📤' },
  paid: { label: 'Оплачен', emoji: '✅' },
  overdue: { label: 'Просрочен', emoji: '⚠️' },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', GEL: '₾',
};

export function InvoiceList() {
  const { invoices, isLoading, deleteInvoice, getItemsForInvoice, saveInvoice } = useInvoices();
  const { settings } = useSettings();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ invoice: InvoiceFormData; items: InvoiceItem[]; rowIndex: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(
    () => statusFilter === 'all' ? invoices : invoices.filter((inv) => inv.status === statusFilter),
    [invoices, statusFilter]
  );

  const handleCopy = async (inv: InvoiceFormData) => {
    const newId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];
    const existingNumbers = invoices.map((i) => i.number);
    const { generateInvoiceNumber } = await import('@/entities/invoice/schemas');
    const number = generateInvoiceNumber(today, existingNumbers, settings?.invoicePrefix);

    const sourceItems = getItemsForInvoice(inv.id);
    const newItems = sourceItems.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      invoiceId: newId,
    }));

    await saveInvoice({
      invoice: {
        ...inv,
        id: newId,
        number,
        date: today,
        status: 'draft',
        linkedTransactionId: '',
        createdAt: '',
        updatedAt: '',
      },
      items: newItems,
      isNew: true,
    });
  };

  if (isLoading) {
    return <div className="invoices-skeleton">Загрузка инвойсов...</div>;
  }

  if (showForm) {
    return <InvoiceForm onDone={() => setShowForm(false)} />;
  }

  if (editItem) {
    return <InvoiceForm initial={editItem} onDone={() => setEditItem(null)} />;
  }

  return (
    <div className="invoice-list">
      <div className="invoice-list__header">
        <h1>📄 Инвойсы ({invoices.length})</h1>
        <Button onClick={() => setShowForm(true)}>+ Создать</Button>
      </div>

      {/* Filters */}
      <div className="invoice-list__filters">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map((s) => (
          <button
            key={s}
            className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Все' : `${STATUS_LABELS[s].emoji} ${STATUS_LABELS[s].label}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="invoice-list__empty">
          <p>{statusFilter === 'all' ? 'Инвойсов пока нет' : 'Нет инвойсов с таким статусом'}</p>
          {statusFilter === 'all' && (
            <p style={{ color: 'var(--color-text-tertiary)' }}>
              Создайте первый инвойс, чтобы начать вести учёт
            </p>
          )}
        </div>
      ) : (
        <div className="invoice-cards">
          {filtered.map((inv, i) => {
            const status = STATUS_LABELS[inv.status] ?? STATUS_LABELS.draft;
            const sym = CURRENCY_SYMBOLS[inv.currency] ?? inv.currency;
            return (
              <div key={inv.id} className={`invoice-card invoice-card--${inv.status}`}>
                <div className="invoice-card__top">
                  <span className="invoice-card__number amount">{inv.number}</span>
                  <span className={`invoice-card__status invoice-card__status--${inv.status}`}>
                    {status.emoji} {status.label}
                  </span>
                </div>

                <div className="invoice-card__client">{inv.clientName}</div>
                {inv.project && <div className="invoice-card__project">{inv.project}</div>}

                <div className="invoice-card__amount amount">
                  {sym}{Number(inv.total).toFixed(2)}
                </div>

                <div className="invoice-card__dates">
                  <span>📅 {inv.date}</span>
                  <span>⏰ {inv.dueDate}</span>
                </div>

                <div className="invoice-card__actions">
                  <Button size="sm" variant="ghost" onClick={() => {
                    const invItems = getItemsForInvoice(inv.id);
                    setEditItem({ invoice: inv, items: invItems, rowIndex: i + 2 });
                  }}>✏️</Button>
                  <InvoicePDFButton invoice={inv} items={getItemsForInvoice(inv.id)} />
                  <Button size="sm" variant="ghost" onClick={() => handleCopy(inv)}>📋</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm('Удалить инвойс?')) deleteInvoice({ id: inv.id, rowIndex: i + 2 });
                  }}>🗑️</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
