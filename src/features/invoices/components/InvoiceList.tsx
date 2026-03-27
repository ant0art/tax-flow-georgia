import { useState, useMemo, useRef, useEffect } from 'react';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { InvoiceForm } from './InvoiceForm';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { InvoicePDFButton } from './InvoicePDFButton';
import { Button } from '@/shared/ui/Button';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { CURRENCY_SYMBOL } from '@/shared/lib/currencies';
import './InvoiceList.css';

const STATUS_ICONS: Record<string, { labelKey: string; icon: React.ReactNode }> = {
  draft:   { labelKey: 'status_draft',   icon: <Icon name="file-draft" size={13} /> },
  sent:    { labelKey: 'status_sent',    icon: <Icon name="send" size={13} /> },
  paid:    { labelKey: 'status_paid',    icon: <Icon name="check-circle" size={13} /> },
  overdue: { labelKey: 'status_overdue', icon: <Icon name="alert-triangle" size={13} /> },
};

const STATUS_OPTIONS = [
  { value: 'draft',   labelKey: 'status_draft' },
  { value: 'sent',    labelKey: 'status_sent' },
  { value: 'paid',    labelKey: 'status_paid' },
  { value: 'overdue', labelKey: 'status_overdue' },
];

// ── Custom status picker ──
interface StatusPickerProps {
  status: string;
  disabled?: boolean;
  onChange: (status: string) => void;
}

function StatusPicker({ status, disabled, onChange }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const info = STATUS_ICONS[status] ?? STATUS_ICONS.draft;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (val: string) => {
    if (val !== status) onChange(val);
    setOpen(false);
  };

  return (
    <div className="status-picker" ref={ref}>
      <button
        type="button"
        className={`status-badge status-badge--${status} ${disabled ? 'status-badge--disabled' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {info.icon}
        <span>{t[info.labelKey]}</span>
        <Icon name="chevron-down" size={11} className={`status-badge__chevron ${open ? 'status-badge__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="status-picker__dropdown" role="listbox">
          {STATUS_OPTIONS.map((opt) => {
            const optInfo = STATUS_ICONS[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === status}
                className={`status-picker__option status-picker__option--${opt.value} ${opt.value === status ? 'status-picker__option--active' : ''}`}
                onClick={() => select(opt.value)}
              >
                {optInfo.icon}
                <span>{t[opt.labelKey]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InvoiceList() {
  const { invoices, isLoading, deleteInvoice, getItemsForInvoice, saveInvoice, changeStatus } = useInvoices();
  const { settings } = useSettings();
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ invoice: InvoiceFormData; items: InvoiceItem[]; rowIndex: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

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

  const handleStatusChange = async (inv: InvoiceFormData, rowIndex: number, newStatus: string) => {
    setChangingStatusId(inv.id);
    try {
      await changeStatus({ id: inv.id, rowIndex, status: newStatus });
    } finally {
      setChangingStatusId(null);
    }
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
          {t['invoices_title']}
          <span className="page-title__count">{invoices.length}</span>
        </h1>
        <Button size="sm" onClick={() => setShowForm(true)} title={t['invoice_new']}>{t['invoice_create']}</Button>
      </div>

      {/* Status filter chips */}
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
          <Icon name="file-text" size={32} className="empty-icon" />
          <p>{statusFilter === 'all' ? t['invoice_empty'] : t['invoice_empty_filter']}</p>
          {statusFilter === 'all' && (
            <p className="empty-hint">{t['invoice_empty_hint']}</p>
          )}
        </div>
      ) : (
        <div className="invoice-cards">
          {filtered.map((inv, i) => {
            const sym = CURRENCY_SYMBOL[inv.currency] ?? inv.currency;
            const rowIndex = invoices.findIndex((x) => x.id === inv.id) + 2;
            const isChanging = changingStatusId === inv.id;
            return (
              <div key={inv.id} className={`invoice-card invoice-card--${inv.status}`}>
                <div className="invoice-card__top">
                  <span className="invoice-card__number amount">{inv.number}</span>
                  <StatusPicker
                    status={inv.status}
                    disabled={isChanging}
                    onChange={(newStatus) => handleStatusChange(inv, rowIndex, newStatus)}
                  />
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

                <div className="card-actions">
                  <Button size="sm" variant="ghost" className="action-btn--edit" title={t['invoice_edit']} onClick={() => {
                    const invItems = getItemsForInvoice(inv.id);
                    setEditItem({ invoice: inv, items: invItems, rowIndex: i + 2 });
                  }}>
                    <Icon name="edit" size={13} />
                  </Button>
                  <InvoicePDFButton invoice={inv} items={getItemsForInvoice(inv.id)} />
                  <Button size="sm" variant="ghost" title={t['copy'] ?? 'Copy'} onClick={() => handleCopy(inv)}>
                    <Icon name="copy" size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" className="action-btn--delete" title={t['trash'] ?? 'Delete'} onClick={() => {
                    if (confirm(t['invoice_delete_confirm'])) deleteInvoice({ id: inv.id, rowIndex: i + 2 });
                  }}>
                    <Icon name="trash" size={13} />
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
