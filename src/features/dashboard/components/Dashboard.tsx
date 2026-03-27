import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './Dashboard.css';

const MONTH_KEYS = [
  'month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun',
  'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec',
] as const;

interface MonthData {
  name: string;
  income: number;
  tax: number;
}

export function Dashboard() {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { invoices, isLoading: invLoading } = useInvoices();
  const { settings } = useSettings();
  const t = useT();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const monthlyData = useMemo((): MonthData[] => {
    const data = MONTH_KEYS.map((k) => ({ name: t[k], income: 0, tax: 0 }));
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (d.getFullYear() === selectedYear) {
        data[d.getMonth()].income += tx.amountGEL;
        data[d.getMonth()].tax += tx.taxAmount;
      }
    });
    return data;
  }, [transactions, selectedYear, t]);

  const stats = useMemo(() => {
    const yearTx = transactions.filter((tx) => new Date(tx.date).getFullYear() === selectedYear);
    const totalIncome = yearTx.reduce((s, tx) => s + tx.amountGEL, 0);
    const totalTax = yearTx.reduce((s, tx) => s + tx.taxAmount, 0);

    const unpaidInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'draft');
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const paidInvoices = invoices.filter((i) => i.status === 'paid');

    return {
      totalIncome,
      totalTax,
      netIncome: totalIncome - totalTax,
      invoiceCount: invoices.length,
      unpaidCount: unpaidInvoices.length,
      overdueCount: overdueInvoices.length,
      paidCount: paidInvoices.length,
      txCount: yearTx.length,
    };
  }, [transactions, invoices, selectedYear]);

  const isLoading = txLoading || invLoading;

  if (isLoading) {
    return <div className="dashboard-skeleton">{t['loading_data']}</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__title-row">
          <h1 className="page-title">
            <Icon name="chart-bar" size={22} />
            {t['dashboard_title']}
          </h1>
          {/* Year navigator */}
          <div className="dashboard__year-nav">
            <button
              className="dashboard__year-btn"
              onClick={() => setSelectedYear(selectedYear - 1)}
              aria-label="Previous year"
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <span className="dashboard__year-label">{selectedYear}</span>
            <button
              className="dashboard__year-btn"
              onClick={() => setSelectedYear(selectedYear + 1)}
              aria-label="Next year"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
        <div className="dashboard__header-actions">
          {settings?.fullName && (
            <span className="dashboard__user">
              <Icon name="user" size={14} />
              {settings.fullName}
            </span>
          )}
          <Button
            size="sm"
            onClick={() => setShowQuickAdd((v) => !v)}
          >
            {showQuickAdd
              ? <><Icon name="x" size={14} /> Cancel</>
              : <><Icon name="plus" size={14} /> {t['transaction_add']}</>
            }
          </Button>
        </div>
      </div>

      {/* Quick-add income form */}
      {showQuickAdd && (
        <TransactionForm onDone={() => setShowQuickAdd(false)} />
      )}

      {/* Summary cards */}
      <div className="dashboard__stats">
        <div className="dash-stat dash-stat--income">
          <span className="dash-stat__label">{t['dashboard_income_gel']}</span>
          <span className="dash-stat__value amount">{stats.totalIncome.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat dash-stat--tax">
          <span className="dash-stat__label">{t['dashboard_tax']}</span>
          <span className="dash-stat__value amount">{stats.totalTax.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat dash-stat--net">
          <span className="dash-stat__label">{t['dashboard_net']}</span>
          <span className="dash-stat__value amount">{stats.netIncome.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat__label">{t['dashboard_invoices']}</span>
          <span className="dash-stat__value">
            <span className="dash-stat__badge dash-stat__badge--paid">
              <Icon name="check-circle" size={13} /> {stats.paidCount}
            </span>
            <span className="dash-stat__badge dash-stat__badge--sent">
              <Icon name="send" size={13} /> {stats.unpaidCount}
            </span>
            <span className="dash-stat__badge dash-stat__badge--overdue">
              <Icon name="alert-triangle" size={13} /> {stats.overdueCount}
            </span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="dashboard__chart">
        <h2 className="section-title">{t['dashboard_chart_title']}</h2>
        {stats.txCount === 0 ? (
          <div className="dashboard__chart-empty">
            {t['dashboard_no_data'].replace('{year}', String(selectedYear))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: string) => [
                  `${Number(value ?? 0).toFixed(2)} ₾`,
                  name === 'income' ? t['dashboard_tooltip_income'] : t['dashboard_tooltip_tax'],
                ]) as any}
              />
              <Bar dataKey="income" radius={[4, 4, 0, 0]} name="income">
                {monthlyData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.income > 0 ? 'var(--color-success)' : 'var(--color-surface-inset)'}
                  />
                ))}
              </Bar>
              <Bar dataKey="tax" radius={[4, 4, 0, 0]} name="tax" fill="var(--color-warning)" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
