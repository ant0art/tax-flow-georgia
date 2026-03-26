import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useSettings } from '@/features/settings/hooks/useSettings';
import './Dashboard.css';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

interface MonthData {
  name: string;
  income: number;
  tax: number;
}

export function Dashboard() {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { invoices, isLoading: invLoading } = useInvoices();
  const { settings } = useSettings();

  const currentYear = new Date().getFullYear();

  // Monthly breakdown
  const monthlyData = useMemo((): MonthData[] => {
    const data = MONTHS.map((name) => ({ name, income: 0, tax: 0 }));
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (d.getFullYear() === currentYear) {
        data[d.getMonth()].income += tx.amountGEL;
        data[d.getMonth()].tax += tx.taxAmount;
      }
    });
    return data;
  }, [transactions, currentYear]);

  // Summary stats
  const stats = useMemo(() => {
    const yearTx = transactions.filter((t) => new Date(t.date).getFullYear() === currentYear);
    const totalIncome = yearTx.reduce((s, t) => s + t.amountGEL, 0);
    const totalTax = yearTx.reduce((s, t) => s + t.taxAmount, 0);

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
  }, [transactions, invoices, currentYear]);

  const isLoading = txLoading || invLoading;

  if (isLoading) {
    return <div className="dashboard-skeleton">Загрузка данных...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1>📊 Дашборд {currentYear}</h1>
        {settings?.fullName && (
          <span className="dashboard__user">👤 {settings.fullName}</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="dashboard__stats">
        <div className="dash-stat dash-stat--income">
          <span className="dash-stat__label">Доход (GEL)</span>
          <span className="dash-stat__value amount">{stats.totalIncome.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat dash-stat--tax">
          <span className="dash-stat__label">Налог</span>
          <span className="dash-stat__value amount">{stats.totalTax.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat dash-stat--net">
          <span className="dash-stat__label">Чистый доход</span>
          <span className="dash-stat__value amount">{stats.netIncome.toFixed(2)} ₾</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat__label">Инвойсы</span>
          <span className="dash-stat__value">{stats.paidCount}✅ {stats.unpaidCount}📤 {stats.overdueCount}⚠️</span>
        </div>
      </div>

      {/* Chart */}
      <div className="dashboard__chart">
        <h2>Доходы по месяцам</h2>
        {stats.txCount === 0 ? (
          <div className="dashboard__chart-empty">
            Данных за {currentYear} год пока нет. Добавьте транзакции, чтобы увидеть график.
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
                  name === 'income' ? 'Доход' : 'Налог',
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
