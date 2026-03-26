import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { ClientFormData } from '@/entities/client/schemas';
import { ClientForm } from './ClientForm';
import { useClients } from '@/features/clients/hooks/useClients';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './ClientCombobox.css';

interface ClientComboboxProps {
  clients: ClientFormData[];
  value: string; // clientId
  onChange: (clientId: string) => void;
  error?: string;
}

export function ClientCombobox({ clients, value, onChange, error }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { addClient } = useClients();

  const selectedClient = clients.find((c) => c.id === value);

  // Filtered list
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [clients, search]);

  // Close on click outside
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

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.combobox__option');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectClient = useCallback(
    (clientId: string) => {
      onChange(clientId);
      setOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const totalOptions = filtered.length + 1; // +1 for "Create new"

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((i) => (i + 1) % totalOptions);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((i) => (i <= 0 ? totalOptions - 1 : i - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filtered.length) {
            selectClient(filtered[highlightIndex].id);
          } else if (highlightIndex === filtered.length) {
            setShowCreateForm(true);
            setOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setSearch('');
          break;
      }
    },
    [open, highlightIndex, filtered, totalOptions, selectClient]
  );

  const handleCreateClient = async (data: ClientFormData) => {
    await addClient(data);
    onChange(data.id);
    setShowCreateForm(false);
  };

  if (showCreateForm) {
    return (
      <div className="combobox__create-wrap">
        <ClientForm
          onSubmit={handleCreateClient}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`field combobox ${error ? 'field--error' : ''}`}
      ref={containerRef}
    >
      <label className="field__label">
        {t['invoice_client']}
      </label>
      <div
        className={`combobox__trigger ${open ? 'combobox__trigger--open' : ''}`}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            className="combobox__search"
            placeholder={t['invoice_client_search'] ?? 'Search clients...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span className={`combobox__display ${!selectedClient ? 'combobox__display--placeholder' : ''}`}>
            {selectedClient ? selectedClient.name : (t['invoice_client_select'])}
          </span>
        )}
        <Icon name="chevron-down" size={14} />
      </div>

      {open && (
        <div className="combobox__dropdown" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="combobox__empty">
              {t['clients_empty'] ?? 'No clients found'}
            </div>
          ) : (
            filtered.map((c, i) => (
              <div
                key={c.id}
                className={`combobox__option ${c.id === value ? 'combobox__option--selected' : ''} ${i === highlightIndex ? 'combobox__option--highlighted' : ''}`}
                onClick={() => selectClient(c.id)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="combobox__option-name">{c.name}</span>
                {c.email && <span className="combobox__option-email">{c.email}</span>}
              </div>
            ))
          )}
          <div
            className={`combobox__option combobox__option--create ${highlightIndex === filtered.length ? 'combobox__option--highlighted' : ''}`}
            onClick={() => {
              setShowCreateForm(true);
              setOpen(false);
            }}
            onMouseEnter={() => setHighlightIndex(filtered.length)}
          >
            <Icon name="plus" size={14} />
            <span>{t['combobox_create_client'] ?? 'Create new client'}</span>
          </div>
        </div>
      )}

      {error && (
        <span className="field__error" role="alert">{error}</span>
      )}
    </div>
  );
}
