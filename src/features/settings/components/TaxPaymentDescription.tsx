import { useState } from 'react';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

interface Props {
  tin: string;
}

export function TaxPaymentDescription({ tin }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const now = new Date();
  // Previous month (we pay for the past period)
  const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // Use English or Russian month name based on current locale (t key check)
  const isRu = t['settings_tin'] === 'TIN (идентификационный номер)';
  const monthName = isRu ? MONTH_NAMES_RU[prevMonthIndex] : MONTH_NAMES_EN[prevMonthIndex];

  const tinDisplay = tin?.trim() || 'YOUR_TIN';
  const description = `${tinDisplay} small business tax for ${monthName} ${year}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: execCommand
      const el = document.createElement('textarea');
      el.value = description;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="tax-pay-desc">
      <div className="tax-pay-desc__label-row">
        <span className="tax-pay-desc__label">{t['tax_payment_desc_label']}</span>
        <span className="tax-pay-desc__hint">{t['tax_payment_desc_hint']}</span>
      </div>
      <div className="tax-pay-desc__box">
        <code className="tax-pay-desc__text">{description}</code>
        <button
          type="button"
          className={`tax-pay-desc__copy${copied ? ' tax-pay-desc__copy--done' : ''}`}
          onClick={handleCopy}
          title={t['tax_payment_desc_copy']}
        >
          <Icon name={copied ? 'check-circle' : 'copy'} size={14} />
          <span>{copied ? t['tax_payment_desc_copied'] : t['tax_payment_desc_copy']}</span>
        </button>
      </div>
    </div>
  );
}
