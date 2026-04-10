const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

type GetToken = () => string | null;

/** Extract human-readable error from Google API response */
async function sheetsError(prefix: string, res: Response): Promise<Error> {
  try {
    const body = await res.json();
    const msg = body?.error?.message ?? JSON.stringify(body).slice(0, 200);
    console.error(`[SheetsClient] ${prefix}:`, res.status, msg);
    return new Error(`${prefix}: ${res.status} — ${msg}`);
  } catch {
    return new Error(`${prefix}: ${res.status}`);
  }
}

export class SheetsClient {
  private getToken: GetToken;
  constructor(getToken: GetToken) {
    this.getToken = getToken;
  }

  private get headers() {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private get spreadsheetId() {
    const id = localStorage.getItem('tax-flow:spreadsheetId');
    if (!id) throw new Error('No spreadsheet configured');
    return id;
  }

  /** Read all rows from a sheet */
  async getSheet(name: string): Promise<string[][]> {
    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}/values/${name}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: this.headers }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw await sheetsError('getSheet', res);
    const data = await res.json();
    // UNFORMATTED_VALUE may return numbers for date-like cells → stringify all
    return (data.values ?? []).map((row: unknown[]) => row.map((v) => String(v ?? '')));
  }

  /** Append a row to a sheet */
  async appendRow(sheet: string, row: unknown[]): Promise<void> {
    // IMPORTANT: Specify explicit A1 range to prevent Google Sheets from
    // auto-detecting the wrong "table" region (e.g. T2:X13 instead of A1:X).
    const url = `${SHEETS_API}/${this.spreadsheetId}/values/${sheet}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ values: [row] }),
    });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw await sheetsError('appendRow', res);
  }

  /** Update a specific row (1-indexed, row 1 = headers) */
  async updateRow(sheet: string, rowIndex: number, row: unknown[]): Promise<void> {
    const range = `${sheet}!A${rowIndex}`;
    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw await sheetsError('updateRow', res);
  }

  /** Delete a row by index (1-indexed) */
  async deleteRow(sheet: string, rowIndex: number): Promise<void> {
    // Get the sheetId from spreadsheet metadata
    const metaRes = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}?fields=sheets.properties`,
      { headers: this.headers }
    );
    if (!metaRes.ok) throw await sheetsError('deleteRow.meta', metaRes);
    const meta = await metaRes.json();
    const sheetMeta = meta.sheets?.find(
      (s: { properties: { title: string } }) => s.properties.title === sheet
    );
    if (!sheetMeta) throw new Error(`Sheet "${sheet}" not found`);

    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetMeta.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          }],
        }),
      }
    );
    if (!res.ok) throw await sheetsError('deleteRow', res);
  }

  /** Batch read multiple ranges */
  async batchRead(ranges: string[]): Promise<string[][][]> {
    const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`,
      { headers: this.headers }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw await sheetsError('batchRead', res);
    const data = await res.json();
    return (data.valueRanges ?? []).map(
      (vr: { values?: string[][] }) => vr.values ?? []
    );
  }
}

export class AuthError extends Error {
  constructor() {
    super('Authentication expired');
    this.name = 'AuthError';
  }
}
