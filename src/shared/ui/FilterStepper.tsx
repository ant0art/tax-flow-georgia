import type { InputHTMLAttributes } from 'react';
import './FilterStepper.css';

interface FilterStepperProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Step increment (default 1) */
  step?: number;
}

/**
 * Compact number stepper for filter bars.
 * Matches the qty-stepper design from InvoiceForm but sized for filter controls (30px).
 */
export function FilterStepper({ step = 1, className = '', ...rest }: FilterStepperProps) {
  const handleUp = () => {
    const cur = parseFloat(String(rest.value ?? '0')) || 0;
    const next = cur + step;
    rest.onChange?.({ target: { value: String(next) } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleDown = () => {
    const cur = parseFloat(String(rest.value ?? '0')) || 0;
    const next = Math.max(0, cur - step);
    rest.onChange?.({ target: { value: String(next) } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`filter-stepper ${className}`}>
      <input
        {...rest}
        type="number"
        className="filter-stepper__input"
        inputMode="decimal"
      />
      <div className="filter-stepper__side">
        <button
          type="button"
          className="filter-stepper__btn"
          tabIndex={-1}
          aria-label="Increase"
          onClick={handleUp}
        >
          <svg width="7" height="5" viewBox="0 0 8 6" fill="none" aria-hidden="true">
            <path d="M4 0.5L7.5 5.5H0.5L4 0.5Z" fill="currentColor"/>
          </svg>
        </button>
        <button
          type="button"
          className="filter-stepper__btn"
          tabIndex={-1}
          aria-label="Decrease"
          onClick={handleDown}
        >
          <svg width="7" height="5" viewBox="0 0 8 6" fill="none" aria-hidden="true">
            <path d="M4 5.5L0.5 0.5H7.5L4 5.5Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
