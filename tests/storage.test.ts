import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCache, InvalidLookupSettingsError, isGoogleDisconnected, loadCache, loadSettings, normalizeSettings, recoverInvalidSettings, setGoogleDisconnected } from '../lib/storage';
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

  it('keeps legacy settings and cache if migration cannot save the mapped cache', async () => {
    const legacy = { spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit', sheetName: 'companies' };
    const previous = { bundles: [legacyBundle] };
    const set = vi.fn().mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const remove = vi.fn();
    vi.stubGlobal('browser', { storage: { local: {
      async get() { return { 'lookup.settings.v3': legacy, 'lookup.cache.v2': previous }; }, set, remove
    } } });

    await expect(loadSettings()).rejects.toThrow('以前の検索データは保持');
    expect(set).toHaveBeenCalledOnce();
    expect(set.mock.calls[0]?.[0]).toHaveProperty('lookup.settings.v4');
    expect(set.mock.calls[0]?.[0]).toHaveProperty('lookup.cache.v2');
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not overwrite settings with an invalid list', async () => {
    const original = { lists: [{ id: 'broken', spreadsheetId: 'sheet' }] };
    const set = vi.fn();
    vi.stubGlobal('browser', { storage: { local: {
      async get() { return { 'lookup.settings.v4': original }; }, set, async remove() {}
    } } });
    await expect(loadSettings()).rejects.toBeInstanceOf(InvalidLookupSettingsError);
    expect(set).not.toHaveBeenCalled();
  });

  it.each([{ lists: 'broken' }, {}])('does not migrate malformed v4 settings: %j', async (original) => {
    const set = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('browser', { storage: { local: {
      async get() { return { 'lookup.settings.v4': original }; }, set, remove
    } } });
    await expect(loadSettings()).rejects.toBeInstanceOf(InvalidLookupSettingsError);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('only migrates legacy settings when the v4 key is absent', async () => {
    const saved: Record<string, unknown> = { 'lookup.settings.v3': { useMock: true } };
    const set = vi.fn(async (update: Record<string, unknown>) => Object.assign(saved, update));
    vi.stubGlobal('browser', { storage: { local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.filter((key) => Object.hasOwn(saved, key)).map((key) => [key, saved[key]]));
      }, set, async remove() {}
    } } });
    expect((await loadSettings()).lists).toEqual([]);
    expect(set).toHaveBeenCalledOnce();
  });

  it('backs up malformed v4 settings before explicitly resetting their list structure', async () => {
    const original = { lists: 'broken' };
    const saved: Record<string, unknown> = { 'lookup.settings.v4': original };
    vi.stubGlobal('browser', { storage: { local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.filter((key) => Object.hasOwn(saved, key)).map((key) => [key, saved[key]]));
      },
      async set(update: Record<string, unknown>) { Object.assign(saved, update); },
      async remove() {}
    } } });
    await expect(loadSettings()).rejects.toBeInstanceOf(InvalidLookupSettingsError);
    expect((await recoverInvalidSettings()).lists).toEqual([]);
    expect(saved['lookup.settings.v4.invalid']).toEqual(original);
    expect((await loadSettings()).lists).toEqual([]);
  });

  it('backs up unreadable lists before explicitly recovering valid lists', async () => {
    const valid = {
      id: 'good', spreadsheetId: 'id', spreadsheetUrl: 'url',
      spreadsheetTitle: 'Stocks', sheetName: 'US',
      searchColumns: ['Name'], displayColumns: ['Name'], copyColumns: []
    };
    const original = { lists: [valid, { id: 'broken', spreadsheetId: 'id' }] };
    const values: Record<string, unknown> = { 'lookup.settings.v4': original };
    vi.stubGlobal('browser', { storage: { local: {
      async get(keys: string | string[]) {
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, values[key]]));
      },
      async set(update: Record<string, unknown>) { Object.assign(values, update); },
      async remove() {}
    } } });
    await expect(loadSettings()).rejects.toBeInstanceOf(InvalidLookupSettingsError);
    expect(values['lookup.settings.v4']).toBe(original);
    const recovered = await recoverInvalidSettings();
    expect(recovered.lists).toHaveLength(1);
    expect(recovered.lists[0]?.id).toBe('good');
    expect(values['lookup.settings.v4.invalid']).toEqual(original);
    expect((await loadSettings()).lists).toHaveLength(1);
  });

  it('keeps a disconnect marker while deleting cached rows', async () => {
    const values: Record<string, unknown> = { 'lookup.cache.v2': { bundles: [legacyBundle] } };
    vi.stubGlobal('browser', { storage: { local: {
      async get(key: string) { return { [key]: values[key] }; },
      async set(update: Record<string, unknown>) { Object.assign(values, update); },
      async remove(key: string) { delete values[key]; }
    } } });
    await setGoogleDisconnected(true);
    await clearCache();
    expect(await isGoogleDisconnected()).toBe(true);
    expect((await loadCache()).bundles).toEqual([]);
  });
});
