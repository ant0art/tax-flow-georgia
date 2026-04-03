import { useState, useMemo } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { useT } from '@/shared/i18n/useT';
import type { RsgeDeclaration } from '@/shared/api/rsge-client';
import type { RsgeDeclState } from '@/features/declarations/hooks/useRsgeDeclarations';
import type { Declaration } from '@/entities/declaration/schemas';
import { getImportStatus } from '@/features/declarations/lib/rsge-field-mapper';

interface RsgeDeclarationsListProps {
  state: RsgeDeclState;
  declarations: RsgeDeclaration[];
  error: string | null;
  year: number;
  onYearChange: (y: number) => void;
  onRefetch: () => void;
  /** Local declarations for showing link/import status per card */
  localDeclarations?: Declaration[];
  /** Import a single RS.GE declaration */
  onImportSingle?: (decl: RsgeDeclaration) => void;
  /** Whether a single-card import is currently in progress (by UN_ID) */
  importingId?: string | null;
  /** Import all RS.GE declarations */
  onImportAll?: () => void;
  /** Whether bulk import is in progress */
  importing?: boolean;
  /** Bulk import progress label */
  importProgressLabel?: string;
  /** Last import result summary */
  importResultSummary?: React.ReactNode;
}



function statusCategory(statusTxt: string, status: number): string {
  const txt = statusTxt || '';
  if (txt.includes('დადასტურ') || txt.includes('confirm') || status === 3) return 'accepted';
  if (txt.includes('გაგზავნ') || txt.includes('გადაგზავნ') || txt.includes('sent') || status === 2) return 'submitted';
  if (txt.includes('უარყოფ') || txt.includes('reject') || status === 4) return 'rejected';
  if (status === 1) return 'draft';
  return 'unknown';
}

function formatPeriod(period: string, t: Record<string, string>): string {
  const monthMap: Record<string, string> = {
    '01': 'month_jan', '02': 'month_feb', '03': 'month_mar', '04': 'month_apr',
    '05': 'month_may', '06': 'month_jun', '07': 'month_jul', '08': 'month_aug',
    '09': 'month_sep', '10': 'month_oct', '11': 'month_nov', '12': 'month_dec',
  };
  const yr = period.slice(0, 4);
  const mm = period.slice(4, 6);
  return `${monthMap[mm] ? t[monthMap[mm]] : mm} ${yr}`;
}

function fmtDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const dateOnly = dateStr.split(/[\sT]/)[0];
  const parts = dateOnly.split(/[./-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}`;
    return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c}`;
  }
  return dateOnly;
}

function fmtAmount(v: unknown): string {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  return `₾${n.toFixed(2)}`;
}

export function RsgeDeclarationsList({
  state, declarations, error, year, onYearChange, onRefetch, localDeclarations,
  onImportSingle, importingId,
  onImportAll, importing, importProgressLabel, importResultSummary,
}: RsgeDeclarationsListProps) {
  const t = useT();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return declarations;
    const q = search.trim().toLowerCase();
    return declarations.filter(
      (d) =>
        (d.DOC_MOS_NOM || '').toLowerCase().includes(q) ||
        (d.SAG_NOM || '').toLowerCase().includes(q) ||
        (d.period || '').includes(q),
    );
  }, [declarations, search]);

  return (
    <div className="rsge-section">
      {/* Controls row: search + year + import all */}
      <div className="rsge-section__controls-bar">
        {state === 'done' && declarations.length > 0 && (
          <input
            id="rsge-search"
            className="rsge-search-input"
            placeholder={t['rsge_search_placeholder']}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <div className="rsge-year-select">
          <button className="rsge-year-btn" onClick={() => onYearChange(year - 1)}>
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="rsge-year-label">{year}</span>
          <button
            className="rsge-year-btn"
            onClick={() => onYearChange(year + 1)}
            disabled={year >= new Date().getFullYear()}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>

        {/* Import All — compact inline */}
        {state === 'done' && declarations.length > 0 && onImportAll && (
          <div className="rsge-import-inline">
            {importing ? (
              <span className="rsge-import-inline__progress">
                <Icon name="loader" size={14} />
                {importProgressLabel || t['rsge_importing']}
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={onImportAll}>
                <Icon name="download" size={13} />
                {t['rsge_import_all']}
              </Button>
            )}
            {importResultSummary}
          </div>
        )}
      </div>

      {error && (
        <div className="rsge-error">
          <Icon name="alert-triangle" size={16} />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={onRefetch} style={{ marginLeft: 'auto' }}>
            {t['rsge_retry']}
          </Button>
        </div>
      )}

      {state === 'loading' && (
        <div className="rsge-loading-overlay">
          <Icon name="loader" size={18} />
          <span>{t['rsge_loading']}</span>
        </div>
      )}

      {/* Card grid */}
      {state === 'done' && filtered.length > 0 && (
        <div className="rsge-card-grid">
          {filtered.map((decl, idx) => {
            const cat = statusCategory(decl.STATUS_TXT, decl.STATUS);
            const importStatus = getImportStatus(decl, localDeclarations);
            const cardId = decl.UN_ID ? String(decl.UN_ID) : String(idx);
            const isImporting = importingId === cardId;
            return (
              <div key={decl.UN_ID ? `${decl.UN_ID}-${decl.period || idx}` : idx} className={`rsge-card${isImporting ? ' rsge-card--importing' : ''}`}>
                <div className={`rsge-card__accent rsge-card__accent--${cat}`} />
                <div className="rsge-card__body">
                  {/* Row 1: Period · Doc# | Status */}
                  <div className="rsge-card__top">
                    <span className="rsge-card__period">
                      {formatPeriod(decl.period || decl.SAG_PERIODI, t)}
                      {decl.DOC_MOS_NOM && (
                        <span className="rsge-card__docnum"> · № {decl.DOC_MOS_NOM}</span>
                      )}
                    </span>
                    <span className={`rsge-status-badge rsge-status-badge--${cat}`}>
                      {t[`rsge_status_${cat}` as keyof typeof t] || decl.STATUS_TXT || '—'}
                    </span>
                  </div>
                  {/* Row 2: Labeled columns — ПОДАНА (left) | НАЛОГ (right) */}
                  <div className="rsge-card__metrics">
                    <div className="rsge-card__metric">
                      <span className="rsge-card__label">{t['rsge_decl_submitted']}</span>
                      <span className="rsge-card__value">{fmtDate(decl.WARM_TAR)}</span>
                    </div>
                    <div className="rsge-card__metric rsge-card__metric--right">
                      <span className="rsge-card__label">{t['rsge_decl_tax']}</span>
                      <span className="rsge-card__value rsge-card__value--tax">{fmtAmount(decl.DAR)}</span>
                    </div>
                  </div>
                  {/* Row 3: Footer meta + import status */}
                  <div className="rsge-card__footer">
                    {decl.ENTRY_DATE && (
                      <span className="rsge-card__meta">
                        {t['rsge_decl_created']}: {fmtDate(decl.ENTRY_DATE)}
                      </span>
                    )}
                    {importStatus === 'linked' && (
                      <span className="rsge-card__import-status rsge-card__import-status--linked">
                        <Icon name="check-circle" size={12} />
                        {t['rsge_imported']}
                      </span>
                    )}
                    {importStatus === 'mismatch' && (
                      <span className="rsge-card__import-status rsge-card__import-status--mismatch">
                        <Icon name="alert-triangle" size={12} />
                        {t['rsge_mismatch_title']}
                      </span>
                    )}
                  </div>
                  {/* Row 4: Actions */}
                  <div className="rsge-card__actions">
                    {importStatus === 'importable' && onImportSingle && (
                      <button
                        type="button"
                        className="rsge-card__action rsge-card__action--import"
                        onClick={() => onImportSingle(decl)}
                        disabled={isImporting}
                        title={t['rsge_import_single']}
                      >
                        <Icon name="download" size={12} />
                        <span>{t['rsge_import_single']}</span>
                      </button>
                    )}
                    {importStatus === 'linked' && (
                      <span className="rsge-card__action-label rsge-card__action-label--linked">
                        <Icon name="link-2" size={10} />
                        RS.GE
                      </span>
                    )}
                    {importStatus === 'mismatch' && onImportSingle && (
                      <button
                        type="button"
                        className="rsge-card__action rsge-card__action--reimport"
                        onClick={() => onImportSingle(decl)}
                        disabled={isImporting}
                        title={t['rsge_import_single']}
                      >
                        <Icon name="refresh-cw" size={12} />
                        <span>{t['rsge_import_single']}</span>
                      </button>
                    )}
                    {isImporting && (
                      <span className="rsge-card__action-label rsge-card__action-label--importing">
                        <Icon name="loader" size={12} />
                        {t['rsge_importing']}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state === 'done' && declarations.length > 0 && filtered.length === 0 && (
        <div className="rsge-decl-empty">
          <Icon name="search" size={20} />
          <p className="rsge-decl-empty__text">{t['rsge_search_empty']}</p>
        </div>
      )}

      {state === 'done' && declarations.length === 0 && (
        <div className="rsge-decl-empty">
          <Icon name="file-check" size={24} />
          <p className="rsge-decl-empty__text">{t['rsge_decl_empty']}</p>
        </div>
      )}
    </div>
  );
}
