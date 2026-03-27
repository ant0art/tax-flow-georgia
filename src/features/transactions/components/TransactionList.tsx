import { useState, useMemo } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { CURRENCY_SYMBOL } from '@/shared/lib/currencies';
import type { TransactionFormData } from '@/entities/transaction/schemas';
import './TransactionList.css';

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function TransactionList() {
  const { transactions, isLoading, deleteTransaction } = useTransactions();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ tx: TransactionFormData; rowIndex: number } | null>(null);
  const t = useT();

  // ── Filter state ──
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');

  const hasActiveFilters =
    yearFilter !== 'all' || monthFilter !== 'all' ||
    clientFilter !== 'all' || currencyFilter !== 'all' ||
    dateFrom !== '' || dateTo !== '' ||
    amountMin !== '' || amountMax !== '' ||
    sort !== 'date-desc';

  const resetFilters = () => {
    setYearFilter('all');
    setMonthFilter('all');
    setClientFilter('all');
    setCurrencyFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSort('date-desc');
  };

  // ── Option lists ──
  const years = useMemo(() => {
    const s = new Set(transactions.map((tx) => new Date(tx.date).getFullYear().toString()));
    const cur = new Date().getFullYear().toString();
    s.add(cur);
    return [...s].sort((a, b) => Number(b) - Number(a));
  }, [transactions]);

  const uniqueClients = useMemo(() => [...new Set(transactions.map((tx) => tx.clientName).filter(Boolean))].sort(), [transactions]);
  const uniqueCurrencies = useMemo(() => [...new Set(transactions.map((tx) => tx.currency).filter(Boolean))].sort(), [transactions]);

  // ── Filtered + sorted list ──
  const filtered = useMemo(() => {
    let list = [...transactions];
    if (yearFilter !== 'all') list = list.filter((tx) => new Date(tx.date).getFullYear().toString() === yearFilter);
    if (monthFilter !== 'all') list = list.filter((tx) => new Date(tx.date).getMonth().toString() === monthFilter);
    if (clientFilter !== 'all') list = list.filter((tx) => tx.clientName === clientFilter);
    if (currencyFilter !== 'all') list = list.filter((tx) => tx.currency === currencyFilter);
    if (dateFrom) list = list.filter((tx) => tx.date >= dateFrom);
    if (dateTo)   list = list.filter((tx) => tx.date <= dateTo);
    const minAmt = amountMin ? parseFloat(amountMin) : null;
    const maxAmt = amountMax ? parseFloat(amountMax) : null;
    if (minAmt !== null) list = list.filter((tx) => tx.amountGEL >= minAmt);
    if (maxAmt !== null) list = list.filter((tx) => tx.amountGEL <= maxAmt);

    list.sort((a, b) => {
      switch (sort) {
        case 'date-asc': return a.date.localeCompare(b.date);
        case 'date-desc': return b.date.localeCompare(a.date);
        case 'amount-asc': return a.amountGEL - b.amountGEL;
        case 'amount-desc': return b.amountGEL - a.amountGEL;
      }
    });
    return list;
  }, [transactions, yearFilter, monthFilter, clientFilter, currencyFilter, dateFrom, dateTo, amountMin, amountMax, sort]);

  // ── Stats from FILTERED data ──
  const stats = useMemo(() => ({
    totalGEL: filtered.reduce((s, tx) => s + tx.amountGEL, 0),
    totalTax: filtered.reduce((s, tx) => s + tx.taxAmount, 0),
    count: filtered.length,
  }), [filtered]);

  if (isLoading) {
    return <div className="transactions-skeleton">{t['loading_transactions']}</div>;
  }

  // Edit mode — show form pre-filled
  if (editItem) {
    return (
      <TransactionForm
        initial={editItem.tx}
        rowIndex={editItem.rowIndex}
        onDone={() => setEditItem(null)}
      />
    );
  }

  return (
    <div className="transaction-list">
      {/* Page header */}
      <div className="transaction-list__header">
        <h1 className="page-title">
          <Icon name="dollar-sign" size={22} />
          {t['transactions_title']}
          <span className="page-title__count">
            {filtered.length !== transactions.length
              ? `${filtered.length} / ${transactions.length}`
              : transactions.length}
          </span>
        </h1>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            {t['transaction_add']}
          </Button>
        )}
      </div>


      {/* New transaction form (inline) */}
      {showForm && <TransactionForm onDone={() => setShowForm(false)} />}

      {/* Filter bar */}
      {transactions.length > 0 && (
        <div className="tx-filters">
          <select
            className="tx-filter-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            title="Year"
          >
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <select
            className="tx-filter-select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            title="Month"
          >
            <option value="all">All months</option>
            {MONTHS_SHORT.map((m, i) => (
              <option key={i} value={i.toString()}>{m}</option>
            ))}
          </select>

          {uniqueClients.length > 1 && (
            <select
              className="tx-filter-select"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              title="Client"
            >
              <option value="all">All clients</option>
              {uniqueClients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {uniqueCurrencies.length > 1 && (
            <select
              className="tx-filter-select"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              title="Currency"
            >
              <option value="all">All currencies</option>
              {uniqueCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <div className="tx-filter-sep" />

          <input
            type="date"
            className="tx-filter-date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
            max={dateTo || undefined}
          />
          <input
            type="date"
            className="tx-filter-date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
            min={dateFrom || undefined}
          />

          <div className="tx-filter-sep" />

          <input
            type="number"
            className="tx-filter-num"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder="Min ₾"
            min={0}
            title="Min amount (GEL)"
          />
          <input
            type="number"
            className="tx-filter-num"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder="Max ₾"
            min={0}
            title="Max amount (GEL)"
          />

          <div className="tx-filter-sep" />

          <select
            className="tx-filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            title="Sort"
          >
            <option value="date-desc">Date ↓</option>
            <option value="date-asc">Date ↑</option>
            <option value="amount-desc">Amount ↓</option>
            <option value="amount-asc">Amount ↑</option>
          </select>

          {hasActiveFilters && (
            <button className="tx-filter-reset" onClick={resetFilters} title="Reset all filters">
              <Icon name="x" size={13} />
              Reset
            </button>
          )}
        </div>
      )}

      {/* Stats row */}
      {stats.count > 0 && (
        <div className="transaction-stats">
          <div className="stat-card">
            <span className="stat-card__label">{t['transaction_total_received']}</span>
            <span className="stat-card__value amount">{stats.totalGEL.toFixed(2)} ₾</span>
          </div>
          <div className="stat-card stat-card--tax">
            <span className="stat-card__label">{t['transaction_tax_due']}</span>
            <span className="stat-card__value amount">{stats.totalTax.toFixed(2)} ₾</span>
          </div>
          <div className="stat-card stat-card--net">
            <span className="stat-card__label">Net income</span>
            <span className="stat-card__value amount">{(stats.totalGEL - stats.totalTax).toFixed(2)} ₾</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="transaction-list__empty">
          <Icon name="dollar-sign" size={32} className="empty-icon" />
          <p>{transactions.length === 0 ? t['transaction_empty'] : 'No transactions match the current filters'}</p>
          {transactions.length === 0 && <p className="empty-hint">{t['transaction_empty_hint']}</p>}
        </div>
      ) : (
        <div className="transaction-rows">
          {filtered.map((tx) => {
            // Find original index in full list for rowIndex calculation
            const originalIndex = transactions.findIndex((t2) => t2.id === tx.id);
            const rowIndex = originalIndex + 2; // 1-indexed sheet, skip header
            const sym = CURRENCY_SYMBOL[tx.currency] ?? tx.currency;
            return (
              <div key={tx.id} className="tx-row">
                <div className="tx-row__date">
                  {tx.date}
                </div>
                <div className="tx-row__main">
                  <span className="tx-row__desc">{tx.description}</span>
                  {(tx.clientName || tx.invoiceNumber) && (
                    <div className="tx-row__meta">
                      {tx.clientName && <span className="tx-row__client">{tx.clientName}</span>}
                      {tx.invoiceNumber && (
                        <span className="tx-row__invoice">
                          <Icon name="file-text" size={11} />
                          {tx.invoiceNumber}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="tx-row__amounts">
                  <span className="tx-row__original">
                    {sym}{Number(tx.amountOriginal).toFixed(2)}
                  </span>
                  <span className="tx-row__gel">
                    {Number(tx.amountGEL).toFixed(2)} ₾
                  </span>
                  <span className="tx-row__rate">
                    ×{Number(tx.nbgRate).toFixed(4)}
                  </span>
                </div>
                {/* Symmetric actions column — fades in on hover */}
                <div className="card-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="action-btn--edit"
                    title="Edit"
                    onClick={() => setEditItem({ tx, rowIndex })}
                  >
                    <Icon name="edit" size={13} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="action-btn--delete"
                    title="Delete"
                    onClick={() => {
                      if (confirm(t['transaction_delete_confirm'])) deleteTransaction(rowIndex);
                    }}
                  >
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
