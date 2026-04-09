import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import { useDeclarations } from '@/features/declarations/hooks/useDeclarations';
import { useRsgeAuth } from '@/features/declarations/hooks/useRsgeAuth';
import { useRsgeDeclarations } from '@/features/declarations/hooks/useRsgeDeclarations';
import { useRsgeSync } from '@/features/declarations/hooks/useRsgeSync';
import { useRsgeImport } from '@/features/declarations/hooks/useRsgeImport';
import { DeclarationWizard } from '@/features/declarations/components/DeclarationWizard';
import { RsgeAuthPanel } from '@/features/declarations/components/RsgeAuthPanel';
import { RsgeDeclarationsList } from '@/features/declarations/components/RsgeDeclarationsList';
import { getImportStatus } from '@/features/declarations/lib/rsge-field-mapper';
import { SyncConfirmDialog } from '@/features/declarations/components/SyncConfirmDialog';
import type { Declaration } from '@/entities/declaration/schemas';
import type { IconName } from '@/shared/ui/Icon';
import { StatusMultiSelect } from '@/shared/ui/StatusMultiSelect';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import '@/features/declarations/components/DeclarationWizard.css';
import '@/features/declarations/components/RsgeAuth.css';

const MONTH_KEYS = [
  'month_jan', 'month_feb', 'month_mar', 'month_apr',
  'month_may', 'month_jun', 'month_jul', 'month_aug',
  'month_sep', 'month_oct', 'month_nov', 'month_dec',
] as const;

function formatPeriodLabel(period: string, t: Record<string, string>): string {
  const [yr, mm] = period.split('-');
  const idx = parseInt(mm, 10) - 1;
  const monthLabel = t[MONTH_KEYS[idx]] || mm;
  return `${monthLabel} ${yr}`;
}

function fmtDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  const d = dateStr.split(/[\sT]/)[0];
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

const STATUS_ICONS: Record<string, IconName> = {
  draft: 'file-text',
  submitted: 'check-circle',
  paid: 'credit-card',
};

const STATUS_ACCENT: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  paid: 'paid',
};

const DECL_STATUS_OPTIONS = [
  { value: 'draft',     labelKey: 'decl_status_draft' },
  { value: 'submitted', labelKey: 'decl_status_submitted' },
  { value: 'paid',      labelKey: 'decl_status_paid' },
];

const STATUS_FILTER_ICONS: Record<string, IconName> = {
  draft: 'file-text',
  submitted: 'check-circle',
  paid: 'credit-card',
};

export function DeclarationsPage() {
  const t = useT();
  const { declarations, isLoading, deleteDeclaration } = useDeclarations();
  const [showWizard, setShowWizard] = useState(false);
  const [editDecl, setEditDecl] = useState<Declaration | null>(null);
  const [editRowIndex, setEditRowIndex] = useState<number | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [localOpen, setLocalOpen] = useState(true);

  // ── Filter state ──
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // RS.GE integration
  const rsgeAuth = useRsgeAuth();
  const rsgeDecl = useRsgeDeclarations(rsgeAuth.tempToken);
  const rsgeSync = useRsgeSync(rsgeAuth.tempToken);
  const rsgeImport = useRsgeImport();
  const [rsgeOpen, setRsgeOpen] = useState(true);
  const [importSingleId, setImportSingleId] = useState<string | null>(null);

  // Sync dialog state
  const [syncDialog, setSyncDialog] = useState<{
    decl: Declaration;
    rowIndex: number;
    mode: 'push' | 'resync' | 'unlink';
  } | null>(null);

  const isRsgeConnected = rsgeAuth.state === 'connected';

  const handleEdit = useCallback((decl: Declaration, index: number) => {
    setEditDecl(decl);
    // rowIndex in Sheet = data row index (0-based) + 2 (header row + 1-indexed)
    setEditRowIndex(index + 2);
    setShowWizard(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setShowWizard(false);
    setEditDecl(null);
    setEditRowIndex(undefined);
  }, []);

  const handleDelete = useCallback(async (_id: string, index: number) => {
    setDeleteConfirmId(null);
    await deleteDeclaration(index + 2);
  }, [deleteDeclaration]);

  // ─── Sync handlers ─────────────────────────────────────────────────────
  const handleSyncConfirm = useCallback(async (options?: { deleteDraft?: boolean }) => {
    if (!syncDialog) return;
    const { decl, rowIndex, mode } = syncDialog;
    setSyncDialog(null);

    switch (mode) {
      case 'push':
        await rsgeSync.pushToRsge(decl, rowIndex);
        // Refresh RS.GE list after push
        rsgeDecl.refetch();
        break;
      case 'resync':
        await rsgeSync.reSyncToRsge(decl, rowIndex);
        rsgeDecl.refetch();
        break;
      case 'unlink':
        await rsgeSync.unlinkFromRsge(decl, rowIndex, options?.deleteDraft ?? false);
        if (options?.deleteDraft) rsgeDecl.refetch();
        break;
    }
  }, [syncDialog, rsgeSync, rsgeDecl]);

  // ── Single RS.GE card import ──
  const handleImportSingle = useCallback(async (decl: import('@/shared/api/rsge-client').RsgeDeclaration) => {
    const cardId = decl.UN_ID ? String(decl.UN_ID) : '0';
    setImportSingleId(cardId);
    try {
      await rsgeImport.importAll([decl]);
      // Refresh RS.GE list to reflect new link state & remove deleted drafts
      rsgeDecl.refetch();
    } finally {
      setImportSingleId(null);
    }
  }, [rsgeImport, rsgeDecl]);

  // ── RS.GE total tax for toggle header ──
  const rsgeTotalTax = useMemo(
    () => rsgeDecl.declarations.reduce((sum, d) => sum + (Number(d.DAR) || 0), 0),
    [rsgeDecl.declarations],
  );

  // ── Count importable RS.GE declarations ──
  const rsgeImportableCount = useMemo(
    () => rsgeDecl.declarations.filter((d) => {
      const s = getImportStatus(d, declarations);
      return s === 'importable' || s === 'stale';
    }).length,
    [rsgeDecl.declarations, declarations],
  );

  // ── Filter options (derived from data) ──
  const yearOptions = useMemo(() => {
    const years = new Set(declarations.map((d) => d.period.split('-')[0]));
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // newest first
  }, [declarations]);

  const monthOptions = useMemo(() =>
    [
      { value: 'all', label: t['decl_filter_all_months'] },
      ...MONTH_KEYS.map((key, idx) => ({
        value: String(idx + 1).padStart(2, '0'),
        label: t[key] || key,
      })),
    ],
    [t]
  );

  const yearFilterOptions = useMemo(() =>
    [{ value: 'all', label: t['decl_filter_all_years'] }, ...yearOptions.map((y) => ({ value: y, label: y }))],
    [t, yearOptions]
  );

  const sortOptions = useMemo(() => [
    { value: 'desc', label: t['decl_sort_newest'] },
    { value: 'asc',  label: t['decl_sort_oldest'] },
  ], [t]);

  const statusOptions = useMemo(() =>
    DECL_STATUS_OPTIONS.map((opt) => ({
      value: opt.value,
      label: t[opt.labelKey as keyof typeof t] ?? opt.value,
      icon: <Icon name={STATUS_FILTER_ICONS[opt.value] ?? 'file-text'} size={13} />,
    })),
    [t]
  );

  const hasActiveFilters = statusFilters.size > 0 || monthFilter !== 'all' || yearFilter !== 'all' || sortOrder !== 'desc';

  const resetFilters = useCallback(() => {
    setStatusFilters(new Set());
    setMonthFilter('all');
    setYearFilter('all');
    setSortOrder('desc');
  }, []);

  // ── Filtering + sorting pipeline ──
  const filteredDecls = useMemo(() => {
    let result = [...declarations];

    // Status filter
    if (statusFilters.size > 0) {
      result = result.filter((d) => statusFilters.has(d.localStatus));
    }

    // Month filter
    if (monthFilter !== 'all') {
      result = result.filter((d) => d.period.split('-')[1] === monthFilter);
    }

    // Year filter
    if (yearFilter !== 'all') {
      result = result.filter((d) => d.period.split('-')[0] === yearFilter);
    }

    // Sort by period
    result.sort((a, b) => {
      const cmp = a.period.localeCompare(b.period);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [declarations, statusFilters, monthFilter, yearFilter, sortOrder]);

  if (showWizard) {
    return (
      <DeclarationWizard
        onClose={handleCloseWizard}
        editDeclaration={editDecl ?? undefined}
        editRowIndex={editRowIndex}
        rsgeTempToken={rsgeAuth.tempToken}
      />
    );
  }

  return (
    <div className="declarations-page">
      {/* Header — matches Income/Invoice pattern */}
      <div className="declarations-page__head">
        <div className="declarations-page__toolbar">
          <h1 className="page-title declarations-page__title">
            <Icon name="file-check" size={22} />
            {t['nav_declarations']}
          </h1>
          <div className="list-header-actions">
            <Button size="sm" onClick={() => setShowWizard(true)}>
              <span className="decl-btn-full">{t['decl_new']}</span>
              <span className="decl-btn-short">{t['decl_new_short']}</span>
            </Button>
          </div>
        </div>
        <p className="declarations-page__subtitle">{t['decl_page_subtitle']}</p>
      </div>

      {/* RS.GE Auth Panel */}
      <RsgeAuthPanel
        state={rsgeAuth.state}
        error={rsgeAuth.error}
        onInitAuth={rsgeAuth.initAuth}
        onConfirmOtp={rsgeAuth.confirmOtp}
        onDisconnect={rsgeAuth.disconnect}
      />

      {/* RS.GE Declarations (collapsible) */}
      {isRsgeConnected && (
        <div className="decl-section">
          <button
            type="button"
            className="decl-section__toggle"
            onClick={() => setRsgeOpen((v) => !v)}
          >
            <Icon name={rsgeOpen ? 'chevron-down' : 'chevron-right'} size={16} />
            <span className="decl-section__title">{t['rsge_declarations_title']}</span>
            <span className="decl-section__badge">{rsgeDecl.declarations.length}</span>
            {rsgeTotalTax > 0 && (
              <span className="decl-section__tax">₾{rsgeTotalTax.toFixed(2)}</span>
            )}
          </button>
          {rsgeOpen && (
            <RsgeDeclarationsList
              state={rsgeDecl.state}
              declarations={rsgeDecl.declarations}
              error={rsgeDecl.error}
              year={rsgeDecl.year}
              onYearChange={rsgeDecl.setYear}
              onRefetch={rsgeDecl.refetch}
              localDeclarations={declarations}
              onImportSingle={handleImportSingle}
              importingId={importSingleId}
              onImportAll={rsgeImportableCount > 0 ? () => rsgeImport.importAll(rsgeDecl.declarations) : undefined}
              importing={rsgeImport.importing}
              importProgressLabel={
                rsgeImport.progress
                  ? `${t['rsge_importing']} ${rsgeImport.progress.current}/${rsgeImport.progress.total}`
                  : undefined
              }
              importResultSummary={
                rsgeImport.lastResult && !rsgeImport.importing ? (
                  <span className="rsge-import-bar__result">
                    ✓ {rsgeImport.lastResult.imported} / 🔗 {rsgeImport.lastResult.linked}
                    {rsgeImport.lastResult.relinked > 0 && (
                      <span> 🔄 {rsgeImport.lastResult.relinked}</span>
                    )}
                    {rsgeImport.lastResult.mismatched > 0 && (
                      <span className="rsge-import-bar__mismatch">
                        ⚠ {rsgeImport.lastResult.mismatched}
                      </span>
                    )}
                  </span>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      {/* Local declarations (collapsible) */}
      {isLoading ? (
        <div style={{ color: 'var(--color-text-tertiary)' }}>{t['loading']}</div>
      ) : declarations.length === 0 && !isRsgeConnected ? (
        <div className="decl-tx-empty" style={{ marginTop: 24 }}>
          <Icon name="file-check" size={36} />
          <p>{t['decl_empty']}</p>
          <p className="decl-tx-empty__sub">{t['decl_empty_hint']}</p>
          <Button size="sm" onClick={() => setShowWizard(true)}>{t['decl_new']}</Button>
        </div>
      ) : declarations.length > 0 ? (
        <div className="decl-section">
          <button
            type="button"
            className="decl-section__toggle"
            onClick={() => setLocalOpen((v) => !v)}
          >
            <Icon name={localOpen ? 'chevron-down' : 'chevron-right'} size={16} />
            <span className="decl-section__title">{t['decl_my_records']}</span>
            <span className="decl-section__badge">{filteredDecls.length}</span>
          </button>
          {localOpen && (
            <>
              {/* Filter bar (inside My Records) */}
              <div className="decl-filters">
                <StatusMultiSelect
                  value={statusFilters}
                  onChange={setStatusFilters}
                  options={statusOptions}
                  labelAll={t['decl_filter_all']}
                />
                <FilterDropdown
                  options={monthOptions}
                  value={monthFilter}
                  onChange={setMonthFilter}
                />
                <FilterDropdown
                  options={yearFilterOptions}
                  value={yearFilter}
                  onChange={setYearFilter}
                />
                <div className="decl-filter-sep" />
                <FilterDropdown
                  options={sortOptions}
                  value={sortOrder}
                  onChange={(v) => setSortOrder(v as 'desc' | 'asc')}
                />
                {hasActiveFilters && (
                  <button className="decl-filter-reset" onClick={resetFilters} title={t['filter_reset']}>
                    <Icon name="x" size={13} />
                    {t['filter_reset']}
                  </button>
                )}
                <span className="decl-filters__count">
                  {filteredDecls.length !== declarations.length
                    ? `${filteredDecls.length} / ${declarations.length}`
                    : declarations.length}
                </span>
              </div>

              {/* Empty filter state */}
              {filteredDecls.length === 0 && hasActiveFilters ? (
                <div className="decl-tx-empty">
                  <Icon name="search" size={36} />
                  <p>{t['decl_empty_filter']}</p>
                </div>
              ) : (
                <div className="decl-card-grid">
                  {filteredDecls.map((d) => {
                    const originalIndex = declarations.findIndex((x) => x.id === d.id);
                const isUnlinked = !d.rsgeSyncState || d.rsgeSyncState === 'unlinked';
                const isLinked = d.rsgeSyncState === 'linked' || d.rsgeSyncState === 'out_of_sync';
                const dirty = isLinked && rsgeSync.isDirty(d);
                const isSyncing = rsgeSync.syncingId === d.id;
                const isConfirmingDelete = deleteConfirmId === d.id;
                const accentClass = STATUS_ACCENT[d.localStatus] || 'draft';

                return (
                  <div
                    key={d.id}
                    className={`decl-card2${isConfirmingDelete ? ' decl-card2--danger' : ''}${isSyncing ? ' decl-card2--syncing' : ''}${dirty ? ' decl-card2--dirty' : ''}`}
                  >
                    <div className={`decl-card2__accent decl-card2__accent--${accentClass}`} />
                    <div className="decl-card2__body">
                      {/* Row 1: Period | Status badge */}
                      <div className="decl-card2__top">
                        <span className="decl-card2__period">
                          {formatPeriodLabel(d.period, t)}
                        </span>
                        <span className={`decl-status-badge decl-status-badge--${d.localStatus}`}>
                          <Icon name={STATUS_ICONS[d.localStatus] ?? 'file-text'} size={12} />
                          {t[`decl_status_${d.localStatus}` as keyof typeof t] ?? d.localStatus}
                        </span>
                      </div>

                      {/* Row 2: Metrics — Submitted date (left) | Tax due (right) */}
                      <div className="decl-card2__metrics">
                        <div className="decl-card2__metric">
                          <span className="decl-card2__label">{t['rsge_decl_submitted']}</span>
                          <span className="decl-card2__value">
                            {d.submittedAt ? fmtDateShort(d.submittedAt) : '—'}
                          </span>
                        </div>
                        <div className="decl-card2__metric decl-card2__metric--right">
                          <span className="decl-card2__label">{t['rsge_decl_tax']}</span>
                          <span className="decl-card2__value decl-card2__value--tax">
                            ₾{d.field19.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Footer — sync/import meta */}
                      <div className="decl-card2__footer">
                        <div className="decl-card2__meta-row">
                          {/* Income info */}
                          <span className="decl-card2__meta">
                            {t['rsge_decl_income']}: ₾{d.field17.toFixed(2)}
                          </span>

                          {/* Sync state indicator */}
                          {isLinked && (
                            <span className={`decl-card2__sync-badge decl-card2__sync-badge--${d.rsgeSyncState}`}>
                              {d.rsgeSyncState === 'linked' && !dirty && (
                                <>
                                  <Icon name="link-2" size={10} />
                                  RS.GE
                                  {d.rsgeSeqNum && <span className="decl-card2__seqnum">#{d.rsgeSeqNum}</span>}
                                </>
                              )}
                              {dirty && (
                                <>
                                  <Icon name="refresh-cw" size={10} />
                                  {t['rsge_sync_dirty']}
                                </>
                              )}
                              {d.rsgeSyncState === 'out_of_sync' && !dirty && (
                                <>
                                  <Icon name="alert-triangle" size={10} />
                                  {t['decl_sync_out_of_sync']}
                                </>
                              )}
                            </span>
                          )}
                          {d.rsgeSyncState === 'broken' && (
                            <span className="decl-card2__sync-badge decl-card2__sync-badge--broken">
                              <Icon name="alert-triangle" size={10} />
                              {t['decl_sync_broken']}
                            </span>
                          )}
                        </div>

                        {/* Imported-at (small) */}
                        {d.rsgeImportedAt && (
                          <span className="decl-card2__imported">
                            <Icon name="download" size={10} />
                            {t['rsge_imported_at']}: {fmtDateShort(d.rsgeImportedAt)}
                          </span>
                        )}
                      </div>

                      {/* Mismatch panel (expandable detail) */}
                      {d.rsgeSyncState === 'out_of_sync' && d.rsgeIncome > 0 && (
                        <div className="decl-card2__mismatch">
                          <div className="decl-card2__mismatch-title">
                            <Icon name="alert-triangle" size={12} />
                            {t['rsge_mismatch_title']}
                          </div>
                          <div className="decl-card2__mismatch-grid">
                            <span>{t['rsge_mismatch_app_income']}:</span>
                            <span className="amount">₾{d.field17.toFixed(2)}</span>
                            <span>{t['rsge_mismatch_rsge_income']}:</span>
                            <span className="amount">₾{d.rsgeIncome.toFixed(2)}</span>
                            <span>{t['rsge_mismatch_app_tax']}:</span>
                            <span className="amount">₾{d.field19.toFixed(2)}</span>
                            <span>{t['rsge_mismatch_rsge_tax']}:</span>
                            <span className="amount">₾{d.rsgeTax.toFixed(2)}</span>
                          </div>
                          <p className="decl-card2__mismatch-hint">
                            ↳ {t['rsge_mismatch_action']}
                          </p>
                        </div>
                      )}

                      {/* Syncing overlay */}
                      {isSyncing && (
                        <div className="decl-card2__syncing">
                          <Icon name="loader" size={14} />
                          <span>{t['rsge_sync_pushing']}</span>
                        </div>
                      )}

                      {/* Actions */}
                      {!isSyncing && isConfirmingDelete ? (
                        <div className="decl-card2__confirm">
                          <span>{t['decl_delete_confirm']}</span>
                          <div className="decl-card2__confirm-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              {t['cancel']}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete(d.id, originalIndex)}
                            >
                              {t['trash']}
                            </Button>
                          </div>
                        </div>
                      ) : !isSyncing ? (
                        <div className="decl-card2__actions">
                          {isUnlinked && (
                            <>
                              <button
                                type="button"
                                className="decl-card2__action"
                                onClick={() => handleEdit(d, originalIndex)}
                                title={t['decl_edit']}
                              >
                                <Icon name="edit" size={12} />
                                <span>{t['decl_edit']}</span>
                              </button>
                              {isRsgeConnected && (
                                <button
                                  type="button"
                                  className="decl-card2__action decl-card2__action--sync"
                                  onClick={() => setSyncDialog({
                                    decl: d,
                                    rowIndex: originalIndex + 2,
                                    mode: 'push',
                                  })}
                                  title={t['rsge_sync_push']}
                                >
                                  <Icon name="upload-cloud" size={12} />
                                  <span>{t['rsge_sync_push']}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="decl-card2__action decl-card2__action--danger"
                                onClick={() => setDeleteConfirmId(d.id)}
                                title={t['trash']}
                              >
                                <Icon name="trash" size={12} />
                              </button>
                            </>
                          )}

                          {isLinked && !!d.rsgeImportedAt && (
                            <>
                              {d.rsgeSyncState === 'out_of_sync' ? (
                                <button
                                  type="button"
                                  className="decl-card2__action"
                                  onClick={() => handleEdit(d, originalIndex)}
                                  title={t['rsge_synced_partial_edit']}
                                >
                                  <Icon name="edit" size={12} />
                                  <span>{t['decl_edit']}</span>
                                </button>
                              ) : (
                                <span className="decl-card2__locked">
                                  <Icon name="lock" size={10} />
                                  {t['decl_read_only']}
                                </span>
                              )}
                              <button
                                type="button"
                                className="decl-card2__action decl-card2__action--muted"
                                onClick={() => setSyncDialog({
                                  decl: d,
                                  rowIndex: originalIndex + 2,
                                  mode: 'unlink',
                                })}
                                title={t['rsge_sync_unlink']}
                              >
                                <Icon name="link-2" size={12} />
                                <span>{t['rsge_sync_unlink']}</span>
                              </button>
                            </>
                          )}

                          {isLinked && !d.rsgeImportedAt && (
                            <>
                              <button
                                type="button"
                                className="decl-card2__action"
                                onClick={() => handleEdit(d, originalIndex)}
                                title={t['decl_edit']}
                              >
                                <Icon name="edit" size={12} />
                                <span>{t['decl_edit']}</span>
                              </button>
                              {dirty && isRsgeConnected && (
                                <button
                                  type="button"
                                  className="decl-card2__action decl-card2__action--sync"
                                  onClick={() => setSyncDialog({
                                    decl: d,
                                    rowIndex: originalIndex + 2,
                                    mode: 'resync',
                                  })}
                                  title={t['rsge_sync_resync']}
                                >
                                  <Icon name="refresh-cw" size={12} />
                                  <span>{t['rsge_sync_resync']}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="decl-card2__action decl-card2__action--muted"
                                onClick={() => setSyncDialog({
                                  decl: d,
                                  rowIndex: originalIndex + 2,
                                  mode: 'unlink',
                                })}
                                title={t['rsge_sync_unlink']}
                              >
                                <Icon name="link-2" size={12} />
                                <span>{t['rsge_sync_unlink']}</span>
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {/* FAB — quick create on mobile */}
      {!showWizard && isRsgeConnected && rsgeDecl.declarations.length > 0 && (
        <button
          className="fab"
          onClick={() => setShowWizard(true)}
          title={t['decl_new']}
          type="button"
          aria-label={t['decl_new']}
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      {/* Sync confirmation dialog */}
      {syncDialog && (
        <SyncConfirmDialog
          declaration={syncDialog.decl}
          mode={syncDialog.mode}
          onConfirm={handleSyncConfirm}
          onCancel={() => setSyncDialog(null)}
          loading={rsgeSync.syncingId !== null}
        />
      )}
    </div>
  );
}
