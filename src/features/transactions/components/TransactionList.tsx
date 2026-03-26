import { useState, useMemo } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { TransactionForm } from './TransactionForm';
import { Button } from '@/shared/ui/Button';
import './TransactionList.css';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', GEL: '₾',
};

export function TransactionList() {
  const { transactions, isLoading, deleteTransaction } = useTransactions();
  const [showForm, setShowForm] = useState(false);

  // Summary stats
  const stats = useMemo(() => {
    const totalGEL = transactions.reduce((s, t) => s + t.amountGEL, 0);
    const totalTax = transactions.reduce((s, t) => s + t.taxAmount, 0);
    return { totalGEL, totalTax, count: transactions.length };
  }, [transactions]);

  if (isLoading) {
    return <div className="transactions-skeleton">Загрузка транзакций...</div>;
  }

  return (
    <div className="transaction-list">
      <div className="transaction-list__header">
        <h1>💸 Транзакции ({stats.count})</h1>
        <Button onClick={() => setShowForm(true)}>+ Добавить</Button>
      </div>

      {/* Quick stats */}
      {stats.count > 0 && (
        <div className="transaction-stats">
          <div className="stat-card">
            <span className="stat-card__label">Всего получено</span>
            <span className="stat-card__value amount">{stats.totalGEL.toFixed(2)} ₾</span>
          </div>
          <div className="stat-card stat-card--tax">
            <span className="stat-card__label">Налог к уплате</span>
            <span className="stat-card__value amount">{stats.totalTax.toFixed(2)} ₾</span>
          </div>
        </div>
      )}

      {showForm && <TransactionForm onDone={() => setShowForm(false)} />}

      {transactions.length === 0 && !showForm ? (
        <div className="transaction-list__empty">
          <p>Транзакций пока нет</p>
          <p style={{ color: 'var(--color-text-tertiary)' }}>
            Добавьте транзакцию вручную или привяжите к существующему инвойсу
          </p>
        </div>
      ) : (
        <div className="transaction-rows">
          {transactions.map((tx, i) => {
            const sym = CURRENCY_SYMBOLS[tx.currency] ?? tx.currency;
            return (
              <div key={tx.id} className="tx-row">
                <div className="tx-row__date">{tx.date}</div>
                <div className="tx-row__main">
                  <span className="tx-row__desc">{tx.description}</span>
                  {tx.clientName && <span className="tx-row__client">{tx.clientName}</span>}
                  {tx.invoiceNumber && (
                    <span className="tx-row__invoice">📄 {tx.invoiceNumber}</span>
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
                    if (confirm('Удалить транзакцию?')) deleteTransaction(i + 2);
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
