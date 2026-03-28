import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { InvoiceForm } from './InvoiceForm';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { InvoicePDFButton } from './InvoicePDFButton';
import { Button } from '@/shared/ui/Button';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useT } from '@/shared/i18n/useT';
import { useUIStore } from '@/shared/hooks/useTheme';
import { Icon } from '@/shared/ui/Icon';
import { CURRENCY_SYMBOL } from '@/shared/lib/currencies';
import { ClientCombobox } from '@/shared/ui/ClientCombobox';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import { FilterStepper } from '@/shared/ui/FilterStepper';
import { DatePicker } from '@/shared/ui/DatePicker';
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

const SORT_KEYS = [
  { value: 'date_desc',   key: 'sort_date_desc' },
  { value: 'date_asc',    key: 'sort_date_asc' },
  { value: 'amount_desc', key: 'sort_amount_desc' },
  { value: 'amount_asc',  key: 'sort_amount_asc' },
  { value: 'client_asc',  key: 'sort_client_asc' },
  { value: 'client_desc', key: 'sort_client_desc' },
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
  const lang = useUIStore((s) => s.lang);
  const sortOptions = SORT_KEYS.map(({ value, key }) => ({ value, label: t[key] }));
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ invoice: InvoiceFormData; items: InvoiceItem[]; rowIndex: number } | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  
  // Mobile filters toggle
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Count of active extra filters (for badge)
  const activeExtraFilterCount = [dateFrom, dateTo, clientFilter, amountMin, amountMax].filter(Boolean).length
    + (sortBy !== 'date_desc' ? 1 : 0);

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(prev => prev + 20);
    });
    if (node) observer.current.observe(node);
  }, []);


  // Unique client list from all invoices
  const clientOptions = useMemo(() => {
    const names = Array.from(new Set(invoices.map((inv) => inv.clientName).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const hasActiveFilters = statusFilter !== 'all' || dateFrom || dateTo || clientFilter || amountMin || amountMax || sortBy !== 'date_desc';

  const resetFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setClientFilter('');
    setAmountMin('');
    setAmountMax('');
    setSortBy('date_desc');
  };

  // ── Filtering + sorting pipeline ──
  const filtered = useMemo(() => {
    let result = invoices;

    // 1. Status
    if (statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    // 2. Date range (by invoice date)
    if (dateFrom) result = result.filter((inv) => inv.date >= dateFrom);
    if (dateTo)   result = result.filter((inv) => inv.date <= dateTo);

    // 3. Client
    if (clientFilter) result = result.filter((inv) => inv.clientName === clientFilter);

    // 4. Amount range (native currency total)
    const minAmt = amountMin ? parseFloat(amountMin) : null;
    const maxAmt = amountMax ? parseFloat(amountMax) : null;
    if (minAmt !== null) result = result.filter((inv) => inv.total >= minAmt);
    if (maxAmt !== null) result = result.filter((inv) => inv.total <= maxAmt);

    // 5. Sort
    const sorted = [...result];
    switch (sortBy) {
      case 'date_asc':    sorted.sort((a, b) => a.date.localeCompare(b.date)); break;
      case 'date_desc':   sorted.sort((a, b) => b.date.localeCompare(a.date)); break;
      case 'amount_asc':  sorted.sort((a, b) => a.total - b.total); break;
      case 'amount_desc': sorted.sort((a, b) => b.total - a.total); break;
      case 'client_asc':  sorted.sort((a, b) => a.clientName.localeCompare(b.clientName)); break;
      case 'client_desc': sorted.sort((a, b) => b.clientName.localeCompare(a.clientName)); break;
    }
    return sorted;
  }, [invoices, statusFilter, dateFrom, dateTo, clientFilter, amountMin, amountMax, sortBy]);

  const [prevFilteredLength, setPrevFilteredLength] = useState(filtered.length);
  if (filtered.length !== prevFilteredLength) {
    setPrevFilteredLength(filtered.length);
    setVisibleCount(20);
  }

  const visibleItems = filtered.slice(0, visibleCount);

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
          <span className="page-title__count">
            {filtered.length !== invoices.length
              ? `${filtered.length} / ${invoices.length}`
              : invoices.length}
          </span>
        </h1>
        <div className="list-header-actions">
          <Button size="sm" onClick={() => setShowForm(true)} title={t['invoice_new']}>{t['invoice_create']}</Button>
        </div>
      </div>

      {/* Status filter chips + mobile filter toggle */}
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
        {/* Toggle on mobile — lives in sticky bar, always reachable */}
        <button
          className="mobile-filter-toggle"
          onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          type="button"
          aria-expanded={showFiltersMobile}
        >
          <Icon name="sliders" size={14} />
          {activeExtraFilterCount > 0 && (
            <span className="mobile-filter-toggle__badge">{activeExtraFilterCount}</span>
          )}
        </button>
      </div>

      {/* Extra filters + sort */}
      <div className={`invoice-list__extra-filters${showFiltersMobile ? ' is-open' : ''}${hasActiveFilters ? ' has-active-filters' : ''}`}>
        {/* Date range */}
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['filter_from']}</label>
          <DatePicker
            compact
            value={dateFrom}
            onChange={setDateFrom}
            placeholder={t['filter_from']}
            locale={lang === 'ru' ? 'ru' : 'en'}
          />
        </div>
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['filter_to']}</label>
          <DatePicker
            compact
            value={dateTo}
            onChange={setDateTo}
            placeholder={t['filter_to']}
            locale={lang === 'ru' ? 'ru' : 'en'}
          />
        </div>

        <div className="inv-filter-sep" />

        {/* Client */}
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['invoice_client']}</label>
          <ClientCombobox
            clients={clientOptions}
            value={clientFilter || 'all'}
            onChange={(v) => setClientFilter(v === 'all' ? '' : v)}
            placeholder={t['filter_all_clients']}
          />
        </div>

        <div className="inv-filter-sep" />

        {/* Amount range */}
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['filter_min']}</label>
          <FilterStepper
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['filter_max']}</label>
          <FilterStepper
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder="∞"
            min={0}
          />
        </div>

        <div className="inv-filter-sep" />

        {/* Sort */}
        <div className="inv-filter-group">
          <label className="inv-filter-label">{t['filter_sort']}</label>
          <FilterDropdown
            options={sortOptions}
            value={sortBy}
            onChange={setSortBy}
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button className="inv-filter-reset" onClick={resetFilters} title={t['filter_reset']}>
            <Icon name="x" size={13} />
            {t['filter_reset']}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="invoice-list__empty">
          <Icon name="file-text" size={32} className="empty-icon" />
          <p>{statusFilter === 'all' && !hasActiveFilters ? t['invoice_empty'] : t['invoice_empty_filter']}</p>
          {statusFilter === 'all' && !hasActiveFilters && (
            <p className="empty-hint">{t['invoice_empty_hint']}</p>
          )}
        </div>
      ) : (
        <div className="invoice-cards">
          {visibleItems.map((inv, i) => {
            const sym = CURRENCY_SYMBOL[inv.currency] ?? inv.currency;
            const rowIndex = invoices.findIndex((x) => x.id === inv.id) + 2;
            const isChanging = changingStatusId === inv.id;
            const isLast = i === visibleItems.length - 1;
            return (
              <div 
                key={inv.id} 
                ref={isLast ? lastElementRef : null}
                className={`invoice-card invoice-card--${inv.status}`}
              >
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

                {/* Dates + amount in the same bottom row */}
                <div className="invoice-card__bottom">
                  <div className="invoice-card__dates">
                    <span><Icon name="calendar" size={13} /> {inv.date}</span>
                    <span><Icon name="clock" size={13} /> {inv.dueDate}</span>
                  </div>
                  <span className="invoice-card__amount amount">
                    {sym}{Number(inv.total).toFixed(2)}
                  </span>
                </div>

                <div className="card-actions">
                  <Button size="sm" variant="ghost" className="action-btn--edit" title={t['invoice_edit']} onClick={() => {
                    const invItems = getItemsForInvoice(inv.id);
                    setEditItem({ invoice: inv, items: invItems, rowIndex });
                  }}>
                    <Icon name="edit" size={13} />
                  </Button>
                  <InvoicePDFButton invoice={inv} items={getItemsForInvoice(inv.id)} />
                  <Button size="sm" variant="ghost" title={t['copy'] ?? 'Copy'} onClick={() => handleCopy(inv)}>
                    <Icon name="copy" size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" className="action-btn--delete" title={t['trash'] ?? 'Delete'} onClick={() => {
                    if (confirm(t['invoice_delete_confirm'])) deleteInvoice({ id: inv.id, rowIndex });
                  }}>
                    <Icon name="trash" size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB — create invoice from anywhere in the list */}
      {!showForm && !editItem && (
        <button
          className="fab"
          onClick={() => setShowForm(true)}
          title={t['invoice_new']}
          type="button"
          aria-label={t['invoice_new']}
        >
          <Icon name="plus" size={24} />
        </button>
      )}
    </div>
  );
}
