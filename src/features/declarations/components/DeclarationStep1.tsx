import { useMemo } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import type { DeclarationCalcState } from '@/features/declarations/hooks/useDeclarationCalc';
import type { Declaration } from '@/entities/declaration/schemas';
import { periodsForYear } from '@/entities/declaration/schemas';

interface Props {
  calc: DeclarationCalcState;
  onNext: () => void;
  /** If set, a declaration with this period already exists */
  existingPeriods?: string[];
  /** The declaration being edited (for sync state checks) */
  editDeclaration?: Declaration;
}

const MONTH_KEYS = [
  'month_jan', 'month_feb', 'month_mar', 'month_apr',
  'month_may', 'month_jun', 'month_jul', 'month_aug',
  'month_sep', 'month_oct', 'month_nov', 'month_dec',
] as const;

export function DeclarationStep1({ calc, onNext, existingPeriods = [], editDeclaration }: Props) {
  const t = useT();
  const {
    period, setPeriod, monthTransactions, selectedIds,
    toggleTx, selectAll, allSelected, isEditMode,
    submittedAt, setSubmittedAt,
  } = calc;

  // Check if the declaration is synced with RS.GE (imported data makes fields read-only)
  const isSyncedFromRsge = !!editDeclaration?.rsgeImportedAt && editDeclaration?.rsgeSyncState !== 'unlinked';

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  const periods = useMemo(() => {
    const [y] = period.split('-').map(Number);
    return periodsForYear(y);
  }, [period]);

  // Detect if this period is already taken by another declaration
  const periodTaken = !isEditMode && existingPeriods.includes(period);

  // Empty selectedIds means "all selected"
  const isSelected = (id: string) => selectedIds.size === 0 || selectedIds.has(id);

  const formatPeriodLabel = (p: string) => {
    const [y, m] = p.split('-');
    const monthKey = MONTH_KEYS[parseInt(m, 10) - 1];
    return `${t[monthKey]} ${y}`;
  };

  const totalGel = monthTransactions
    .filter((tx) => isSelected(tx.id))
    .reduce((s, tx) => s + (tx.amountGEL || 0), 0);

  return (
    <div className="decl-step">
      <div className="decl-step__intro">
        <h2 className="decl-step__heading">{t['decl_step1_title']}</h2>
        <p className="decl-step__hint">{t['decl_step1_hint']}</p>
      </div>

      {/* Year selector */}
      <div className="decl-field-group">
        <label className="decl-label">{t['decl_year']}</label>
        <div className="decl-segs">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`decl-seg ${period.startsWith(String(y)) ? 'decl-seg--active' : ''}`}
              onClick={() => setPeriod(`${y}-${period.slice(5, 7)}`)}
              disabled={isEditMode}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Month selector */}
      <div className="decl-field-group">
        <label className="decl-label">
          {t['decl_period']}
          {isEditMode && (
            <span className="decl-label__sub">
              <Icon name="lock" size={11} /> {t['decl_period_locked']}
            </span>
          )}
        </label>
        <div className="decl-month-grid">
          {periods.map((p) => {
            const [, m] = p.split('-');
            const monthKey = MONTH_KEYS[parseInt(m, 10) - 1];
            const taken = !isEditMode && existingPeriods.includes(p) && p !== period;
            return (
              <button
                key={p}
                type="button"
                className={`decl-month-btn ${p === period ? 'decl-month-btn--active' : ''} ${taken ? 'decl-month-btn--taken' : ''}`}
                onClick={() => { setPeriod(p); selectAll(); }}
                disabled={isEditMode || taken}
                title={taken ? t['decl_period_exists'] : undefined}
              >
                {t[monthKey]}
                {taken && <span className="decl-month-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Period conflict warning */}
      {periodTaken && (
        <div className="decl-period-warning">
          <Icon name="alert-triangle" size={16} />
          <span>{t['decl_period_exists']}</span>
        </div>
      )}

      {/* Submission date (datepicker, optional) */}
      <div className="decl-field-group">
        <label className="decl-label" htmlFor="decl-submitted-at">
          {t['decl_submission_date']}
          {isSyncedFromRsge ? (
            <span className="decl-label__sub">
              <Icon name="lock" size={11} /> {t['rsge_synced_readonly']}
            </span>
          ) : (
            <span className="decl-label__sub">{t['decl_submission_date_hint']}</span>
          )}
        </label>
        <input
          id="decl-submitted-at"
          type="date"
          className="decl-date-input"
          value={submittedAt}
          onChange={(e) => setSubmittedAt(e.target.value)}
          disabled={isSyncedFromRsge}
        />
      </div>

      {/* Transaction list */}
      <div className="decl-field-group">
        <div className="decl-tx-header">
          <span className="decl-label">
            {t['decl_transactions']} — {formatPeriodLabel(period)}
          </span>
          <button type="button" className="decl-link" onClick={selectAll}>
            {allSelected ? t['decl_deselect_all'] : t['decl_select_all']}
          </button>
        </div>

        {monthTransactions.length === 0 ? (
          <div className="decl-tx-empty">
            <Icon name="dollar-sign" size={28} />
            <p>{t['decl_no_transactions']}</p>
            <p className="decl-tx-empty__sub">{t['decl_no_transactions_hint']}</p>
          </div>
        ) : (
          <div className="decl-tx-list">
            {monthTransactions.map((tx) => (
              <label
                key={tx.id}
                className={`decl-tx-row ${isSelected(tx.id) ? 'decl-tx-row--selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="decl-tx-check"
                  checked={isSelected(tx.id)}
                  onChange={() => toggleTx(tx.id)}
                />
                <div className="decl-tx-info">
                  <span className="decl-tx-date">{tx.date}</span>
                  <span className="decl-tx-client">{tx.clientName || '—'}</span>
                  {tx.description && <span className="decl-tx-desc">{tx.description}</span>}
                </div>
                <div className="decl-tx-amounts">
                  <span className="decl-tx-gel amount">₾{(tx.amountGEL || 0).toFixed(2)}</span>
                  {tx.currency !== 'GEL' && (
                    <span className="decl-tx-orig">
                      {tx.currency} {(tx.amountOriginal || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="decl-tx-total">
          <span>{t['decl_total_gel']}</span>
          <span className="amount decl-tx-total__num">₾{totalGel.toFixed(2)}</span>
        </div>
      </div>

      <div className="decl-step__actions">
        <Button onClick={onNext} disabled={periodTaken}>
          {t['decl_next']} →
        </Button>
      </div>
    </div>
  );
}
