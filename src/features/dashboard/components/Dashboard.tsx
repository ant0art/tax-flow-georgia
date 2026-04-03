import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/shared/ui/Icon';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { useT } from '@/shared/i18n/useT';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import type { WidgetId } from '../hooks/useDashboardLayout';
import { DashboardWidget } from './DashboardWidget';
import './Dashboard.css';

const MONTH_KEYS = [
  'month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun',
  'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec',
] as const;

interface MonthData { name: string; income: number; tax: number; }
interface TooltipEntry { dataKey?: string | number; value?: number; }

function ChartTooltip(
  { active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string },
) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 150, boxShadow: 'var(--shadow-2)',
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--color-text)' }}>{label}</p>
      {payload.map((item) => {
        const isIncome = item.dataKey === 'income';
        const color = isIncome ? 'var(--color-success)' : 'var(--color-warning)';
        return (
          <p key={String(item.dataKey)} style={{ margin: '2px 0', color, fontWeight: 500 }}>
            <span style={{ opacity: 0.75 }}>{isIncome ? 'Income' : 'Tax'}: </span>
            {Number(item.value ?? 0).toFixed(2)} ₾
          </p>
        );
      })}
    </div>
  );
}

const QUICK_LINKS: { key: 'ql_nbg' | 'ql_cabinet' | 'ql_declaration_guide'; hintKey: 'ql_nbg_hint' | 'ql_cabinet_hint' | 'ql_declaration_guide_hint'; url: string; icon: IconName; accent: string }[] = [
  { key: 'ql_nbg',               hintKey: 'ql_nbg_hint',               url: 'https://nbg.gov.ge/en/monetary-policy/currency', icon: 'trending-up', accent: 'var(--color-primary)' },
  { key: 'ql_cabinet',           hintKey: 'ql_cabinet_hint',           url: 'https://eservices.rs.ge',                       icon: 'bank',        accent: 'var(--color-success)' },
  { key: 'ql_declaration_guide', hintKey: 'ql_declaration_guide_hint', url: 'https://telegra.ph/Podacha-deklaracij-so-statusom-Malyj-Biznes-02-18', icon: 'book-open', accent: 'var(--color-warning)' },
];

export function Dashboard() {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { invoices,     isLoading: invLoading } = useInvoices();
  const t = useT();
  const navigate = useNavigate();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);

  // Defer chart render until container has real dimensions
  const [chartMounted, setChartMounted] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement | null>(null);
  const chartRefCb = useCallback((node: HTMLDivElement | null) => {
    chartBodyRef.current = node;
    if (node && !chartMounted) {
      // Wait one frame so the browser has computed layout
      requestAnimationFrame(() => setChartMounted(true));
    }
  }, [chartMounted]);

  const { layout, reorder, resize, toggleLock, resetLayout } = useDashboardLayout();

  const monthlyData = useMemo((): MonthData[] => {
    const data = MONTH_KEYS.map((k) => ({ name: t[k], income: 0, tax: 0 }));
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (d.getFullYear() === selectedYear) {
        data[d.getMonth()].income += tx.amountGEL;
        data[d.getMonth()].tax    += tx.taxAmount;
      }
    });
    return data;
  }, [transactions, selectedYear, t]);

  const stats = useMemo(() => {
    const yearTx = transactions.filter((tx) => new Date(tx.date).getFullYear() === selectedYear);
    const totalIncome = yearTx.reduce((s, tx) => s + tx.amountGEL, 0);
    const totalTax    = yearTx.reduce((s, tx) => s + tx.taxAmount, 0);
    const unpaid   = invoices.filter((i) => i.status === 'sent' || i.status === 'draft');
    const overdue  = invoices.filter((i) => i.status === 'overdue');
    const paid     = invoices.filter((i) => i.status === 'paid');
    return {
      totalIncome, totalTax, netIncome: totalIncome - totalTax,
      unpaidCount: unpaid.length, overdueCount: overdue.length,
      paidCount: paid.length, txCount: yearTx.length,
    };
  }, [transactions, invoices, selectedYear]);

  const recentTransactions = useMemo(() =>
    [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
  [transactions]);

  if (txLoading || invLoading) {
    return <div className="dashboard-skeleton">{t['loading_data']}</div>;
  }

  const widgetProps = {
    draggingId, setDraggingId,
    onReorder: reorder,
    onResize: resize,
    onToggleLock: toggleLock,
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <div className="dashboard__title-row">
          <h1 className="page-title">
            <Icon name="chart-bar" size={22} />
            {t['dashboard_title']}
          </h1>
          <div className="dashboard__year-nav">
            <button className="dashboard__year-btn" onClick={() => setSelectedYear(selectedYear - 1)} aria-label="Previous year">
              <Icon name="chevron-left" size={14} />
            </button>
            <span className="dashboard__year-label">{selectedYear}</span>
            <button className="dashboard__year-btn" onClick={() => setSelectedYear(selectedYear + 1)} aria-label="Next year">
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
        <button className="dashboard__reset-btn" onClick={resetLayout} title={t['dashboard_reset_layout']}>
          <Icon name="sliders" size={13} />
          {t['dashboard_reset_layout']}
        </button>
      </div>

      {/* Summary stat cards — always full width, locked */}
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
            <span className="dash-stat__badge dash-stat__badge--paid"><Icon name="check-circle" size={13} /> {stats.paidCount}</span>
            <span className="dash-stat__badge dash-stat__badge--sent"><Icon name="send" size={13} /> {stats.unpaidCount}</span>
            <span className="dash-stat__badge dash-stat__badge--overdue"><Icon name="alert-triangle" size={13} /> {stats.overdueCount}</span>
          </span>
        </div>
      </div>

      {/* Draggable 4-column widget grid */}
      <div className="dashboard__grid">
        {layout.map((cfg) => (
          <DashboardWidget key={cfg.id} config={cfg} {...widgetProps}>

            {/* ── CHART ── */}
            {cfg.id === 'chart' && (
              <div className="dashboard__chart">
                <h2 className="section-title">{t['dashboard_chart_title']}</h2>
                {stats.txCount === 0 ? (
                  <div className="dashboard__chart-empty">
                    {t['dashboard_no_data'].replace('{year}', String(selectedYear))}
                  </div>
                ) : (
                  <div className="dashboard__chart__body" ref={chartRefCb}>
                    {chartMounted && <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} />
                        <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="income" radius={[4, 4, 0, 0]}>
                          {monthlyData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.income > 0 ? 'var(--color-success)' : 'var(--color-surface-inset)'} />
                          ))}
                        </Bar>
                        <Bar dataKey="tax" radius={[4, 4, 0, 0]} fill="var(--color-warning)" opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>}
                  </div>
                )}
              </div>
            )}

            {/* ── RECENT TRANSACTIONS ── */}
            {cfg.id === 'recent-transactions' && (
              <div className="dash-panel">
                <div className="dash-panel__head">
                  <span className="dash-panel__title">
                    <Icon name="arrow-down-circle" size={14} />
                    {t['dashboard_recent_tx']}
                  </span>
                  <button className="dash-panel__link" onClick={() => navigate('/transactions')}>
                    {t['dashboard_view_all']} →
                  </button>
                </div>
                <div className="dash-panel__body">
                  {recentTransactions.length === 0 ? (
                    <p className="dash-panel__empty">{t['dashboard_recent_tx_empty']}</p>
                  ) : (
                    <ul className="dash-tx-list">
                      {recentTransactions.map((tx) => (
                        <li key={tx.id} className="dash-tx-item">
                          <div className="dash-tx-item__meta">
                            <span className="dash-tx-item__date">
                              {new Date(tx.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="dash-tx-item__client">{tx.clientName || tx.description}</span>
                          </div>
                          <div className="dash-tx-item__amounts">
                            <span className="dash-tx-item__gel amount">{tx.amountGEL.toFixed(2)} ₾</span>
                            {tx.currency !== 'GEL' && (
                              <span className="dash-tx-item__orig">{tx.amountOriginal.toFixed(2)} {tx.currency}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ── QUICK LINKS ── */}
            {cfg.id === 'quick-links' && (
              <div className="dash-panel dash-panel--links">
                <div className="dash-panel__head">
                  <span className="dash-panel__title">
                    <Icon name="external-link" size={14} />
                    {t['ql_title']}
                  </span>
                </div>
                <div className="dash-panel__body">
                  <ul className="dash-ql-list">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.key}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dash-ql-item"
                          style={{ '--ql-accent': link.accent } as React.CSSProperties}
                        >
                          <span className="dash-ql-item__icon"><Icon name={link.icon} size={15} /></span>
                          <span className="dash-ql-item__text">
                            <span className="dash-ql-item__label">{t[link.key]}</span>
                            <span className="dash-ql-item__hint">{t[link.hintKey]}</span>
                          </span>
                          <Icon name="arrow-up-right" size={13} className="dash-ql-item__arrow" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          </DashboardWidget>
        ))}
      </div>
    </div>
  );
}
