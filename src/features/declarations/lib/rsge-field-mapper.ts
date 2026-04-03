import type { Declaration } from '@/entities/declaration/schemas';
import type { RsgeDeclaration } from '@/shared/api/rsge-client';

/** Determine per-card import status by matching RS.GE period to local declarations */
export function getImportStatus(
  rsge: RsgeDeclaration,
  localDeclarations?: Declaration[],
): 'linked' | 'mismatch' | 'importable' {
  if (!localDeclarations || localDeclarations.length === 0) return 'importable';
  const localPeriod = periodFromRsge(rsge.period || rsge.SAG_PERIODI);
  const match = localDeclarations.find((d) => d.period === localPeriod);
  if (!match) return 'importable';
  if (match.rsgeSyncState === 'out_of_sync') return 'mismatch';
  if (match.rsgeImportedAt || match.rsgeSyncState === 'linked') return 'linked';
  return 'importable';
}

// ─── Amount Comparison ──────────────────────────────────────────────────────

export interface AmountComparison {
  match: boolean;
  localIncome: number;
  rsgeIncome: number;
  localTax: number;
  rsgeTax: number;
  incomeDiff: number;  // rsge - local
  taxDiff: number;     // rsge - local
}

/**
 * Compare local declaration amounts with RS.GE counterpart.
 *
 * Match is determined by TAX only (field19 vs DAR, tolerance 1₾).
 * Income diff is computed for informational display but does NOT
 * affect the match result — field17 is recalculated from local
 * transactions and legitimately differs from RS.GE's SHEM value.
 */
export function compareAmounts(local: Declaration, rsge: RsgeDeclaration): AmountComparison {
  const rsgeIncome = Number(rsge.SHEM) || 0;
  const rsgeTax = Number(rsge.DAR) || 0;
  const incomeDiff = rsgeIncome - local.field17;
  const taxDiff = rsgeTax - local.field19;
  return {
    match: Math.abs(taxDiff) <= 1,  // Only tax matters; 1₾ tolerance for rounding
    localIncome: local.field17,
    rsgeIncome,
    localTax: local.field19,
    rsgeTax,
    incomeDiff,
    taxDiff,
  };
}

/** Check if tax amount mismatches between local and RS.GE (tolerance 1₾) */
export function hasAmountMismatch(local: Declaration, rsge: RsgeDeclaration): boolean {
  return !compareAmounts(local, rsge).match;
}

/** Map RS.GE declaration summary → local Declaration snapshot fields */
export function rsgeToLocalSnapshot(rsge: RsgeDeclaration): Partial<Declaration> {
  return {
    rsgeIncome: Number(rsge.SHEM) || 0,
    rsgeTax: Number(rsge.DAR) || 0,
    rsgeCumulativeIncome: Number(rsge.SHEM_JAM) || 0,
    rsgeStatusText: rsge.STATUS_TXT || '',
    rsgeImportedAt: new Date().toISOString().split('T')[0],
    rsgeSeqNum: String(rsge.SEQ_NUM || ''),
    rsgeDocNum: rsge.DOC_MOS_NOM || '',
  };
}

/** Check if a declaration was imported/linked from RS.GE */
export function isRsgeSynced(decl: Declaration): boolean {
  return !!decl.rsgeImportedAt && decl.rsgeSyncState !== 'unlinked';
}



/**
 * Convert local period format to RS.GE format.
 * "2026-03" → "202603"
 */
export function periodToRsge(localPeriod: string): string {
  return localPeriod.replace('-', '');
}

/**
 * Convert RS.GE period format to local format.
 * "202603" → "2026-03"
 */
export function periodFromRsge(rsgePeriod: string): string {
  if (rsgePeriod.length === 6) {
    return `${rsgePeriod.slice(0, 4)}-${rsgePeriod.slice(4)}`;
  }
  return rsgePeriod;
}

/**
 * Compare local declaration fields with the snapshot of last-synced fields
 * to detect if the local version has diverged from what's on RS.GE.
 *
 * Returns true if the declaration has been modified since the last sync.
 */
export function isSyncDirty(decl: Declaration): boolean {
  if (!decl.rsgeSeqNum || decl.rsgeSyncState !== 'linked') return false;
  if (!decl.rsgeSyncedHash) return false; // no snapshot → can't compare

  const currentHash = computeSyncHash(decl);
  return currentHash !== decl.rsgeSyncedHash;
}

/**
 * Compute a simple hash of the sync-relevant fields for dirty detection.
 * Uses the fields that get sent to RS.GE.
 */
export function computeSyncHash(decl: Declaration): string {
  // Only hash the fields that matter for RS.GE sync
  const parts = [
    decl.field15.toFixed(2),
    decl.field17.toFixed(2),
    String(decl.field18),
  ];
  return parts.join('|');
}
