import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import type { DeclarationCalcState } from '@/features/declarations/hooks/useDeclarationCalc';
import type { DeclarationLocalStatus, Declaration } from '@/entities/declaration/schemas';

interface Props {
  calc: DeclarationCalcState;
  onSubmit: (notes: string, localStatus: DeclarationLocalStatus) => Promise<void>;
  onBack: () => void;
  /** The declaration being edited (for sync state checks) */
  editDeclaration?: Declaration;
}

const ESERVICES_URL = 'https://eservices.rs.ge';

export function DeclarationStep3({ calc, onSubmit, onBack, editDeclaration }: Props) {
  const t = useT();
  const { period, fields, notes, setNotes, isEditMode, submittedAt } = calc;
  const [saving, setSaving] = useState(false);

  // Check if the declaration is synced with RS.GE
  const isSyncedFromRsge = !!editDeclaration?.rsgeImportedAt && editDeclaration?.rsgeSyncState !== 'unlinked';
  const hasRsgeMismatch = isSyncedFromRsge && editDeclaration?.rsgeSyncState === 'out_of_sync';

  const handleSubmit = async (localStatus: DeclarationLocalStatus) => {
    setSaving(true);
    try {
      await onSubmit(notes, localStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="decl-step">
      <div className="decl-step__intro">
        <h2 className="decl-step__heading">{t['decl_step3_title']}</h2>
        <p className="decl-step__hint">{t['decl_step3_hint']}</p>
      </div>

      {/* Summary card */}
      <div className="decl-summary-card">
        <div className="decl-summary-row">
          <span>{t['decl_period']}</span>
          <strong>{period}</strong>
        </div>
        <div className="decl-summary-row">
          <span>{t['decl_field17']}</span>
          <strong className="amount">₾{fields.field17.toFixed(2)}</strong>
        </div>
        <div className="decl-summary-row decl-summary-row--tax">
          <span>{t['decl_tax_due']}</span>
          <strong className="amount">₾{fields.field19.toFixed(2)}</strong>
        </div>
        {submittedAt && (
          <div className="decl-summary-row">
            <span>{t['decl_submission_date']}</span>
            <strong>{submittedAt}</strong>
          </div>
        )}
      </div>

      {/* RS.GE reference data (if synced) */}
      {isSyncedFromRsge && editDeclaration && (
        <div className={`decl-summary-card ${hasRsgeMismatch ? 'decl-card--danger' : ''}`}>
          <div className="decl-summary-row">
            <span>{t['rsge_mismatch_rsge_income']}</span>
            <strong className="amount">₾{editDeclaration.rsgeIncome.toFixed(2)}</strong>
          </div>
          <div className="decl-summary-row">
            <span>{t['rsge_mismatch_rsge_tax']}</span>
            <strong className="amount">₾{editDeclaration.rsgeTax.toFixed(2)}</strong>
          </div>
          {hasRsgeMismatch && (
            <div className="decl-summary-row" style={{ color: '#d97706', fontWeight: 500, fontSize: 13 }}>
              <Icon name="alert-triangle" size={14} />
              <span style={{ marginLeft: 4 }}>{t['rsge_mismatch_action']}</span>
            </div>
          )}
          <div className="decl-summary-row">
            <span>{t['rsge_imported_at']}</span>
            <strong>{editDeclaration.rsgeImportedAt}</strong>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="decl-instructions">
        <h3 className="decl-instr-title">{t['decl_instructions_title']}</h3>
        <ol className="decl-instr-list">
          <li>{t['decl_instr_1']}</li>
          <li>{t['decl_instr_2']}</li>
          <li>{t['decl_instr_3']}</li>
          <li>
            {t['decl_instr_4_pre']} <strong>{t['decl_instr_mb']}</strong> {t['decl_instr_4_post']}
          </li>
          <li>
            {t['decl_instr_5_pre']}{' '}
            <strong>(15) ₾{fields.field15.toFixed(2)}</strong>,{' '}
            <strong>(17) ₾{fields.field17.toFixed(2)}</strong>
            {fields.field18 > 0 && <>, <strong>(18) ₾{fields.field18.toFixed(2)}</strong></>}
          </li>
          <li>{t['decl_instr_6']} <strong>₾{fields.field19.toFixed(2)}</strong></li>
        </ol>

        <a
          href={ESERVICES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="decl-rs-link"
        >
          <Icon name="external-link" size={15} />
          {t['decl_open_rsge']}
        </a>
      </div>

      {/* Notes */}
      <div className="decl-field-group">
        <label className="decl-label" htmlFor="decl-notes">{t['decl_notes']}</label>
        <textarea
          id="decl-notes"
          className="decl-notes"
          rows={3}
          placeholder={t['decl_notes_placeholder']}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions — Two buttons: Save Draft / Save as Submitted */}
      <div className="decl-step__actions decl-step__actions--dual">
        <Button variant="ghost" onClick={onBack} disabled={saving}>{t['decl_back']}</Button>
        <div className="decl-action-group">
          <Button
            variant="ghost"
            onClick={() => handleSubmit('draft')}
            disabled={saving}
          >
            {saving ? <Icon name="loader" size={16} /> : <Icon name="file-text" size={16} />}
            {isEditMode ? t['decl_update_draft'] : t['decl_save_draft']}
          </Button>
          <Button onClick={() => handleSubmit('submitted')} disabled={saving}>
            {saving ? <Icon name="loader" size={16} /> : <Icon name="check-circle" size={16} />}
            {isEditMode ? t['decl_update_submitted'] : t['decl_save_submitted']}
          </Button>
        </div>
      </div>
    </div>
  );
}
