import { useState, useCallback } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import {
  rsgeDraftCreate,
  rsgeDraftSave,
  rsgeDraftGet,
  rsgeDraftList,
  rsgeDraftSubmit,
} from '@/shared/api/rsge-client';
import type { RsgeDraftSubmitResponse, DraftFields } from '@/shared/api/rsge-client';
import type { DeclarationCalcState } from '@/features/declarations/hooks/useDeclarationCalc';
import type { DeclarationLocalStatus, Declaration } from '@/entities/declaration/schemas';
import { periodToRsge, computeSyncHash } from '@/features/declarations/lib/rsge-field-mapper';

interface Props {
  calc: DeclarationCalcState;
  onSubmit: (notes: string, localStatus: DeclarationLocalStatus, rsgeUpdates?: Partial<Declaration>) => Promise<void>;
  onBack: () => void;
  editDeclaration?: Declaration;
  rsgeTempToken: string | null;
}

const ESERVICES_URL = 'https://eservices.rs.ge';

type RsgePipelineStage = 'idle' | 'checking' | 'saving_draft' | 'draft_saved' | 'confirming_submit' | 'submitting' | 'submitted';

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

/** Compact inline SVG icon for local save zone (aligned with title) */
function LocalSaveIcon() {
  return (
    <svg className="s3-local-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

/** Tooltip icon — wraps info in native title attr */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="s3-infotip" title={text}>
      <Icon name="info" size={13} />
    </span>
  );
}

export function DeclarationStep3({ calc, onSubmit, onBack, editDeclaration, rsgeTempToken }: Props) {
  const t = useT();
  const { period, fields, notes, setNotes, isEditMode, submittedAt } = calc;
  const [saving, setSaving] = useState(false);

  // Notes collapsed
  const [notesOpen, setNotesOpen] = useState(!!notes);

  // Instructions collapsed state (collapsed if RS.GE connected)
  const [instructionsOpen, setInstructionsOpen] = useState(!rsgeTempToken);

  // RS.GE Pipeline
  const [pipeStage, setPipeStage] = useState<RsgePipelineStage>('idle');
  const [pipeError, setPipeError] = useState<string | null>(null);
  const [autoFill, setAutoFill] = useState(true);
  const [draftSeqNum, setDraftSeqNum] = useState<number | null>(
    editDeclaration?.rsgeSeqNum ? Number(editDeclaration.rsgeSeqNum) : null,
  );
  const [savedFields, setSavedFields] = useState<DraftFields | null>(null);
  const [autoFillApplied, setAutoFillApplied] = useState<boolean | null>(null);
  const [existingDraftFound, setExistingDraftFound] = useState(false);

  // RS.GE submit modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<RsgeDraftSubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasRsgeConnection = !!rsgeTempToken;
  const hasDraft = !!draftSeqNum;

  // — Local save —
  const handleLocalSave = async (localStatus: DeclarationLocalStatus) => {
    setSaving(true);
    try {
      await onSubmit(notes, localStatus);
    } finally {
      setSaving(false);
    }
  };

  // — RS.GE Pipeline: Step 1 → Send Draft —
  const handleSendDraft = useCallback(async () => {
    if (!rsgeTempToken) return;
    setPipeError(null);
    setPipeStage('checking');
    setExistingDraftFound(false);

    try {
      const rsgePeriod = periodToRsge(period);
      let seqNum = draftSeqNum;

      if (!seqNum) {
        const list = await rsgeDraftList(rsgeTempToken, rsgePeriod);
        const existing = list.declarations?.find((d) => Number(d.STATUS) === 0);

        if (existing) {
          seqNum = existing.SEQ_NUM;
          setExistingDraftFound(true);
        } else {
          const created = await rsgeDraftCreate(rsgeTempToken, rsgePeriod);
          if (!created.ok || !created.seq_num) throw new Error('Failed to create draft on RS.GE');
          seqNum = created.seq_num;
        }
        setDraftSeqNum(seqNum);
      }

      setPipeStage('saving_draft');
      const saved = await rsgeDraftSave(rsgeTempToken, seqNum, {
        ytdIncome: fields.field15.toFixed(2),
        monthlyIncome: fields.field17.toFixed(2),
        deduction: fields.field18,
      }, autoFill);

      if (!saved.ok && saved.validation_error) {
        throw new Error(`RS.GE validation: ${saved.validation_error}`);
      }

      const getResult = await rsgeDraftGet(rsgeTempToken, seqNum);
      if (getResult.ok && getResult.draft) {
        setSavedFields(getResult.draft.fields);
        const serverYtd = parseFloat(getResult.draft.fields.ytdIncome || '0');
        setAutoFillApplied(Math.abs(serverYtd - fields.field15) > 0.01);
      } else {
        setSavedFields(saved.saved_fields);
        setAutoFillApplied(null);
      }

      setPipeStage('draft_saved');
    } catch (err) {
      setPipeError(err instanceof Error ? err.message : 'Failed to send draft');
      setPipeStage('idle');
    }
  }, [rsgeTempToken, period, draftSeqNum, fields, autoFill]);

  const handleOpenSubmitModal = useCallback(() => {
    setSubmitResult(null);
    setSubmitError(null);
    setSubmitProgress(null);
    setShowSubmitModal(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (!rsgeTempToken || !draftSeqNum) return;
    setSubmitProgress('loading');
    setSubmitError(null);

    try {
      const rsgePeriod = periodToRsge(period);
      const result = await rsgeDraftSubmit(rsgeTempToken, draftSeqNum, rsgePeriod);

      if (result.ok) {
        setSubmitResult(result);
        setSubmitProgress(null);
        setPipeStage('submitted');

        const syncHash = editDeclaration ? computeSyncHash(editDeclaration) : '';
        await onSubmit(notes, 'submitted', {
          rsgeSeqNum: String(draftSeqNum),
          rsgeDocNum: result.registration_num || '',
          rsgeSyncState: 'linked',
          rsgeSyncedHash: syncHash,
          rsgeStatusText: 'submitted',
          submittedAt: result.submitted_at || new Date().toISOString().split('T')[0],
        });
      } else {
        setSubmitError(result.message || result.error || t['rsge_submit_error']);
        setSubmitProgress(null);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t['rsge_submit_error']);
      setSubmitProgress(null);
    }
  }, [rsgeTempToken, draftSeqNum, period, t, notes, onSubmit, editDeclaration]);

  return (
    <div className="decl-step s3">
      {/* ═══════ Summary Strip ═══════ */}
      <div className="s3-summary">
        <div className="s3-summary__pill">
          <span className="s3-summary__label">{t['decl_period']}</span>
          <span className="s3-summary__value">{period}</span>
        </div>
        <div className="s3-summary__sep" />
        <div className="s3-summary__pill">
          <span className="s3-summary__label">{t['decl_field17']}</span>
          <span className="s3-summary__value">₾{fields.field17.toFixed(2)}</span>
        </div>
        <div className="s3-summary__sep" />
        <div className="s3-summary__pill s3-summary__pill--accent">
          <span className="s3-summary__label">{t['decl_tax_due']}</span>
          <span className="s3-summary__value">₾{fields.field19.toFixed(2)}</span>
        </div>
      </div>

      {/* ═══════ ZONE A: Local Save ═══════ */}
      <div className="s3-card s3-card--local">
        <h3 className="s3-card__title">
          <LocalSaveIcon />
          {t['decl_zone_local_title']}
          <InfoTip text={t['decl_zone_local_hint']} />
        </h3>
        <div className="s3-card__btns">
          <button
            type="button"
            className="s3-btn s3-btn--ghost"
            onClick={() => handleLocalSave('draft')}
            disabled={saving}
          >
            {saving ? <Icon name="loader" size={15} /> : <Icon name="file-text" size={15} />}
            <span>{isEditMode ? t['decl_update_draft'] : t['decl_save_draft']}</span>
          </button>
          <button
            type="button"
            className="s3-btn s3-btn--ghost"
            onClick={() => handleLocalSave('submitted')}
            disabled={saving}
          >
            {saving ? <Icon name="loader" size={15} /> : <Icon name="check-circle" size={15} />}
            <span>{t['decl_save_submitted']}</span>
            <InfoTip text={t['decl_local_save_warning']} />
          </button>
        </div>

        {/* Collapsible notes */}
        {!notesOpen ? (
          <button type="button" className="s3-add-notes" onClick={() => setNotesOpen(true)}>
            <Icon name="plus" size={12} />
            <span>{t['decl_notes']}</span>
          </button>
        ) : (
          <textarea
            id="decl-notes"
            className="s3-notes"
            rows={2}
            placeholder={t['decl_notes_placeholder']}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {/* ═══════ ZONE B: RS.GE Pipeline ═══════ */}
      {hasRsgeConnection && (
        <div className="s3-card s3-card--rsge">
          <h3 className="s3-card__title s3-card__title--rsge">
            <Icon name="send" size={16} />
            {t['decl_zone_rsge_title']}
          </h3>

          {/* Error */}
          {pipeError && (
            <div className="s3-alert s3-alert--error">
              <Icon name="alert-circle" size={14} />
              <span>{pipeError}</span>
              <button type="button" onClick={() => setPipeError(null)} className="s3-alert__x">
                <Icon name="x" size={12} />
              </button>
            </div>
          )}

          {/* ── Step 1: Send Draft ── */}
          {(pipeStage === 'idle' || pipeStage === 'checking' || pipeStage === 'saving_draft') && (
            <div className="s3-pipe">
              <div className="s3-pipe__head">
                <span className="s3-pipe__num">1</span>
                <strong>{t['rsge_pipe_step1_title']}</strong>
              </div>

              {existingDraftFound && (
                <div className="s3-alert s3-alert--info">
                  <Icon name="info" size={13} />
                  <span>{t['rsge_pipe_draft_exists']}</span>
                </div>
              )}

              {/* Auto-fill toggle switch */}
              <label className="s3-toggle">
                <div className="s3-toggle__track" data-on={autoFill}>
                  <input
                    type="checkbox"
                    checked={autoFill}
                    onChange={(e) => setAutoFill(e.target.checked)}
                    disabled={pipeStage !== 'idle'}
                  />
                  <span className="s3-toggle__thumb" />
                </div>
                <span className="s3-toggle__text">
                  {t['rsge_pipe_auto_fill_label']}
                  <InfoTip text={t['rsge_pipe_auto_fill_hint']} />
                </span>
              </label>

              <button
                type="button"
                className="s3-btn s3-btn--primary s3-btn--full"
                onClick={handleSendDraft}
                disabled={pipeStage !== 'idle'}
              >
                {(pipeStage === 'checking' || pipeStage === 'saving_draft') ? (
                  <>
                    <Icon name="loader" size={16} />
                    <span>{pipeStage === 'checking' ? t['rsge_pipe_step1_checking'] : t['rsge_pipe_step1_saving']}</span>
                  </>
                ) : (
                  <>
                    <Icon name="upload-cloud" size={16} />
                    <span>{hasDraft ? t['rsge_pipe_step1_btn_update'] : t['rsge_pipe_step1_btn']}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Step 2: Draft Saved — Review ── */}
          {(pipeStage === 'draft_saved' || pipeStage === 'confirming_submit') && (
            <div className="s3-pipe s3-pipe--ok">
              <div className="s3-pipe__head">
                <span className="s3-pipe__num s3-pipe__num--done"><Icon name="check" size={11} /></span>
                <div>
                  <strong>{t['rsge_pipe_step2_title']}</strong>
                  <span className="s3-pipe__sub">#{draftSeqNum}</span>
                </div>
              </div>

              {autoFillApplied !== null && (
                <div className={`s3-alert ${autoFillApplied ? 's3-alert--success' : 's3-alert--warning'}`}>
                  <Icon name={autoFillApplied ? 'check-circle' : 'info'} size={13} />
                  <span>{autoFillApplied ? t['rsge_pipe_auto_fill_applied'] : t['rsge_pipe_auto_fill_not_applied']}</span>
                </div>
              )}

              {savedFields && (
                <div className="s3-compare">
                  <div className="s3-compare__row s3-compare__row--head">
                    <span>{t['rsge_pipe_field']}</span>
                    <span>{t['rsge_pipe_our_value']}</span>
                    <span>{t['rsge_pipe_server_value']}</span>
                  </div>
                  <div className="s3-compare__row">
                    <span>(15) YTD</span>
                    <span>₾{fields.field15.toFixed(2)}</span>
                    <span>₾{savedFields.ytdIncome || '—'}</span>
                  </div>
                  <div className="s3-compare__row">
                    <span>(17)</span>
                    <span>₾{fields.field17.toFixed(2)}</span>
                    <span>₾{savedFields.monthlyIncome || '—'}</span>
                  </div>
                  {savedFields.calculatedTax && (
                    <div className="s3-compare__row s3-compare__row--hl">
                      <span>Tax</span>
                      <span>₾{fields.field19.toFixed(2)}</span>
                      <span>₾{savedFields.calculatedTax}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="s3-pipe__foot">
                <button type="button" className="s3-btn s3-btn--ghost s3-btn--sm" onClick={() => { setPipeStage('idle'); setSavedFields(null); }}>
                  <Icon name="edit" size={13} />
                  <span>{t['rsge_pipe_step1_btn_update']}</span>
                </button>
                <button type="button" className="s3-btn s3-btn--danger s3-btn--full" onClick={handleOpenSubmitModal}>
                  <Icon name="send" size={15} />
                  <span>{t['rsge_pipe_proceed_submit']}</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Submitted ── */}
          {pipeStage === 'submitted' && submitResult?.ok && (
            <div className="s3-pipe s3-pipe--final">
              <Icon name="check-circle" size={24} />
              <div className="s3-pipe__result">
                <strong>{t['rsge_submit_success']}</strong>
                {submitResult.registration_num && (
                  <span>{t['rsge_submit_reg_num']}: {submitResult.registration_num}</span>
                )}
                {submitResult.submitted_at && <span>{submitResult.submitted_at}</span>}
                <span className="s3-pipe__result-tax">₾{submitResult.tax_amount}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ ZONE C: Instructions (collapsible) ═══════ */}
      <button
        type="button"
        className="s3-instr-toggle"
        onClick={() => setInstructionsOpen(!instructionsOpen)}
      >
        <Icon name="book-open" size={14} />
        <span>{hasRsgeConnection ? t['decl_instructions_collapsed'] : t['decl_instructions_title']}</span>
        <Icon name={instructionsOpen ? 'chevron-up' : 'chevron-down'} size={13} />
      </button>

      {instructionsOpen && (
        <div className="decl-instructions">
          <ol className="decl-instr-list">
            <li>{t['decl_instr_1']}</li>
            <li>{t['decl_instr_2']}</li>
            <li>{t['decl_instr_3']}</li>
            <li>
              {t['decl_instr_4_pre']} <strong>{t['decl_instr_mb']}</strong> {t['decl_instr_4_post']}
            </li>
            <li>
              {t['decl_instr_5_pre']}{' '}
              <strong>(15) ₾{fields.field15.toFixed(2)}</strong>
              <InfoTip text={t['decl_field15_tooltip']} />,{' '}
              <strong>(17) ₾{fields.field17.toFixed(2)}</strong>
              <InfoTip text={t['decl_field17_tooltip']} />
              {fields.field18 > 0 && <>, <strong>(18) ₾{fields.field18.toFixed(2)}</strong><InfoTip text={t['decl_field18_tooltip']} /></>}
            </li>
            <li>{t['decl_instr_6']} <strong>₾{fields.field19.toFixed(2)}</strong></li>
          </ol>
          <a href={ESERVICES_URL} target="_blank" rel="noopener noreferrer" className="decl-rs-link">
            <Icon name="external-link" size={15} />
            {t['decl_open_rsge']}
          </a>
        </div>
      )}

      {/* ═══════ Bottom Bar ═══════ */}
      <div className="s3-footer">
        <div className="s3-footer__spacer" />
        <button type="button" className="s3-btn s3-btn--back" onClick={onBack} disabled={saving}>
          <Icon name="arrow-left" size={16} />
          <span>{t['decl_back']}</span>
        </button>
      </div>

      {/* ═══════ Submit Confirmation Modal ═══════ */}
      {showSubmitModal && (
        <div className="decl-modal-overlay" onClick={() => !submitProgress && setShowSubmitModal(false)}>
          <div className="decl-modal decl-modal--submit" onClick={(e) => e.stopPropagation()}>
            <div className="decl-modal__header decl-modal__header--danger">
              <Icon name="alert-triangle" size={20} />
              <h3>{t['rsge_submit_confirm_title']}</h3>
            </div>

            {submitProgress && (
              <div className="decl-modal__progress">
                <Icon name="loader" size={18} />
                <span>{t[STEP_LABELS[submitProgress] as keyof typeof t] || t['rsge_submit_progress']}</span>
              </div>
            )}

            {submitError && (
              <div className="decl-modal__error">
                <Icon name="alert-circle" size={16} />
                <span>{submitError}</span>
              </div>
            )}

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
                  <div className="decl-modal__row">
                    <span>{t['rsge_pipe_draft_number']}</span>
                    <strong>#{draftSeqNum}</strong>
                  </div>
                </div>

                <div className="decl-modal__disclaimer">
                  <Icon name="shield" size={14} />
                  <p>{t['rsge_submit_disclaimer']}</p>
                </div>

                <div className="decl-modal__actions">
                  <Button variant="ghost" onClick={() => setShowSubmitModal(false)} disabled={!!submitProgress}>
                    {t['rsge_submit_cancel']}
                  </Button>
                  <button type="button" className="decl-rsge-confirm-btn" onClick={handleConfirmSubmit} disabled={!!submitProgress}>
                    <Icon name="send" size={14} />
                    {t['rsge_submit_final_confirm']}
                  </button>
                </div>
              </>
            )}

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
