import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCache, loadSettings, normalizeSettings } from '../lib/storage';
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

afterEach(() => vi.unstubAllGlobals());

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
      searchColumns: ['Name', 'Code'],
      displayColumns: ['Name', 'Code'],
      copyColumns: ['Name', 'Code']
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
    expect(normalized.lists[0]?.id).toBe('list-1');
    expect(normalized.lists[0]?.searchColumns).toEqual(['Name', 'Code']);
    expect(normalized.lists[0]?.displayColumns).toEqual(['Name', 'Code']);
    expect(normalized.lists[0]?.copyColumns).toEqual(['Name', 'Code']);
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

  it('keeps the list ID and custom column order when loading the new format', () => {
    const normalized = normalizeSettings({ lists: [{
      id: 'stable-id', spreadsheetId: 'sheet-id', spreadsheetUrl: 'sheet-url',
      spreadsheetTitle: 'Stocks', sheetName: 'US',
      searchColumns: ['Sector', 'Name'], displayColumns: ['Code', 'Name', 'Sector'],
      copyColumns: []
    }] });
    expect(normalized.lists[0]).toMatchObject({
      id: 'stable-id', searchColumns: ['Sector', 'Name'],
      displayColumns: ['Code', 'Name', 'Sector'], copyColumns: []
    });
  });

  it('upgrades saved two-column settings without changing the cached list ID or rows', async () => {
    const values: Record<string, unknown> = {
      'lookup.settings.v4': {
        lists: [{
          id: 'original-list', spreadsheetId: 'sheet-id', spreadsheetUrl: 'sheet-url',
          spreadsheetTitle: 'Stocks', sheetName: 'US', keyColumn: 'Name', valueColumn: 'Code'
        }]
      },
      'lookup.cache.v2': {
        syncedAt: '2026-09-24T00:00:00.000Z',
        bundles: [{ ...legacyBundle, definition: { ...legacyBundle.definition, dataset_id: 'original-list' } }]
      }
    };
    vi.stubGlobal('browser', { storage: { local: {
      async get(keys: string | string[]) {
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, values[key]]));
      },
      async set(update: Record<string, unknown>) { Object.assign(values, update); },
      async remove() {}
    } } });

    const settings = await loadSettings();
    const cache = await loadCache();
    expect(settings.lists[0]).toMatchObject({
      id: 'original-list', searchColumns: ['Name', 'Code'],
      displayColumns: ['Name', 'Code'], copyColumns: ['Name', 'Code']
    });
    expect(values['lookup.settings.v4']).toEqual(settings);
    expect(cache.bundles[0]?.definition.dataset_id).toBe('original-list');
    expect(cache.bundles[0]?.rows).toEqual([{ Name: 'Apple', Code: 'AAPL' }]);
  });
});
