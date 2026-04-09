/**
 * RS.GE Declaration Proxy API client.
 *
 * Communicates with the Cloudflare Worker (private repo)
 * to authenticate with rs.ge and fetch declarations.
 */

const WORKER_URL = import.meta.env.VITE_RSGE_WORKER_URL || '';
const API_KEY = import.meta.env.VITE_RSGE_API_KEY || '';

interface RsgeAuthInitResponse {
  status: 'otp_required' | 'authenticated';
  temp_token: string;
  message: string;
}

interface RsgeAuthCompleteResponse {
  status: 'authenticated';
  temp_token: string;
  message: string;
}

export interface RsgeDeclaration {
  period: string;
  SAG_PERIODI: string;
  STATUS_TXT: string;
  STATUS: number;
  SEQ_NUM: number;
  DAR: number;           // tax amount
  SHEM: number;          // monthly income
  SHEM_JAM: number;      // year-to-date income (cumulative)
  WARM_TAR: string;      // submission date
  ENTRY_DATE: string;    // creation date
  DOC_MOS_NOM: string;   // document number
  SAG_NOM: string;       // registration number
  DEC_TYPE: string;
  GAD_KOD: string;
  UN_ID: number;
  TAX_TYPE: number;
  SEND_USER: string;
  [key: string]: unknown; // RS.GE may return extra fields
}

interface RsgeDeclarationsResponse {
  ok: boolean;
  year: number;
  declarations: RsgeDeclaration[];
  count: number;
}

interface RsgeErrorResponse {
  error: string;
  message?: string;
}

type RsgeResponse<T> = T | RsgeErrorResponse;

function isError(res: unknown): res is RsgeErrorResponse {
  return typeof res === 'object' && res !== null && 'error' in res;
}

async function workerFetch<T>(path: string, body?: unknown): Promise<T> {
  if (!WORKER_URL) throw new Error('VITE_RSGE_WORKER_URL is not configured');

  const res = await fetch(`${WORKER_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json() as RsgeResponse<T>;

  if (!res.ok || isError(data)) {
    const err = isError(data) ? data.error : `HTTP ${res.status}`;
    throw new Error(err);
  }

  return data as T;
}

/** Step 1: Send login + password → triggers SMS OTP */
export async function rsgeAuthInit(login: string, password: string): Promise<RsgeAuthInitResponse> {
  return workerFetch<RsgeAuthInitResponse>('/auth-init', { login, password });
}

/** Step 2: Send OTP code → get authenticated temp_token */
export async function rsgeAuthComplete(tempToken: string, otp: string): Promise<RsgeAuthCompleteResponse> {
  return workerFetch<RsgeAuthCompleteResponse>('/auth-complete', { temp_token: tempToken, otp });
}

/** Step 3: Fetch declarations for a given year */
export async function rsgeGetDeclarations(tempToken: string, year?: number): Promise<RsgeDeclarationsResponse> {
  return workerFetch<RsgeDeclarationsResponse>('/declarations', { temp_token: tempToken, year });
}

// ─── Draft CRUD Types ────────────────────────────────────────────────────────

/** Human-readable draft fields (Worker maps these to RS.GE columns internally) */
export interface DraftFields {
  ytdIncome?: string;
  monthlyIncome?: string;
  deduction?: number;
  cashIncome?: string;
  posIncome?: string;
  otherIncome?: string;
  accruedIncome?: string;
  priorReduction?: string;
  advances?: string;
  adjaraArTax?: string;
  abkhaziaArTax?: string;
  ytdSalary?: string;
  // Read-only fields returned by Worker:
  taxRate?: string;
  monthlyTaxableIncome?: string;
  calculatedTax?: string;
}

/** Parsed draft data returned by Worker */
export interface RsgeParsedDraft {
  seqNum: number;
  period: string;
  status: number;
  taxAmount: string;
  fields: DraftFields;
}

interface RsgeDraftCreateResponse {
  ok: boolean;
  seq_num: number;
  period: string;
  tax_code: string;
  tax_type: string;
}

interface RsgeDraftSaveResponse {
  ok: boolean;
  seq_num: number;
  saved_fields: DraftFields;
  validation_error: string | null;
}

interface RsgeDraftGetResponse {
  ok: boolean;
  draft: RsgeParsedDraft;
  autoFillAvailable: unknown;
}

interface RsgeDraftDeleteResponse {
  ok: boolean;
  deleted: number;
}

interface RsgeDraftListResponse {
  ok: boolean;
  declarations: RsgeDeclaration[];
  count: number;
  filter: { period?: string; year?: number };
}

// ─── Draft CRUD Functions ───────────────────────────────────────────────────

/** Create a new declaration draft on RS.GE */
export async function rsgeDraftCreate(
  tempToken: string,
  period: string, // YYYYMM format
  taxCode = '58',
  taxType = '1',
): Promise<RsgeDraftCreateResponse> {
  return workerFetch<RsgeDraftCreateResponse>('/draft/create', {
    temp_token: tempToken,
    period,
    tax_code: taxCode,
    tax_type: taxType,
  });
}

/** Save/update fields on an existing RS.GE draft */
export async function rsgeDraftSave(
  tempToken: string,
  seqNum: number,
  fields: DraftFields,
  autoFill = false,
): Promise<RsgeDraftSaveResponse> {
  return workerFetch<RsgeDraftSaveResponse>('/draft/save', {
    temp_token: tempToken,
    seq_num: seqNum,
    fields,
    auto_fill: autoFill,
  });
}

/** Read all fields of an RS.GE draft */
export async function rsgeDraftGet(
  tempToken: string,
  seqNum: number,
): Promise<RsgeDraftGetResponse> {
  return workerFetch<RsgeDraftGetResponse>('/draft/get', {
    temp_token: tempToken,
    seq_num: seqNum,
  });
}

/** Delete a draft from RS.GE */
export async function rsgeDraftDelete(
  tempToken: string,
  seqNum: number,
): Promise<RsgeDraftDeleteResponse> {
  return workerFetch<RsgeDraftDeleteResponse>('/draft/delete', {
    temp_token: tempToken,
    seq_num: seqNum,
  });
}

/** List drafts on RS.GE (optionally filtered by period) */
export async function rsgeDraftList(
  tempToken: string,
  period?: string, // YYYYMM
  year?: number,
): Promise<RsgeDraftListResponse> {
  return workerFetch<RsgeDraftListResponse>('/draft/list', {
    temp_token: tempToken,
    ...(period ? { period } : {}),
    ...(year ? { year } : {}),
  });
}

// ─── Submit Types & Function ────────────────────────────────────────────────

export interface RsgeDraftSubmitResponse {
  ok: boolean;
  seq_num: number;
  period: string;
  status: 'submitted' | 'unknown';
  registration_num: string;
  submitted_at: string;
  tax_amount: string;
  steps: string[];
  error?: string;
  message?: string;
  completed_steps?: string[];
}

/**
 * Submit (file) a saved RS.GE draft declaration.
 *
 * ⚠️ IRREVERSIBLE — creates a legal tax document.
 * The draft must already exist and be saved with correct data.
 */
export async function rsgeDraftSubmit(
  tempToken: string,
  seqNum: number,
  period: string, // YYYYMM
): Promise<RsgeDraftSubmitResponse> {
  return workerFetch<RsgeDraftSubmitResponse>('/draft/submit', {
    temp_token: tempToken,
    seq_num: seqNum,
    period,
  });
}

