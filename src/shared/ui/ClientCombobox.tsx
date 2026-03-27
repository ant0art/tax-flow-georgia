import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import './ClientCombobox.css';

interface ClientComboboxProps {
  clients: string[];
  value: string;          // 'all' | specific client name
  onChange: (value: string) => void;
  placeholder?: string;  // label shown for "all"
}

export function ClientCombobox({ clients, value, onChange, placeholder = 'All clients' }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = search
    ? clients.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const displayLabel = value === 'all' ? placeholder : value;

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={`client-combobox ${open ? 'client-combobox--open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`client-combobox__trigger ${value !== 'all' ? 'client-combobox__trigger--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="client-combobox__label">{displayLabel}</span>
        <Icon name="chevron-down" size={12} className={`client-combobox__chevron ${open ? 'client-combobox__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="client-combobox__dropdown" role="listbox">
          {/* Search input */}
          <div className="client-combobox__search-wrap">
            <Icon name="search" size={13} className="client-combobox__search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="client-combobox__search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                className="client-combobox__search-clear"
                onClick={() => setSearch('')}
                tabIndex={-1}
              >
                <Icon name="x" size={11} />
              </button>
            )}
          </div>

          {/* Options list — max 5 rows + scroll */}
          <div className="client-combobox__list" role="group">
            {/* "All" option */}
            <button
              type="button"
              role="option"
              aria-selected={value === 'all'}
              className={`client-combobox__option ${value === 'all' ? 'client-combobox__option--active' : ''}`}
              onClick={() => select('all')}
            >
              {placeholder}
            </button>

            {filtered.length === 0 ? (
              <div className="client-combobox__empty">No clients found</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={value === c}
                  className={`client-combobox__option ${value === c ? 'client-combobox__option--active' : ''}`}
                  onClick={() => select(c)}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
