import { useState, useMemo } from 'react';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { InvoiceForm } from './InvoiceForm';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { InvoicePDFButton } from './InvoicePDFButton';
import { Button } from '@/shared/ui/Button';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './InvoiceList.css';

const STATUS_ICONS: Record<string, { labelKey: string; icon: React.ReactNode }> = {
  draft: { labelKey: 'status_draft', icon: <Icon name="file-draft" size={13} /> },
  sent: { labelKey: 'status_sent', icon: <Icon name="send" size={13} /> },
  paid: { labelKey: 'status_paid', icon: <Icon name="check-circle" size={13} /> },
  overdue: { labelKey: 'status_overdue', icon: <Icon name="alert-triangle" size={13} /> },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', GEL: '₾',
};

export function InvoiceList() {
  const { invoices, isLoading, deleteInvoice, getItemsForInvoice, saveInvoice } = useInvoices();
  const { settings } = useSettings();
  const t = useT();
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
    return <div className="invoices-skeleton">{t['loading_invoices']}</div>;
  }

  if (showForm) {
    return <InvoiceForm onDone={() => setShowForm(false)} />;
  }

  if (editItem) {
    return <InvoiceForm initial={editItem} onDone={() => setEditItem(null)} />;
  }

  const filterKeys: string[] = ['all', 'draft', 'sent', 'paid', 'overdue'];

  return (
    <div className="invoice-list">
      <div className="invoice-list__header">
        <h1 className="page-title">
          <Icon name="file-text" size={22} />
          {t['invoices_title']} ({invoices.length})
        </h1>
        <Button onClick={() => setShowForm(true)} title={t['invoice_new']}>{t['invoice_create']}</Button>
      </div>

      {/* Filters */}
      <div className="invoice-list__filters">
        {filterKeys.map((s) => (
          <button
            key={s}
            className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all'
              ? t['invoice_filter_all']
              : <>{STATUS_ICONS[s].icon} {t[STATUS_ICONS[s].labelKey]}</>
            }
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="invoice-list__empty">
          <p>{statusFilter === 'all' ? t['invoice_empty'] : t['invoice_empty_filter']}</p>
          {statusFilter === 'all' && (
            <p style={{ color: 'var(--color-text-tertiary)' }}>
              {t['invoice_empty_hint']}
            </p>
          )}
        </div>
      ) : (
        <div className="invoice-cards">
          {filtered.map((inv, i) => {
            const statusInfo = STATUS_ICONS[inv.status] ?? STATUS_ICONS.draft;
            const sym = CURRENCY_SYMBOLS[inv.currency] ?? inv.currency;
            return (
              <div key={inv.id} className={`invoice-card invoice-card--${inv.status}`}>
                <div className="invoice-card__top">
                  <span className="invoice-card__number amount">{inv.number}</span>
                  <span className={`invoice-card__status invoice-card__status--${inv.status}`}>
                    {statusInfo.icon} {t[statusInfo.labelKey]}
                  </span>
                </div>

                <div className="invoice-card__client">{inv.clientName}</div>
                {inv.project && <div className="invoice-card__project">{inv.project}</div>}

                <div className="invoice-card__amount amount">
                  {sym}{Number(inv.total).toFixed(2)}
                </div>

                <div className="invoice-card__dates">
                  <span><Icon name="calendar" size={13} /> {inv.date}</span>
                  <span><Icon name="clock" size={13} /> {inv.dueDate}</span>
                </div>

                <div className="invoice-card__actions">
                  <Button size="sm" variant="ghost" title={t['invoice_edit']} onClick={() => {
                    const invItems = getItemsForInvoice(inv.id);
                    setEditItem({ invoice: inv, items: invItems, rowIndex: i + 2 });
                  }}>
                    <Icon name="edit" size={15} />
                  </Button>
                  <InvoicePDFButton invoice={inv} items={getItemsForInvoice(inv.id)} />
                  <Button size="sm" variant="ghost" title={t['copy'] ?? 'Copy'} onClick={() => handleCopy(inv)}>
                    <Icon name="copy" size={15} />
                  </Button>
                  <Button size="sm" variant="ghost" title={t['trash'] ?? 'Delete'} onClick={() => {
                    if (confirm(t['invoice_delete_confirm'])) deleteInvoice({ id: inv.id, rowIndex: i + 2 });
                  }}>
                    <Icon name="trash" size={15} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
