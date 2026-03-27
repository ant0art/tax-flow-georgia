import type { InputHTMLAttributes } from 'react';
import './FieldStepper.css';

interface FieldStepperProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label displayed above the input */
  label: string;
  /** Step increment (default 1) */
  step?: number;
  /** Show mono font (for amounts and rates) */
  mono?: boolean;
  /** Hint text below the input */
  hint?: string;
  /** Validation error text */
  error?: string;
}

/**
 * Form-field-sized number stepper — same SVG triangle design as FilterStepper/QtySpinner,
 * but with a label and error display for use inside forms (TransactionForm, etc).
 * Height: 32px (matches field__input). This is the standard numeric input widget for forms.
 */
export function FieldStepper({
  label,
  step = 1,
  mono = false,
  hint,
  error,
  id,
  className = '',
  ...rest
}: FieldStepperProps) {
  const inputId = id || `field-stepper-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const nudge = (dir: 1 | -1) => {
    const cur = parseFloat(String(rest.value ?? '0')) || 0;
    const next = cur + dir * step;
    rest.onChange?.({
      target: { value: String(parseFloat(next.toFixed(10))) },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`field field-stepper ${error ? 'field--error' : ''} ${className}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field-stepper__wrap">
        <input
          {...rest}
          id={inputId}
          type="number"
          className={`field-stepper__input${mono ? ' field-stepper__input--mono' : ''}`}
          inputMode="decimal"
          step={step}
        />
        <div className="field-stepper__side">
          <button
            type="button"
            className="field-stepper__btn"
            tabIndex={-1}
            aria-label="Increase"
            onClick={() => nudge(1)}
          >
            <svg width="7" height="5" viewBox="0 0 8 6" fill="none" aria-hidden="true">
              <path d="M4 0.5L7.5 5.5H0.5L4 0.5Z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="field-stepper__btn"
            tabIndex={-1}
            aria-label="Decrease"
            onClick={() => nudge(-1)}
          >
            <svg width="7" height="5" viewBox="0 0 8 6" fill="none" aria-hidden="true">
              <path d="M4 5.5L0.5 0.5H7.5L4 5.5Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error" role="alert">{error}</span>}
    </div>
  );
}
