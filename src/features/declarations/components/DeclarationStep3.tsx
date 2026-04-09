import { useState, useCallback } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import { rsgeDraftSubmit } from '@/shared/api/rsge-client';
import type { RsgeDraftSubmitResponse } from '@/shared/api/rsge-client';
import type { DeclarationCalcState } from '@/features/declarations/hooks/useDeclarationCalc';
import type { DeclarationLocalStatus, Declaration } from '@/entities/declaration/schemas';

interface Props {
  calc: DeclarationCalcState;
  onSubmit: (notes: string, localStatus: DeclarationLocalStatus) => Promise<void>;
  onBack: () => void;
  /** The declaration being edited (for sync state checks) */
  editDeclaration?: Declaration;
  /** RS.GE temp token — null if not connected */
  rsgeTempToken: string | null;
}

const ESERVICES_URL = 'https://eservices.rs.ge';

/** Map step names from server → i18n keys */
const STEP_LABELS: Record<string, string> = {
  loading: 'rsge_submit_step_loading',
  access_check: 'rsge_submit_step_access',
  pre_validation: 'rsge_submit_step_validation',
  recalculating: 'rsge_submit_step_recalc',
  submitting: 'rsge_submit_step_submit',
  confirming: 'rsge_submit_step_confirm',
  finalizing: 'rsge_submit_step_finalize',
  verifying: 'rsge_submit_step_verify',
};

export function DeclarationStep3({ calc, onSubmit, onBack, editDeclaration, rsgeTempToken }: Props) {
  const t = useT();
  const { period, fields, notes, setNotes, isEditMode, submittedAt } = calc;
  const [saving, setSaving] = useState(false);

  // RS.GE submit states
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<RsgeDraftSubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check if the declaration is synced with RS.GE (has a draft saved)
  const isSyncedFromRsge = !!editDeclaration?.rsgeImportedAt && editDeclaration?.rsgeSyncState !== 'unlinked';
  const hasRsgeMismatch = isSyncedFromRsge && editDeclaration?.rsgeSyncState === 'out_of_sync';
  const hasRsgeDraft = !!editDeclaration?.rsgeSeqNum;
  const canSubmitToRsge = rsgeTempToken && hasRsgeDraft;

  const handleSubmit = async (localStatus: DeclarationLocalStatus) => {
    setSaving(true);
    try {
      await onSubmit(notes, localStatus);
    } finally {
      setSaving(false);
    }
  };

  // RS.GE submit handler — opens the confirmation modal
  const handleOpenSubmitModal = useCallback(() => {
    setSubmitResult(null);
    setSubmitError(null);
    setSubmitProgress(null);
    setShowSubmitModal(true);
  }, []);

  // RS.GE final submit — irreversible action
  const handleConfirmSubmit = useCallback(async () => {
    if (!rsgeTempToken || !editDeclaration?.rsgeSeqNum) return;

    setSubmitProgress('loading');
    setSubmitError(null);

    try {
      // Convert period from "YYYY-MM" to "YYYYMM"
      const rsgePeriod = editDeclaration.rsgeSeqNum
        ? period.replace('-', '')
        : '';

      const result = await rsgeDraftSubmit(
        rsgeTempToken,
        Number(editDeclaration.rsgeSeqNum),
        rsgePeriod,
      );

      if (result.ok) {
        setSubmitResult(result);
        setSubmitProgress(null);
      } else {
        setSubmitError(result.message || result.error || t['rsge_submit_error']);
        setSubmitProgress(null);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t['rsge_submit_error']);
      setSubmitProgress(null);
    }
  }, [rsgeTempToken, editDeclaration, period, t]);

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

      {/* RS.GE Direct Submit Button */}
      {canSubmitToRsge && (
        <div className="decl-rsge-submit-section">
          <div className="decl-rsge-submit-divider">
            <span>{t['rsge_submit_btn']}</span>
          </div>

          {!submitResult && (
            <button
              type="button"
              className="decl-rsge-submit-btn"
              onClick={handleOpenSubmitModal}
              disabled={!!submitProgress}
            >
              <Icon name="send" size={16} />
              <span>{t['rsge_submit_btn']}</span>
              <span className="decl-rsge-submit-badge">RS.GE #{editDeclaration?.rsgeSeqNum}</span>
            </button>
          )}

          {/* Success result */}
          {submitResult && submitResult.ok && (
            <div className="decl-rsge-submit-result decl-rsge-submit-result--success">
              <Icon name="check-circle" size={20} />
              <div className="decl-rsge-submit-result__body">
                <strong>{t['rsge_submit_success']}</strong>
                {submitResult.registration_num && (
                  <span>{t['rsge_submit_reg_num']}: {submitResult.registration_num}</span>
                )}
                {submitResult.submitted_at && (
                  <span>{submitResult.submitted_at}</span>
                )}
                <span>₾{submitResult.tax_amount}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No draft hint */}
      {rsgeTempToken && !hasRsgeDraft && (
        <div className="decl-rsge-submit-hint">
          <Icon name="info" size={14} />
          <span>{t['rsge_submit_no_draft']}</span>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="decl-modal-overlay" onClick={() => !submitProgress && setShowSubmitModal(false)}>
          <div className="decl-modal decl-modal--submit" onClick={(e) => e.stopPropagation()}>
            <div className="decl-modal__header decl-modal__header--danger">
              <Icon name="alert-triangle" size={20} />
              <h3>{t['rsge_submit_confirm_title']}</h3>
            </div>

            {/* Progress state */}
            {submitProgress && (
              <div className="decl-modal__progress">
                <Icon name="loader" size={18} />
                <span>{t[STEP_LABELS[submitProgress] as keyof typeof t] || t['rsge_submit_progress']}</span>
              </div>
            )}

            {/* Error state */}
            {submitError && (
              <div className="decl-modal__error">
                <Icon name="alert-circle" size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Confirmation content (only shown before submit) */}
            {!submitProgress && !submitResult?.ok && (
              <>
                <p className="decl-modal__desc">{t['rsge_submit_confirm_desc']}</p>

                <div className="decl-modal__summary">
                  <div className="decl-modal__row">
                    <span>{t['rsge_submit_confirm_period']}</span>
                    <strong>{period}</strong>
                  </div>
                  <div className="decl-modal__row">
                    <span>{t['rsge_submit_confirm_income']}</span>
                    <strong>₾{fields.field17.toFixed(2)}</strong>
                  </div>
                  <div className="decl-modal__row">
                    <span>{t['rsge_submit_confirm_ytd']}</span>
                    <strong>₾{fields.field15.toFixed(2)}</strong>
                  </div>
                  <div className="decl-modal__row decl-modal__row--highlight">
                    <span>{t['rsge_submit_confirm_tax']}</span>
                    <strong>₾{fields.field19.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="decl-modal__disclaimer">
                  <Icon name="shield" size={14} />
                  <p>{t['rsge_submit_disclaimer']}</p>
                </div>

                <div className="decl-modal__actions">
                  <Button
                    variant="ghost"
                    onClick={() => setShowSubmitModal(false)}
                    disabled={!!submitProgress}
                  >
                    {t['rsge_submit_cancel']}
                  </Button>
                  <button
                    type="button"
                    className="decl-rsge-confirm-btn"
                    onClick={handleConfirmSubmit}
                    disabled={!!submitProgress}
                  >
                    <Icon name="send" size={14} />
                    {t['rsge_submit_final_confirm']}
                  </button>
                </div>
              </>
            )}

            {/* Success state inside modal */}
            {submitResult?.ok && (
              <div className="decl-modal__success">
                <Icon name="check-circle" size={32} />
                <h4>{t['rsge_submit_success']}</h4>
                {submitResult.registration_num && (
                  <p>{t['rsge_submit_reg_num']}: <strong>{submitResult.registration_num}</strong></p>
                )}
                <div className="decl-modal__actions">
                  <Button onClick={() => setShowSubmitModal(false)}>OK</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
