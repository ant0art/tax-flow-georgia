import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './StatusMultiSelect.css';

export interface StatusOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface StatusMultiSelectProps {
  value: Set<string>;
  onChange: (value: Set<string>) => void;
  options: StatusOption[];
  /** Label shown on the trigger when nothing is filtered (= "All") */
  labelAll: string;
}

export function StatusMultiSelect({ value, onChange, options, labelAll }: StatusMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (val: string) => {
    const next = new Set(value);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set());
    setOpen(false);
  };

  const isActive = value.size > 0;
  const singleSelected = value.size === 1 ? options.find((o) => value.has(o.value)) : null;

  return (
    <div className={`status-msel ${open ? 'status-msel--open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`status-msel__trigger filter-chip ${isActive ? 'filter-chip--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {singleSelected ? (
          /* Exactly 1 status selected: show its icon + label */
          <>
            {singleSelected.icon}
            <span>{singleSelected.label}</span>
          </>
        ) : isActive ? (
          /* 2+ statuses selected: show count badge */
          <>
            <span className="status-msel__count">{value.size}</span>
          </>
        ) : (
          /* Nothing selected = All */
          <span>{labelAll}</span>
        )}
        <Icon
          name="chevron-down"
          size={11}
          className={`status-msel__chevron ${open ? 'status-msel__chevron--open' : ''}`}
        />
      </button>

      {open && (
        <div className="status-msel__menu" role="listbox" aria-multiselectable="true">
          {/* "All" resets the selection */}
          <button
            type="button"
            role="option"
            aria-selected={!isActive}
            className={`status-msel__option status-msel__option--all ${!isActive ? 'status-msel__option--checked' : ''}`}
            onClick={selectAll}
          >
            <span className="status-msel__checkbox">
              {!isActive && <Icon name="check" size={10} />}
            </span>
            <span>{labelAll}</span>
          </button>

          <div className="status-msel__sep" />

          {options.map((opt) => {
            const checked = value.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                className={`status-msel__option status-msel__option--${opt.value} ${checked ? 'status-msel__option--checked' : ''}`}
                onClick={() => toggle(opt.value)}
              >
                <span className="status-msel__checkbox">
                  {checked && <Icon name="check" size={10} />}
                </span>
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
