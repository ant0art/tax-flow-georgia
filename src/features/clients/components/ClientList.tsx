import { useState } from 'react';
import { useClients } from '@/features/clients/hooks/useClients';
import { ClientForm } from '@/features/clients/components/ClientForm';
import type { ClientFormData } from '@/entities/client/schemas';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './ClientList.css';

export function ClientList() {
  const { clients, isLoading, addClient, updateClient, deleteClient } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<{ data: ClientFormData; rowIndex: number } | null>(null);
  const t = useT();

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

  if (isLoading) {
    return <div className="clients-skeleton">{t['loading_clients']}</div>;
  }

  return (
    <div className="client-list">
      <div className="client-list__header">
        <h2 className="section-title">
          <Icon name="address-book" size={20} />
          {t['clients_title']} ({clients.length})
        </h2>
        {!showForm && !editItem && (
          <Button size="sm" onClick={() => setShowForm(true)}>{t['clients_add']}</Button>
        )}
      </div>

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

      {clients.length === 0 && !showForm ? (
        <div className="client-list__empty">
          <p>{t['clients_empty']}</p>
          <p style={{ color: 'var(--color-text-tertiary)' }}>
            {t['clients_empty_hint']}
          </p>
        </div>
      ) : (
        <div className="client-cards">
          {clients.map((c, i) => (
            <div key={c.id} className="client-card">
              <div className="client-card__main">
                <strong className="client-card__name">{c.name}</strong>
                {c.email && <span className="client-card__email">{c.email}</span>}
              </div>
              <div className="client-card__meta">
                {c.defaultCurrency && (
                  <span className="client-card__badge">{c.defaultCurrency}</span>
                )}
                {c.defaultProject && (
                  <span className="client-card__project">{c.defaultProject}</span>
                )}
              </div>
              <div className="client-card__actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditItem({ data: c, rowIndex: i + 2 })}
                >
                  <Icon name="edit" size={15} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(i + 2)}
                >
                  <Icon name="trash" size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
