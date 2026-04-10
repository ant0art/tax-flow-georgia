import { useCallback, useMemo, useState } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useDeclarations } from '@/features/declarations/hooks/useDeclarations';
import { calcDeclarationFields } from '@/features/declarations/lib/calcFields';
import type { DeclarationFields } from '@/features/declarations/lib/calcFields';
import type { TransactionFormData } from '@/entities/transaction/schemas';
import type { Declaration, DeclarationLocalStatus } from '@/entities/declaration/schemas';
import { prevMonth } from '@/entities/declaration/schemas';

export type Deduction = 0 | 3000 | 6000;

export interface DeclarationCalcState {
  period: string;
  setPeriod: (p: string) => void;
  deduction: Deduction;
  setDeduction: (d: Deduction) => void;
  selectedIds: Set<string>;
  toggleTx: (id: string) => void;
  selectAll: () => void;
  allSelected: boolean;
  monthTransactions: TransactionFormData[];
  fields: DeclarationFields;
  taxRate: number;
  submittedAt: string;
  setSubmittedAt: (d: string) => void;
  notes: string;
  setNotes: (n: string) => void;
  /** Initialize all state from an existing declaration (EDIT mode) */
  initFromDeclaration: (decl: Declaration) => void;
  /** Whether initialized for edit mode */
  isEditMode: boolean;
  editLocalStatus: DeclarationLocalStatus;
  setEditLocalStatus: (s: DeclarationLocalStatus) => void;
}

export function useDeclarationCalc(): DeclarationCalcState {
  const { transactions } = useTransactions();
  const { settings } = useSettings();
  const { declarations } = useDeclarations();
  const taxRate = settings?.taxRate ?? 0.01;

  const [period, setPeriod] = useState<string>(prevMonth());
  const [deduction, setDeduction] = useState<Deduction>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submittedAt, setSubmittedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLocalStatus, setEditLocalStatus] = useState<DeclarationLocalStatus>('draft');

  // Transactions for the selected month
  const monthTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.slice(0, 7) === period),
    [transactions, period]
  );

  // Empty selectedIds → treat as "all selected"
  // When toggling a single tx while all are selected, we first "materialize"
  // the full set, then remove the clicked item.
  const allSelected = selectedIds.size === 0;

  const toggleTx = (id: string) => {
    setSelectedIds((prev) => {
      // If set is empty (= all selected), materialize all IDs first
      if (prev.size === 0) {
        const next = new Set(monthTransactions.map((tx) => tx.id));
        next.delete(id); // uncheck the clicked one
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle: if all selected → deselect all; otherwise → select all
  const selectAll = () => {
    if (allSelected) {
      // Deselect all — use a single dummy entry so size !== 0 and no real id matches
      setSelectedIds(new Set(['__none__']));
    } else {
      setSelectedIds(new Set());
    }
  };

  const fields = useMemo(
    () => calcDeclarationFields(transactions, period, taxRate, deduction, selectedIds, declarations),
    [transactions, period, taxRate, deduction, selectedIds, declarations]
  );

  /** Initialize from an existing declaration for EDIT mode */
  const initFromDeclaration = useCallback((decl: Declaration) => {
    setIsEditMode(true);
    setPeriod(decl.period || prevMonth());
    setDeduction(decl.field18 as Deduction);
    setSubmittedAt(decl.submittedAt);
    setNotes(decl.notes);
    setEditLocalStatus(decl.localStatus);

    // Restore selected transaction IDs
    if (decl.transactionIds) {
      const ids = decl.transactionIds.split(',').filter(Boolean);
      setSelectedIds(ids.length > 0 ? new Set(ids) : new Set());
    } else {
      // No transactionIds saved → all selected
      setSelectedIds(new Set());
    }
  }, []);

  return {
    period,
    setPeriod,
    deduction,
    setDeduction,
    selectedIds,
    toggleTx,
    selectAll,
    allSelected,
    monthTransactions,
    fields,
    taxRate,
    submittedAt,
    setSubmittedAt,
    notes,
    setNotes,
    initFromDeclaration,
    isEditMode,
    editLocalStatus,
    setEditLocalStatus,
  };
}
