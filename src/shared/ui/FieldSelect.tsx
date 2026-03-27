import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './FieldSelect.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface FieldSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  className?: string;
}

/**
 * Full-width labeled dropdown that matches form field aesthetics.
 * Uses the same custom-menu pattern as FilterDropdown (rounded corners,
 * hover highlight, accent chevron) but sized to match field__input height
 * and wrapped with a label — for use inside forms.
 */
export function FieldSelect({
  label,
  options,
  value,
  onChange,
  error,
  id,
  className = '',
}: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = id || `field-select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      className={`field field-select ${error ? 'field--error' : ''} ${className}`}
      ref={containerRef}
    >
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field-select__control">
        <button
          type="button"
          id={inputId}
          className={`field-select__trigger ${open ? 'field-select__trigger--open' : ''} ${error ? 'field-select__trigger--error' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="field-select__label">{selected?.label}</span>
          <Icon
            name="chevron-down"
            size={12}
            className={`field-select__chevron ${open ? 'field-select__chevron--open' : ''}`}
          />
        </button>

        {open && (
          <div className="field-select__menu" role="listbox">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                className={`field-select__option ${value === opt.value ? 'field-select__option--active' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
