import { useState, useMemo } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { CURRENCY_SYMBOL } from '@/shared/lib/currencies';
import './TransactionList.css';

export function TransactionList() {
  const { transactions, isLoading, deleteTransaction } = useTransactions();
  const [showForm, setShowForm] = useState(false);
  const t = useT();

  const stats = useMemo(() => {
    const totalGEL = transactions.reduce((s, tx) => s + tx.amountGEL, 0);
    const totalTax = transactions.reduce((s, tx) => s + tx.taxAmount, 0);
    return { totalGEL, totalTax, count: transactions.length };
  }, [transactions]);

  if (isLoading) {
    return <div className="transactions-skeleton">{t['loading_transactions']}</div>;
  }

  return (
    <div className="transaction-list">
      {/* Page header */}
      <div className="transaction-list__header">
        <h1 className="page-title">
          <Icon name="dollar-sign" size={22} />
          {t['transactions_title']}
          <span className="page-title__count">{stats.count}</span>
        </h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? t['transaction_cancel'] : t['transaction_add']}
        </Button>
      </div>

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

      {/* Inline form */}
      {showForm && <TransactionForm onDone={() => setShowForm(false)} />}

      {/* Empty state */}
      {transactions.length === 0 && !showForm ? (
        <div className="transaction-list__empty">
          <Icon name="dollar-sign" size={32} className="empty-icon" />
          <p>{t['transaction_empty']}</p>
          <p className="empty-hint">{t['transaction_empty_hint']}</p>
        </div>
      ) : (
        /* Transaction rows */
        <div className="transaction-rows">
          {transactions.map((tx, i) => {
            const sym = CURRENCY_SYMBOL[tx.currency] ?? tx.currency;
            return (
              <div key={tx.id} className="tx-row">
                <div className="tx-row__date">
                  <Icon name="calendar" size={12} className="tx-row__date-icon" />
                  {tx.date}
                </div>
                <div className="tx-row__main">
                  <span className="tx-row__desc">{tx.description}</span>
                  {tx.clientName && <span className="tx-row__client">{tx.clientName}</span>}
                  {tx.invoiceNumber && (
                    <span className="tx-row__invoice">
                      <Icon name="file-text" size={12} /> {tx.invoiceNumber}
                    </span>
                  )}
                </div>
                <div className="tx-row__amounts">
                  <span className="tx-row__original amount">
                    {sym}{Number(tx.amountOriginal).toFixed(2)}
                  </span>
                  <span className="tx-row__gel amount">
                    {Number(tx.amountGEL).toFixed(2)} ₾
                  </span>
                  <span className="tx-row__rate">
                    ×{Number(tx.nbgRate).toFixed(4)}
                  </span>
                </div>
                <div className="tx-row__actions">
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm(t['transaction_delete_confirm'])) deleteTransaction(i + 2);
                  }}>
                    <Icon name="trash" size={14} />
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
