import { extractSpreadsheetId } from '../googleSheet';
import type { DatasetBundle, LookupProvider, SpreadsheetInspection } from '../types';

export interface SimpleSheetLoadOptions {
  spreadsheetUrl: string;
  sheetName: string;
  searchColumns?: string[];
  displayColumns?: string[];
  copyColumns?: string[];
}

export class GoogleSheetsProvider implements LookupProvider {
  id = 'google_sheets';
  label = 'Google Sheets';

  constructor(
    private gasUrl: string,
    private apiToken: string,
    private simpleOptions?: SimpleSheetLoadOptions
  ) {}

  async inspect(spreadsheetUrl: string): Promise<SpreadsheetInspection> {
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    const json = await this.post({
      action: 'inspect',
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl
    });
    if (!json.ok || !json.spreadsheet) {
      throw new Error(json.error || 'Google Sheetを読み込めませんでした。');
    }
    return json.spreadsheet as SpreadsheetInspection;
  }

  async load(): Promise<DatasetBundle[]> {
    if (!this.simpleOptions) {
      throw new Error('Google Sheet URL と対象タブを設定してください。');
    }

    const spreadsheetId = extractSpreadsheetId(this.simpleOptions.spreadsheetUrl);
    const json = await this.post({
      action: 'sync_simple',
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: this.simpleOptions.spreadsheetUrl,
      sheet_name: this.simpleOptions.sheetName,
      search_columns: this.simpleOptions.searchColumns,
      display_columns: this.simpleOptions.displayColumns,
      copy_columns: this.simpleOptions.copyColumns
    });

    if (!json.ok || !Array.isArray(json.datasets)) {
      throw new Error(json.error || 'Google Sheetの同期に失敗しました。');
    }
    return json.datasets as DatasetBundle[];
  }

  async loadAdvanced(spreadsheetUrl: string): Promise<DatasetBundle[]> {
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    const json = await this.post({
      action: 'sync_advanced',
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl
    });
    if (!json.ok || !Array.isArray(json.datasets)) {
      throw new Error(json.error || '高度モードの同期に失敗しました。');
    }
    return json.datasets as DatasetBundle[];
  }

  private async post(payload: Record<string, unknown>): Promise<any> {
    if (!this.gasUrl || !this.apiToken) {
      throw new Error('最初に GAS Web App URL と API Token を設定してください。');
    }

    const response = await fetch(this.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: this.apiToken, ...payload }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`GAS request failed: HTTP ${response.status}`);
    }
    return response.json();
  }
}
