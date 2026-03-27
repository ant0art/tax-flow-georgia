import { useState, useMemo } from 'react';
import { useClients } from '@/features/clients/hooks/useClients';
import { ClientForm } from '@/features/clients/components/ClientForm';
import type { ClientFormData } from '@/entities/client/schemas';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import '@/features/clients/components/ClientList.css';
import './ClientsPage.css';


export function ClientsPage() {
  const { clients, isLoading, isError, addClient, updateClient, deleteClient } = useClients();
  const t = useT();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ data: ClientFormData; rowIndex: number } | null>(null);
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');

  const handleAdd = async (data: ClientFormData) => {
    await addClient(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: ClientFormData) => {
    if (!editItem) return;
    await updateClient({ data, rowIndex: editItem.rowIndex });
    setEditItem(null);
  };

  const handleDelete = async (rowIndex: number) => {
    if (confirm(t['clients_delete_confirm'])) {
      await deleteClient(rowIndex);
    }
  };

  const availableCurrencies = useMemo(
    () => [...new Set(clients.map((c) => c.defaultCurrency).filter(Boolean))].sort(),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.defaultProject ?? '').toLowerCase().includes(q);
      const matchesCurrency = !currencyFilter || c.defaultCurrency === currencyFilter;
      return matchesSearch && matchesCurrency;
    });
  }, [clients, search, currencyFilter]);

  return (
    <div className="clients-page">
      {/* ── Toolbar ── */}
      <div className="clients-page__toolbar">
        <div>
          <h1 className="page-title clients-page__title">
            <Icon name="users" size={22} />
            {t['clients_title']}
          </h1>
          <p className="clients-page__subtitle">{t['clients_subtitle']}</p>
        </div>
        {!showForm && !editItem && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            {t['clients_add']}
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="clients-page__filters">
        <div className="clients-search">
          <Icon name="search" size={14} className="clients-search__icon" />
          <input
            className="clients-search__input"
            type="search"
            placeholder={t['clients_search_placeholder']}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clients-search__clear" onClick={() => setSearch('')} aria-label="Clear">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        <div className="field clients-page__currency-filter">
          <select
            className="field__select"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            aria-label={t['clients_filter_currency']}
          >
            <option value="">{t['clients_filter_all']}</option>
            {availableCurrencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Inline forms ── */}
      {showForm && (
        <ClientForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
      )}
      {editItem && (
        <ClientForm
          initial={editItem.data}
          onSubmit={handleUpdate}
          onCancel={() => setEditItem(null)}
        />
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="clients-skeleton">{t['loading_clients']}</div>
      ) : isError ? (
        <div className="client-list__empty" style={{ color: 'var(--color-error, #e05050)' }}>
          <p>⚠ Failed to load clients. Google Sheets API may be temporarily unavailable.</p>
          <p style={{ fontSize: 12, marginTop: 4, color: 'var(--color-text-tertiary)' }}>Please wait a moment and refresh the page.</p>
        </div>
      ) : filtered.length === 0 && !showForm ? (
        <div className="client-list__empty">
          <p>{search || currencyFilter ? t['clients_no_match'] : t['clients_empty']}</p>
          {!search && !currencyFilter && (
            <p style={{ color: 'var(--color-text-tertiary)' }}>{t['clients_empty_hint']}</p>
          )}
        </div>
      ) : (
        <>
          {(search || currencyFilter) && (
            <p className="clients-page__count">
              {filtered.length} / {clients.length}
            </p>
          )}
          <div className="client-cards">
            {filtered.map((c) => {
              // rowIndex = position in full clients array + 2 (1-indexed + header row)
              const rowIndex = clients.indexOf(c) + 2;
              return (
                <div key={c.id} className="client-card">
                  <div className="card-actions">
                    <Button size="sm" variant="ghost" className="action-btn--edit"
                      onClick={() => setEditItem({ data: c, rowIndex })} title="Edit">
                      <Icon name="edit" size={13} />
                    </Button>
                    <Button size="sm" variant="ghost" className="action-btn--delete"
                      onClick={() => handleDelete(rowIndex)} title="Delete">
                      <Icon name="trash" size={13} />
                    </Button>
                  </div>
                  <strong className="client-card__name">{c.name}</strong>
                  {c.email && <span className="client-card__email">{c.email}</span>}
                  {(c.defaultCurrency || c.defaultProject) && (
                    <div className="client-card__meta">
                      {c.defaultCurrency && (
                        <span className="client-card__badge">{c.defaultCurrency}</span>
                      )}
                      {c.defaultProject && (
                        <span className="client-card__project">{c.defaultProject}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
