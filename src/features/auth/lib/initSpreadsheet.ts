const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const SHEET_STRUCTURE = [
  { title: '_meta' },
  { title: 'settings' },
  { title: 'clients' },
  { title: 'invoices' },
  { title: 'invoice_items' },
  { title: 'transactions' },
  { title: 'declarations' },
];

const HEADERS: Record<string, string[]> = {
  _meta: ['schemaVersion', 'createdAt', 'appVersion'],
  settings: [
    'fullName', 'tin', 'address', 'email', 'phone',
    'bankName', 'beneficiary', 'iban', 'swift',
    'defaultCurrency', 'taxRate', 'vatText', 'invoicePrefix',
  ],
  clients: [
    'id', 'name', 'email', 'address', 'tin',
    'bankName', 'iban', 'defaultCurrency', 'defaultProject',
    'createdAt', 'updatedAt',
  ],
  invoices: [
    'id', 'number', 'clientId', 'clientName', 'date', 'dueDate',
    'currency', 'subtotal', 'vatText', 'vatAmount', 'total',
    'project', 'status', 'linkedTransactionId', 'notes',
    'createdAt', 'updatedAt',
    'businessEntityId', 'clientBankName', 'clientIban', // NEW — appended last
  ],
  invoice_items: [
    'id', 'invoiceId', 'description', 'quantity', 'unitPrice', 'total',
  ],
  transactions: [
    'id', 'date', 'month', 'clientId', 'clientName',
    'linkedInvoiceId', 'currency', 'amount', 'rateToGel',
    'amountGel', 'taxRate', 'taxGel', 'description',
    'createdAt', 'updatedAt',
  ],
  declarations: [
    'id', 'period', 'field15', 'field16', 'field17',
    'field18', 'field19', 'field21',
    'status', 'submittedAt', 'paidAt', 'notes',
    'createdAt', 'updatedAt',
    'transactionIds', 'rsgeSeqNum', 'rsgeDocNum', 'rsgeSyncState', 'rsgeSyncedHash',
    'rsgeIncome', 'rsgeTax', 'rsgeCumulativeIncome', 'rsgeStatusText', 'rsgeImportedAt',
  ],
};

/**
 * Initialize or verify user's spreadsheet.
 * Returns the spreadsheetId.
 */
export async function initUserSpreadsheet(token: string): Promise<string> {
  // 1. Check localStorage for existing spreadsheetId
  const savedId = localStorage.getItem('tax-flow:spreadsheetId');
  if (savedId) {
    const exists = await verifySpreadsheet(savedId, token);
    if (exists) {
      await ensureMissingSheets(savedId, token);
      return savedId;
    }
  }

  // 2. Search Drive for existing Tax Flow spreadsheet
  const found = await findExistingSpreadsheet(token);
  if (found) {
    localStorage.setItem('tax-flow:spreadsheetId', found);
    await ensureMissingSheets(found, token);
    return found;
  }

  // 3. Create new spreadsheet
  const newId = await createSpreadsheet(token);
  localStorage.setItem('tax-flow:spreadsheetId', newId);
  return newId;
}

async function verifySpreadsheet(id: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${SHEETS_API}/${id}?fields=spreadsheetId`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findExistingSpreadsheet(token: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(
      "name='Tax Flow Georgia' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    );
    const res = await fetch(`${DRIVE_API}?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.files?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if any sheets from SHEET_STRUCTURE are missing and add them.
 * This handles migration for older spreadsheets created before
 * new tabs (like 'declarations') were added to the app.
 */
async function ensureMissingSheets(id: string, token: string): Promise<void> {
  try {
    const res = await fetch(
      `${SHEETS_API}/${id}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    const existing = new Set(
      (data.sheets ?? []).map(
        (s: { properties: { title: string } }) => s.properties.title
      )
    );

    const missing = SHEET_STRUCTURE.filter((s) => !existing.has(s.title));
    if (missing.length === 0) return;

    console.info('[initSpreadsheet] Adding missing sheets:', missing.map((s) => s.title));

    // Add missing sheet tabs
    await fetch(`${SHEETS_API}/${id}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: missing.map((s) => ({
          addSheet: { properties: { title: s.title } },
        })),
      }),
    });

    // Write headers for new sheets
    const valueRanges = missing
      .filter((s) => HEADERS[s.title])
      .map((s) => {
        const headers = HEADERS[s.title];
        return {
          range: `${s.title}!A1:${String.fromCharCode(64 + headers.length)}1`,
          values: [headers],
        };
      });

    if (valueRanges.length > 0) {
      await fetch(`${SHEETS_API}/${id}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: valueRanges,
        }),
      });
    }
  } catch (e) {
    console.warn('[initSpreadsheet] ensureMissingSheets failed:', e);
  }
}

async function createSpreadsheet(token: string): Promise<string> {
  const body = {
    properties: { title: 'Tax Flow Georgia' },
    sheets: SHEET_STRUCTURE.map((s) => ({
      properties: { title: s.title },
    })),
  };

  const res = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Failed to create spreadsheet: ${res.status}`);
  const data = await res.json();
  const id = data.spreadsheetId;

  // Write headers to all sheets
  await writeHeaders(id, token);

  // Write _meta row
  await writeMetaRow(id, token);

  return id;
}

async function writeHeaders(id: string, token: string): Promise<void> {
  const valueRanges = Object.entries(HEADERS).map(([sheet, headers]) => ({
    range: `${sheet}!A1:${String.fromCharCode(64 + headers.length)}1`,
    values: [headers],
  }));

  await fetch(`${SHEETS_API}/${id}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: valueRanges,
    }),
  });
}

async function writeMetaRow(id: string, token: string): Promise<void> {
  await fetch(`${SHEETS_API}/${id}/values/_meta!A2:C2?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [['1', new Date().toISOString(), '1.0.0']],
    }),
  });
}
