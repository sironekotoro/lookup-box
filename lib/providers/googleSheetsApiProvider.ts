import { extractSpreadsheetId, sanitizeDatasetId } from '../googleSheet';
import {
  getGoogleAccessToken,
  invalidateGoogleAccessToken
} from '../auth/googleAuth';
import type {
  DatasetBundle,
  LookupProvider,
  SheetInspection,
  SpreadsheetInspection
} from '../types';

export interface GoogleSheetLoadOptions {
  spreadsheetUrl: string;
  sheetName: string;
  searchColumns?: string[];
  displayColumns?: string[];
  copyColumns?: string[];
}

export interface GoogleAccessTokenSource {
  getAccessToken(interactive?: boolean): Promise<string>;
  invalidateAccessToken(token: string): Promise<void>;
}

const browserTokenSource: GoogleAccessTokenSource = {
  getAccessToken: getGoogleAccessToken,
  invalidateAccessToken: invalidateGoogleAccessToken
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SheetProperties = {
  title?: string;
  hidden?: boolean;
};

type SpreadsheetMetadataResponse = {
  spreadsheetId?: string;
  properties?: { title?: string };
  sheets?: Array<{ properties?: SheetProperties }>;
};

type ValuesResponse = {
  values?: unknown[][];
};

type BatchValuesResponse = {
  valueRanges?: Array<{ values?: unknown[][] }>;
};

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function stringRows(values: unknown[][] | undefined): string[][] {
  return (values ?? []).map((row) => row.map((value) => String(value ?? '')));
}

function columnsOrDefault(columns: string[] | undefined, headers: string[]): string[] {
  return columns === undefined ? headers.filter(Boolean) : columns.filter(Boolean);
}

function validateColumns(headers: string[], required: string[], sheetName: string): void {
  const known = new Set(headers);
  for (const column of required) {
    if (!known.has(column)) throw new Error(`${sheetName}: 列「${column}」が見つかりません。`);
  }
}

function rowsFromValues(headers: string[], values: string[][], selected: Set<string>): Record<string, string>[] {
  return values
    .filter((row) => row.some((value) => value.trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header || !selected.has(header)) return;
        record[header] = row[index] ?? '';
      });
      return record;
    });
}

export class GoogleSheetsApiProvider implements LookupProvider {
  id = 'google_sheets';
  label = 'Google Sheets API';

  constructor(
    private simpleOptions?: GoogleSheetLoadOptions,
    private tokenSource: GoogleAccessTokenSource = browserTokenSource,
    private fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {}

  async inspect(spreadsheetUrl: string): Promise<SpreadsheetInspection> {
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    const metadataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
    metadataUrl.searchParams.set('fields', 'spreadsheetId,properties(title),sheets(properties(title,hidden))');

    const metadata = await this.requestJson<SpreadsheetMetadataResponse>(metadataUrl);
    const visibleSheets = (metadata.sheets ?? [])
      .map((sheet) => sheet.properties)
      .filter((properties): properties is SheetProperties => Boolean(properties?.title) && properties?.hidden !== true);

    const inspections: SheetInspection[] = [];
    if (visibleSheets.length > 0) {
      const batchUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
      for (const sheet of visibleSheets) {
        batchUrl.searchParams.append('ranges', `${quoteSheetName(sheet.title!)}!1:1`);
      }
      batchUrl.searchParams.set('majorDimension', 'ROWS');
      batchUrl.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');

      const batch = await this.requestJson<BatchValuesResponse>(batchUrl);
      const ranges = batch.valueRanges ?? [];
      visibleSheets.forEach((sheet, index) => {
        const headers = stringRows(ranges[index]?.values)[0] ?? [];
        if (headers.some((header) => header.trim() !== '')) {
          inspections.push({ name: sheet.title!, headers });
        }
      });
    }

    return {
      spreadsheetId: metadata.spreadsheetId ?? spreadsheetId,
      title: metadata.properties?.title ?? 'Google Sheet',
      sheets: inspections
    };
  }

  async load(): Promise<DatasetBundle[]> {
    if (!this.simpleOptions) {
      throw new Error('Google Sheet URL と対象タブを設定してください。');
    }

    const spreadsheetId = extractSpreadsheetId(this.simpleOptions.spreadsheetUrl);
    const range = quoteSheetName(this.simpleOptions.sheetName);
    const valuesUrl = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    );
    valuesUrl.searchParams.set('majorDimension', 'ROWS');
    valuesUrl.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');

    const response = await this.requestJson<ValuesResponse>(valuesUrl);
    const values = stringRows(response.values);
    if (values.length === 0) throw new Error(`Sheetが空です: ${this.simpleOptions.sheetName}`);

    const headers = values[0] ?? [];
    if (!headers.some((header) => header.trim() !== '')) {
      throw new Error(`1行目に列名がありません: ${this.simpleOptions.sheetName}`);
    }

    const searchColumns = columnsOrDefault(this.simpleOptions.searchColumns, headers);
    const displayColumns = columnsOrDefault(this.simpleOptions.displayColumns, headers);
    const copyColumns = columnsOrDefault(this.simpleOptions.copyColumns, headers);
    validateColumns(
      headers,
      [...new Set([...searchColumns, ...displayColumns, ...copyColumns])],
      this.simpleOptions.sheetName
    );

    const rows = rowsFromValues(
      headers, values.slice(1), new Set([...searchColumns, ...displayColumns, ...copyColumns])
    );
    return [{
      definition: {
        dataset_id: sanitizeDatasetId(this.simpleOptions.sheetName),
        display_name: this.simpleOptions.sheetName,
        sheet_name: this.simpleOptions.sheetName,
        search_columns: searchColumns,
        display_columns: displayColumns,
        copy_columns: copyColumns,
        primary_key: searchColumns[0] ?? headers.find(Boolean) ?? '',
        enabled: true,
        description: 'Direct Google Sheets API lookup',
        provider: 'google_sheets'
      },
      rows
    }];
  }

  private async requestJson<T>(url: URL): Promise<T> {
    let token = await this.tokenSource.getAccessToken(false);
    let response = await this.fetchWithToken(url, token);

    if (response.status === 401) {
      await this.tokenSource.invalidateAccessToken(token);
      token = await this.tokenSource.getAccessToken(false);
      response = await this.fetchWithToken(url, token);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json() as { error?: { message?: string } };
        detail = body.error?.message ? `: ${body.error.message}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`Google Sheets API request failed: HTTP ${response.status}${detail}`);
    }

    return response.json() as Promise<T>;
  }

  private fetchWithToken(url: URL, token: string): Promise<Response> {
    return this.fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
  }
}
