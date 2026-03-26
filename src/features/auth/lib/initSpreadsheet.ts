const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const SHEET_STRUCTURE = [
  { title: '_meta' },
  { title: 'settings' },
  { title: 'clients' },
  { title: 'invoices' },
  { title: 'invoice_items' },
  { title: 'transactions' },
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
    if (exists) return savedId;
  }

  // 2. Search Drive for existing Tax Flow spreadsheet
  const found = await findExistingSpreadsheet(token);
  if (found) {
    localStorage.setItem('tax-flow:spreadsheetId', found);
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
