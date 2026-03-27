import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './FilterDropdown.css';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** Label shown when nothing extra is selected (first option) */
  placeholder?: string;
  className?: string;
}

export function FilterDropdown({ options, value, onChange, className = '' }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const isActive = value !== options[0]?.value;

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

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div
      className={`filter-dropdown ${open ? 'filter-dropdown--open' : ''} ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`filter-dropdown__trigger ${isActive ? 'filter-dropdown__trigger--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-dropdown__label">{selected?.label}</span>
        <Icon
          name="chevron-down"
          size={12}
          className={`filter-dropdown__chevron ${open ? 'filter-dropdown__chevron--open' : ''}`}
        />
      </button>

      {open && (
        <div className="filter-dropdown__menu" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={`filter-dropdown__option ${value === opt.value ? 'filter-dropdown__option--active' : ''}`}
              onClick={() => select(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
