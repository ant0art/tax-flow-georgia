import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import type { Declaration } from '@/entities/declaration/schemas';

interface SyncConfirmDialogProps {
  declaration: Declaration;
  mode: 'push' | 'resync' | 'unlink';
  onConfirm: (options?: { deleteDraft?: boolean }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SyncConfirmDialog({
  declaration,
  mode,
  onConfirm,
  onCancel,
  loading = false,
}: SyncConfirmDialogProps) {
  const t = useT();
  const [deleteDraft, setDeleteDraft] = useState(false);

  const titleKey = {
    push: 'rsge_sync_confirm_push_title',
    resync: 'rsge_sync_confirm_resync_title',
    unlink: 'rsge_sync_confirm_unlink_title',
  }[mode] as keyof typeof t;

  const descKey = {
    push: 'rsge_sync_confirm_push_desc',
    resync: 'rsge_sync_confirm_resync_desc',
    unlink: 'rsge_sync_confirm_unlink_desc',
  }[mode] as keyof typeof t;

  const confirmKey = {
    push: 'rsge_sync_push',
    resync: 'rsge_sync_resync',
    unlink: 'rsge_sync_unlink',
  }[mode] as keyof typeof t;

  const iconName = {
    push: 'upload-cloud' as const,
    resync: 'refresh-cw' as const,
    unlink: 'link-2' as const,
  }[mode];

  return (
    <div className="decl-sync-overlay" onClick={onCancel}>
      <div className="decl-sync-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="decl-sync-dialog__header">
          <Icon name={iconName} size={20} />
          <h3>{t[titleKey] || titleKey}</h3>
        </div>

        {/* Description */}
        <p className="decl-sync-dialog__desc">{t[descKey] || descKey}</p>

        {/* Summary card */}
        <div className="decl-sync-dialog__summary">
          <div className="decl-sync-dialog__row">
            <span>{t['decl_period']}</span>
            <strong>{declaration.period}</strong>
          </div>
          <div className="decl-sync-dialog__row">
            <span>{t['decl_field17']}</span>
            <strong>₾{declaration.field17.toFixed(2)}</strong>
          </div>
          <div className="decl-sync-dialog__row">
            <span>{t['decl_field15']}</span>
            <strong>₾{declaration.field15.toFixed(2)}</strong>
          </div>
          <div className="decl-sync-dialog__row decl-sync-dialog__row--highlight">
            <span>{t['decl_tax_due']}</span>
            <strong>₾{declaration.field19.toFixed(2)}</strong>
          </div>
          {declaration.rsgeSeqNum && (
            <div className="decl-sync-dialog__row">
              <span>{t['rsge_sync_seq_num']}</span>
              <strong>#{declaration.rsgeSeqNum}</strong>
            </div>
          )}
        </div>

        {/* Warning */}
        {mode === 'push' && (
          <div className="decl-sync-dialog__warning">
            <Icon name="alert-triangle" size={14} />
            <span>{t['rsge_sync_push_warning']}</span>
          </div>
        )}

        {/* Unlink option: also delete RS.GE draft? */}
        {mode === 'unlink' && declaration.rsgeSeqNum && (
          <label className="decl-sync-dialog__checkbox">
            <input
              type="checkbox"
              checked={deleteDraft}
              onChange={(e) => setDeleteDraft(e.target.checked)}
            />
            <span>{t['rsge_sync_unlink_delete']}</span>
          </label>
        )}

        {/* Actions */}
        <div className="decl-sync-dialog__actions">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t['cancel']}
          </Button>
          <Button
            onClick={() => onConfirm(mode === 'unlink' ? { deleteDraft } : undefined)}
            loading={loading}
          >
            <Icon name={iconName} size={14} />
            {t[confirmKey] || confirmKey}
          </Button>
        </div>
      </div>
    </div>
  );
}
