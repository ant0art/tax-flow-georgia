import type { TransactionFormData } from '@/entities/transaction/schemas';
import type { Declaration } from '@/entities/declaration/schemas';

/** Round to 2 decimal places (standard, not banker's — matches rs.ge rounding) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DeclarationFields {
  field15: number; // Cumulative income from Jan YTD (GEL)
  field16: number; // Tax rate
  field17: number; // Income for reporting month (GEL)
  field18: number; // Deduction (0 | 3000 | 6000)
  field19: number; // Tax due = (17-18) * 16
  field21: number; // Cumulative tax YTD
}

/**
 * Calculate declaration fields from all transactions for a given year.
 *
 * @param transactions      - all transactions loaded from Sheets
 * @param period            - reporting period in YYYY-MM format
 * @param taxRate           - from settings (default 0.01)
 * @param deduction         - field18 value chosen by user (0 | 3000 | 6000)
 * @param selectedIds       - optional set of transaction IDs to include (if empty = all in month)
 * @param priorDeclarations - imported/linked declarations for earlier months in the same year.
 *                            If available, their RS.GE cumulative income is used as a verified
 *                            baseline for field15 instead of summing transactions.
 */
export function calcDeclarationFields(
  transactions: TransactionFormData[],
  period: string,
  taxRate: number,
  deduction: number,
  selectedIds?: Set<string>,
  priorDeclarations?: Declaration[],
): DeclarationFields {
  const [yearStr] = period.split('-');
  const year = parseInt(yearStr, 10);

  // Transactions specifically for the reporting month
  const monthTxs = transactions.filter((tx) => tx.date.slice(0, 7) === period);

  // Transactions to include in field17 (either user selection or all in month)
  const includedTxs =
    selectedIds && selectedIds.size > 0
      ? monthTxs.filter((tx) => selectedIds.has(tx.id))
      : monthTxs;

  // field16: tax rate
  const field16 = taxRate;

  // field17: income for reporting month
  const field17 = round2(includedTxs.reduce((sum, tx) => sum + (tx.amountGEL || 0), 0));

  // field15: cumulative income YTD (in GEL)
  // Strategy: if we have imported RS.GE declarations for prior months,
  // use the most recent one's rsgeCumulativeIncome as a verified baseline
  // and add current month's income on top.
  let field15: number;
  let priorCumulativeTax = 0;

  const priorRsgeDecl = findBestPriorDeclaration(period, priorDeclarations);

  if (priorRsgeDecl && priorRsgeDecl.rsgeCumulativeIncome > 0) {
    // Use RS.GE cumulative as verified baseline
    field15 = round2(priorRsgeDecl.rsgeCumulativeIncome + field17);
    // Use actual tax from prior RS.GE declarations for cumulative tax
    priorCumulativeTax = computePriorTax(period, priorDeclarations);
  } else {
    // Fallback: sum all transactions from Jan to current month
    const ytdTxs = transactions.filter((tx) => {
      const txPeriod = tx.date.slice(0, 7);
      return txPeriod >= `${year}-01` && txPeriod <= period;
    });
    field15 = round2(ytdTxs.reduce((sum, tx) => sum + (tx.amountGEL || 0), 0));
    // Prior YTD tax: estimate from prior income
    const priorYtdIncome = round2(field15 - field17);
    priorCumulativeTax = round2(priorYtdIncome * field16);
  }

  // field18: deduction
  const field18 = deduction;

  // field19: tax due
  const taxBase = Math.max(0, field17 - field18);
  const field19 = round2(taxBase * field16);

  // field21: cumulative tax YTD
  const field21 = round2(priorCumulativeTax + field19);

  return { field15, field16, field17, field18, field19, field21 };
}

/**
 * Find the most recent imported RS.GE declaration that is BEFORE the given period.
 * This gives us the best cumulative baseline.
 */
function findBestPriorDeclaration(
  currentPeriod: string,
  priorDeclarations?: Declaration[],
): Declaration | null {
  if (!priorDeclarations || priorDeclarations.length === 0) return null;

  const [yearStr] = currentPeriod.split('-');

  // Filter: same year, before current period, has RS.GE import data
  const candidates = priorDeclarations
    .filter((d) =>
      d.period < currentPeriod &&
      d.period.startsWith(yearStr) &&
      d.rsgeImportedAt &&
      d.rsgeSyncState !== 'unlinked' &&
      d.rsgeCumulativeIncome > 0,
    )
    .sort((a, b) => b.period.localeCompare(a.period)); // Most recent first

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Sum up actual tax from all imported RS.GE declarations in prior months.
 * Uses field19 (local tax) if available, otherwise rsgeTax.
 */
function computePriorTax(currentPeriod: string, priorDeclarations?: Declaration[]): number {
  if (!priorDeclarations) return 0;

  const [yearStr] = currentPeriod.split('-');

  return round2(
    priorDeclarations
      .filter((d) =>
        d.period < currentPeriod &&
        d.period.startsWith(yearStr),
      )
      .reduce((sum, d) => {
        // Prefer the RS.GE tax if available (source of truth), else local
        const tax = d.rsgeTax > 0 ? d.rsgeTax : d.field19;
        return sum + tax;
      }, 0),
  );
}
