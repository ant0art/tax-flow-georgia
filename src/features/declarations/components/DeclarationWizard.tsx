import React, { useState, useCallback, useEffect } from 'react';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import { useDeclarationCalc } from '@/features/declarations/hooks/useDeclarationCalc';
import { useDeclarations } from '@/features/declarations/hooks/useDeclarations';
import { DeclarationStep1 } from './DeclarationStep1';
import { DeclarationStep2 } from './DeclarationStep2';
import { DeclarationStep3 } from './DeclarationStep3';
import type { Declaration, DeclarationLocalStatus } from '@/entities/declaration/schemas';
import './DeclarationWizard.css';

const STEPS = 3;

interface DeclarationWizardProps {
  onClose: () => void;
  /** Pass an existing declaration to enter EDIT mode */
  editDeclaration?: Declaration;
  /** 1-indexed row number in the Sheet (required for update) */
  editRowIndex?: number;
  /** RS.GE temp token for draft operations (null if not connected) */
  rsgeTempToken?: string | null;
}

export function DeclarationWizard({ onClose, editDeclaration, editRowIndex, rsgeTempToken }: DeclarationWizardProps) {
  const t = useT();
  const [step, setStep] = useState(1);
  const calc = useDeclarationCalc();
  const { declarations, addDeclaration, updateDeclaration } = useDeclarations();

  // Initialize calc state from existing declaration in EDIT mode
  useEffect(() => {
    if (editDeclaration) {
      calc.initFromDeclaration(editDeclaration);
    }
    // Only on mount — ignoring calc dep to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDeclaration]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  // Periods already used by other declarations (for uniqueness check)
  const existingPeriods = declarations
    .filter((d) => !editDeclaration || d.id !== editDeclaration.id)
    .map((d) => d.period);

  const handleSubmit = useCallback(async (notes: string, localStatus: DeclarationLocalStatus) => {
    const today = new Date().toISOString().split('T')[0];

    // Collect selected transaction IDs for persistence
    const txIds = calc.selectedIds.size === 0
      ? '' // empty means "all"
      : Array.from(calc.selectedIds).filter((id) => id !== '__none__').join(',');

    const data: Declaration = {
      id: editDeclaration?.id ?? crypto.randomUUID(),
      period: calc.period,
      field15: calc.fields.field15,
      field16: calc.fields.field16,
      field17: calc.fields.field17,
      field18: calc.fields.field18,
      field19: calc.fields.field19,
      field21: calc.fields.field21,
      localStatus,
      submittedAt: calc.submittedAt,
      paidAt: editDeclaration?.paidAt ?? '',
      notes,
      createdAt: editDeclaration?.createdAt ?? today,
      updatedAt: today,
      transactionIds: txIds,
      rsgeSeqNum: editDeclaration?.rsgeSeqNum ?? '',
      rsgeDocNum: editDeclaration?.rsgeDocNum ?? '',
      rsgeSyncState: editDeclaration?.rsgeSyncState ?? 'unlinked',
      rsgeSyncedHash: editDeclaration?.rsgeSyncedHash ?? '',
      rsgeIncome: editDeclaration?.rsgeIncome ?? 0,
      rsgeTax: editDeclaration?.rsgeTax ?? 0,
      rsgeCumulativeIncome: editDeclaration?.rsgeCumulativeIncome ?? 0,
      rsgeStatusText: editDeclaration?.rsgeStatusText ?? '',
      rsgeImportedAt: editDeclaration?.rsgeImportedAt ?? '',
    };

    if (editDeclaration && editRowIndex) {
      await updateDeclaration({ data, rowIndex: editRowIndex });
    } else {
      await addDeclaration(data);
    }
    onClose();
  }, [calc, editDeclaration, editRowIndex, addDeclaration, updateDeclaration, onClose]);

  const title = calc.isEditMode ? t['decl_edit_title'] : t['decl_wizard_title'];

  return (
    <div className="decl-wizard">
      {/* Header */}
      <div className="decl-wizard__header">
        <button className="decl-wizard__close" onClick={onClose} type="button" aria-label="Close">
          <Icon name="x" size={18} />
        </button>
        <div className="decl-wizard__title">
          <Icon name={calc.isEditMode ? 'edit' : 'file-check'} size={20} />
          <span>{title}</span>
        </div>

        {/* Step indicator */}
        <div className="decl-wizard__steps" role="progressbar" aria-valuenow={step} aria-valuemax={STEPS}>
          {Array.from({ length: STEPS }, (_, i) => (
            <React.Fragment key={i}>
              <div className={`decl-step-dot ${step > i + 1 ? 'decl-step-dot--done' : ''} ${step === i + 1 ? 'decl-step-dot--active' : ''}`}>
                {step > i + 1 ? <Icon name="check" size={10} /> : i + 1}
              </div>
              {i < STEPS - 1 && <div className={`decl-step-line ${step > i + 1 ? 'decl-step-line--done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="decl-wizard__body">
        {step === 1 && <DeclarationStep1 calc={calc} onNext={next} existingPeriods={existingPeriods} editDeclaration={editDeclaration} />}
        {step === 2 && <DeclarationStep2 calc={calc} onNext={next} onBack={prev} />}
        {step === 3 && <DeclarationStep3 calc={calc} onSubmit={handleSubmit} onBack={prev} editDeclaration={editDeclaration} rsgeTempToken={rsgeTempToken ?? null} />}
      </div>
    </div>
  );
}
