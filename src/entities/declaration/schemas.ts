import { z } from 'zod';

export const DECLARATION_LOCAL_STATUS = ['draft', 'submitted', 'paid'] as const;
export type DeclarationLocalStatus = typeof DECLARATION_LOCAL_STATUS[number];

export const RSGE_SYNC_STATE = ['unlinked', 'linked', 'out_of_sync', 'broken'] as const;
export type RsgeSyncState = typeof RSGE_SYNC_STATE[number];

export const declarationSchema = z.object({
  id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM'),
  field15: z.number().min(0), // Cumulative income from Jan YTD (GEL)
  field16: z.number().min(0).max(1), // Tax rate (default 0.01)
  field17: z.number().min(0), // Income for the reporting month (GEL)
  field18: z.number().min(0), // Tax-exempt deduction (0 | 3000 | 6000)
  field19: z.number().min(0), // Calculated tax = (17-18) * 16
  field21: z.number().min(0), // Cumulative tax YTD
  // Keep 'status' column name in Sheet for backward compatibility,
  // but rename the field to 'localStatus' in code
  localStatus: z.enum(DECLARATION_LOCAL_STATUS),
  submittedAt: z.string(), // ISO date or ''
  paidAt: z.string(),      // ISO date or ''
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // --- New columns (appended at end of Sheet) ---
  transactionIds: z.string(),  // Comma-separated transaction IDs
  rsgeSeqNum: z.string(),      // SEQ_NUM from RS.GE ('' = not linked)
  rsgeDocNum: z.string(),      // DOC_MOS_NOM from RS.GE
  rsgeSyncState: z.enum(RSGE_SYNC_STATE),
  rsgeSyncedHash: z.string(),  // Hash of fields at last sync (for dirty detection)
  // --- RS.GE imported snapshot fields ---
  rsgeIncome: z.number().min(0),            // SHEM — monthly income from RS.GE
  rsgeTax: z.number().min(0),                // DAR — tax amount from RS.GE
  rsgeCumulativeIncome: z.number().min(0),   // SHEM_JAM — YTD cumulative income from RS.GE
  rsgeStatusText: z.string(),                // STATUS_TXT from RS.GE ("გადაგზავნილი", etc.)
  rsgeImportedAt: z.string(),                // ISO date when imported/synced from RS.GE
});

export type Declaration = z.infer<typeof declarationSchema>;

/**
 * Fields in the same order as Google Sheet columns.
 *
 * IMPORTANT: The first 14 entries match the original column layout.
 * 'localStatus' maps to the Sheet column that was previously called 'status'.
 * New columns (transactionIds, rsgeSeqNum, rsgeDocNum, rsgeSyncState, rsgeSyncedHash)
 * are appended at the end for backward compatibility.
 */
export const DECLARATION_FIELDS: (keyof Declaration)[] = [
  'id', 'period', 'field15', 'field16', 'field17',
  'field18', 'field19', 'field21',
  'localStatus', 'submittedAt', 'paidAt', 'notes',
  'createdAt', 'updatedAt',
  // --- appended ---
  'transactionIds', 'rsgeSeqNum', 'rsgeDocNum', 'rsgeSyncState', 'rsgeSyncedHash',
  // --- RS.GE snapshot (Phase 4) ---
  'rsgeIncome', 'rsgeTax', 'rsgeCumulativeIncome', 'rsgeStatusText', 'rsgeImportedAt',
];

/** Returns the previous calendar month in YYYY-MM format (local time) */
export function prevMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns the current calendar month in YYYY-MM format (local time) */
export function currentMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** List of YYYY-MM periods for a given year */
export function periodsForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${year}-${m}`;
  });
}
