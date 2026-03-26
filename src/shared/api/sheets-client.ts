const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

type GetToken = () => string | null;

export class SheetsClient {
  constructor(private getToken: GetToken) {}

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
      `${SHEETS_API}/${this.spreadsheetId}/values/${name}`,
      { headers: this.headers }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return data.values ?? [];
  }

  /** Append a row to a sheet */
  async appendRow(sheet: string, row: unknown[]): Promise<void> {
    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}/values/${sheet}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`Append failed: ${res.status}`);
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
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  }

  /** Delete a row by index (1-indexed) */
  async deleteRow(sheet: string, rowIndex: number): Promise<void> {
    // Get the sheetId from spreadsheet metadata
    const metaRes = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}?fields=sheets.properties`,
      { headers: this.headers }
    );
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
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  }

  /** Batch read multiple ranges */
  async batchRead(ranges: string[]): Promise<string[][][]> {
    const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const res = await fetch(
      `${SHEETS_API}/${this.spreadsheetId}/values:batchGet?${params}`,
      { headers: this.headers }
    );
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`BatchRead failed: ${res.status}`);
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
