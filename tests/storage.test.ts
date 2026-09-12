import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../lib/storage';
import type { DatasetBundle } from '../lib/types';

const legacyBundle: DatasetBundle = {
  definition: {
    dataset_id: 'companies',
    display_name: 'companies',
    sheet_name: 'companies',
    search_columns: ['Name', 'Code'],
    display_columns: ['Name', 'Code'],
    copy_columns: ['Name', 'Code'],
    primary_key: 'Name',
    enabled: true,
    provider: 'google_sheets'
  },
  rows: [{ Name: 'Apple', Code: 'AAPL' }]
};

describe('settings migration', () => {
  it('migrates the old single-list settings without losing the GAS connection', () => {
    const migrated = normalizeSettings({
      gasUrl: 'https://script.google.com/macros/s/example/exec',
      apiToken: 'token',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit',
      sheetName: 'companies',
      useMock: false
    }, {
      bundles: [legacyBundle],
      syncedAt: '2026-09-12T00:00:00.000Z'
    });

    expect(migrated.gasUrl).toContain('script.google.com');
    expect(migrated.apiToken).toBe('token');
    expect(migrated.connectionMode).toBe('gas');
    expect(migrated.legacySpreadsheetUrl).toContain('/spreadsheets/d/');
    expect(migrated.legacySheetName).toBe('companies');
    expect(migrated.lists).toHaveLength(1);
    expect(migrated.lists[0]).toMatchObject({
      sheetName: 'companies',
      keyColumn: 'Name',
      valueColumn: 'Code'
    });
  });

  it('preserves OAuth mode in current multi-list settings', () => {
    const normalized = normalizeSettings({
      connectionMode: 'oauth',
      lists: [{
        id: 'list-1',
        spreadsheetId: 'sheet-id',
        spreadsheetUrl: 'sheet-url',
        spreadsheetTitle: 'Stocks',
        sheetName: 'US',
        keyColumn: 'Name',
        valueColumn: 'Code'
      }]
    });

    expect(normalized.connectionMode).toBe('oauth');
    expect(normalized.lists).toHaveLength(1);
    expect(normalized.lists[0]?.spreadsheetTitle).toBe('Stocks');
    expect(normalized.useMock).toBe(false);
  });

  it('falls back to GAS mode when current settings contain legacy credentials', () => {
    const normalized = normalizeSettings({
      gasUrl: 'gas',
      apiToken: 'token',
      lists: []
    });
    expect(normalized.connectionMode).toBe('gas');
  });
});
