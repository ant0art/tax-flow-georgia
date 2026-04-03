import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import type { DeclarationCalcState, Deduction } from '@/features/declarations/hooks/useDeclarationCalc';

interface Props {
  calc: DeclarationCalcState;
  onNext: () => void;
  onBack: () => void;
}

function CopyButton({ value }: { value: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value.toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className={`decl-copy-btn ${copied ? 'decl-copy-btn--copied' : ''}`} onClick={handleCopy} title="Copy">
      <Icon name={copied ? 'check' : 'copy'} size={13} />
    </button>
  );
}

const DEDUCTIONS: Deduction[] = [0, 3000, 6000];

export function DeclarationStep2({ calc, onNext, onBack }: Props) {
  const t = useT();
  const { fields, deduction, setDeduction, period } = calc;
  const [y, m] = period.split('-');

  const rows: { label: string; field: keyof typeof fields; hint?: string }[] = [
    { label: t['decl_field15'], field: 'field15', hint: t['decl_field15_hint'] },
    { label: t['decl_field16'], field: 'field16', hint: t['decl_field16_hint'] },
    { label: t['decl_field17'], field: 'field17', hint: t['decl_field17_hint'] },
    { label: t['decl_field19'], field: 'field19', hint: t['decl_field19_hint'] },
    { label: t['decl_field21'], field: 'field21', hint: t['decl_field21_hint'] },
  ];

  return (
    <div className="decl-step">
      <div className="decl-step__intro">
        <h2 className="decl-step__heading">{t['decl_step2_title']}</h2>
        <p className="decl-step__hint">{t['decl_step2_hint']} <strong>{y}-{m}</strong></p>
      </div>

      {/* Field 18 — Deduction selector */}
      <div className="decl-field-group">
        <label className="decl-label">
          {t['decl_field18']}
          <span className="decl-label__sub">{t['decl_field18_hint']}</span>
        </label>
        <div className="decl-segs">
          {DEDUCTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`decl-seg ${deduction === d ? 'decl-seg--active' : ''}`}
              onClick={() => setDeduction(d)}
            >
              {d === 0 ? t['decl_deduction_none'] : `₾${d.toLocaleString()}`}
            </button>
          ))}
        </div>
      </div>

      {/* Calculated fields table */}
      <div className="decl-fields-table">
        <div className="decl-fields-table__header">
          <span>{t['decl_rs_field']}</span>
          <span>{t['decl_value']}</span>
        </div>
        {rows.map(({ label, field, hint }) => (
          <div key={field} className={`decl-fields-row ${field === 'field19' ? 'decl-fields-row--highlight' : ''}`}>
            <div className="decl-fields-row__label">
              <span className="decl-field-num">({field.replace('field', '')})</span>
              <span>{label}</span>
              {hint && <span className="decl-field-hint">{hint}</span>}
            </div>
            <div className="decl-fields-row__value">
              <span className="amount">
                {field === 'field16'
                  ? `${(fields[field] * 100).toFixed(0)}%`
                  : `₾${fields[field].toFixed(2)}`}
              </span>
              <CopyButton value={field === 'field16' ? fields[field] * 100 : fields[field]} />
            </div>
          </div>
        ))}
      </div>

      <div className="decl-tax-callout">
        <Icon name="trending-up" size={16} />
        <span>{t['decl_tax_due']}: </span>
        <strong className="amount">₾{fields.field19.toFixed(2)}</strong>
      </div>

      <div className="decl-step__actions">
        <Button variant="ghost" onClick={onBack}>{t['decl_back']}</Button>
        <Button onClick={onNext}>{t['decl_next']} →</Button>
      </div>
    </div>
  );
}
