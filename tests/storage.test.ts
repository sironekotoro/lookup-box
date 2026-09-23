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
  it('migrates an old single-list configuration while dropping obsolete connection credentials', () => {
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

    expect(migrated).not.toHaveProperty('gasUrl');
    expect(migrated).not.toHaveProperty('apiToken');
    expect(migrated).not.toHaveProperty('connectionMode');
    expect(migrated.legacySpreadsheetUrl).toContain('/spreadsheets/d/');
    expect(migrated.legacySheetName).toBe('companies');
    expect(migrated.lists).toHaveLength(1);
    expect(migrated.lists[0]).toMatchObject({
      sheetName: 'companies',
      keyColumn: 'Name',
      valueColumn: 'Code'
    });
  });

  it('keeps current multi-list settings while dropping obsolete connection fields', () => {
    const normalized = normalizeSettings({
      connectionMode: 'oauth',
      gasUrl: 'old-gateway',
      apiToken: 'old-token',
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

    expect(normalized).not.toHaveProperty('gasUrl');
    expect(normalized).not.toHaveProperty('apiToken');
    expect(normalized).not.toHaveProperty('connectionMode');
    expect(normalized.lists).toHaveLength(1);
    expect(normalized.lists[0]?.spreadsheetTitle).toBe('Stocks');
    expect(normalized.useMock).toBe(false);
  });

  it('disables stale demo mode when a Google Sheet list is registered', () => {
    const normalized = normalizeSettings({
      useMock: true,
      lists: [{
        id: 'list-1',
        spreadsheetId: 'sheet-id',
        spreadsheetUrl: 'sheet-url',
        spreadsheetTitle: 'Lookup Sample',
        sheetName: 'customers',
        keyColumn: 'customer_name',
        valueColumn: 'customer_code'
      }]
    });

    expect(normalized.useMock).toBe(false);
    expect(normalized.lists).toHaveLength(1);
  });
});
