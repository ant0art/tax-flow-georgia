import { useState, useRef, useEffect, useCallback } from 'react';
import type { ClientFormData, ClientAccount } from '@/entities/client/schemas';
import { useClients } from '@/features/clients/hooks/useClients';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import './AccountCombobox.css';

interface AccountComboboxProps {
  /** All clients (passed from parent to avoid extra hook call) */
  clients: ClientFormData[];
  /** ID of the selected client */
  clientId: string;
  /** Filter accounts by this currency */
  currency: string;
  /** Currently selected account ID (null = nothing chosen) */
  selectedAccountId: string | null;
  /** Called when the user picks or creates an account */
  onChange: (account: ClientAccount) => void;
}

export function AccountCombobox({
  clients,
  clientId,
  currency,
  selectedAccountId,
  onChange,
}: AccountComboboxProps) {
  const t = useT();
  const { addAccountToClient } = useClients();
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newIban, setNewIban] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const client = clients.find((c) => c.id === clientId);
  const allAccounts = client?.accounts ?? [];
  const filteredAccounts = allAccounts.filter((a) => a.currency === currency);
  const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId);
  const noMatch = filteredAccounts.length === 0 && allAccounts.length > 0;
  const noAccountsAtAll = allAccounts.length === 0;

  // Close on click outside
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

  const handleSelect = useCallback(
    (acc: ClientAccount) => {
      onChange(acc);
      setOpen(false);
    },
    [onChange]
  );

  const handleCreate = async () => {
    if (!newBankName.trim() || !newIban.trim()) return;
    setCreating(true);
    try {
      const newAccount: ClientAccount = {
        id: crypto.randomUUID(),
        clientId,
        currency: currency as 'USD' | 'EUR' | 'GBP' | 'GEL',
        bankName: newBankName.trim(),
        iban: newIban.trim(),
        createdAt: new Date().toISOString().split('T')[0],
      };
      await addAccountToClient({ clientId, account: newAccount });
      onChange(newAccount);
      setShowCreateForm(false);
      setNewBankName('');
      setNewIban('');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  // Don't render if no client selected
  if (!clientId || !client) return null;

  // If inline create form is showing
  if (showCreateForm) {
    return (
      <div className="account-combobox__create" ref={containerRef}>
        <div className="account-combobox__create-header">
          <Icon name="bank" size={13} />
          <span>{t['account_create_new'] ?? 'New bank account'} ({currency})</span>
        </div>
        <div className="account-combobox__create-fields">
          <Input
            label={t['account_create_bank_name'] ?? 'Bank name'}
            value={newBankName}
            onChange={(e) => setNewBankName((e.target as HTMLInputElement).value)}
            autoFocus
          />
          <Input
            label={t['account_create_iban'] ?? 'IBAN / Account'}
            value={newIban}
            onChange={(e) => setNewIban((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="account-combobox__create-actions">
          <Button
            type="button"
            onClick={handleCreate}
            loading={creating}
            disabled={!newBankName.trim() || !newIban.trim()}
          >
            {t['account_create_submit'] ?? 'Add account'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
            {t['cancel'] ?? 'Cancel'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="field account-combobox" ref={containerRef}>
      <label className="field__label">
        {t['invoice_client_account'] ?? 'Client account'}
      </label>

      <div
        className={`combobox__trigger ${open ? 'combobox__trigger--open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {selectedAccount ? (
          <span className="combobox__display account-combobox__display">
            <Icon name="check-circle" size={12} className="account-combobox__icon--ok" />
            <span className="account-combobox__bank">{selectedAccount.bankName}</span>
            <span className="account-combobox__iban">{selectedAccount.iban}</span>
          </span>
        ) : noMatch || noAccountsAtAll ? (
          <span className="combobox__display account-combobox__display account-combobox__display--warn">
            <Icon name="alert-triangle" size={12} />
            <span>{t['invoice_client_no_account'] ?? 'No account for this currency'}</span>
          </span>
        ) : (
          <span className="combobox__display combobox__display--placeholder">
            {t['invoice_client_account_pick'] ?? '— Select account —'}
          </span>
        )}
        <span className="combobox__chevron">
          <Icon name="chevron-down" size={14} />
        </span>
      </div>

      {open && (
        <div className="combobox__dropdown">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((acc) => (
              <div
                key={acc.id}
                className={`combobox__option ${acc.id === selectedAccountId ? 'combobox__option--selected' : ''}`}
                onClick={() => handleSelect(acc)}
              >
                <span className="combobox__option-name">{acc.bankName}</span>
                <span className="combobox__option-email">{acc.iban}</span>
              </div>
            ))
          ) : (
            <div className="combobox__empty">
              {t['account_no_matches'] ?? 'No accounts in this currency'}
            </div>
          )}
          <div
            className="combobox__option combobox__option--create"
            onClick={() => {
              setShowCreateForm(true);
              setOpen(false);
            }}
          >
            <Icon name="plus" size={14} />
            <span>{t['account_create_new'] ?? 'New bank account'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
