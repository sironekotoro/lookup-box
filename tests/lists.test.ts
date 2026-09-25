import { describe, expect, it } from 'vitest';
import {
  activeLookupBundles,
  createLookupList,
  getLookupListDisplayName,
  makeLookupListId,
  mapBundleToLookupList
} from '../lib/lists';
import type { DatasetBundle, SpreadsheetInspection } from '../lib/types';

const inspection: SpreadsheetInspection = {
  spreadsheetId: '1Abc_def-XYZ1234567890',
  title: 'Stocks',
  sheets: [
    { name: 'US', headers: ['Name', 'Code', 'Sector'], rowCount: 2 },
    { name: 'JP', headers: ['Name', 'Code'], rowCount: 2 }
  ]
};

describe('lookup list helpers', () => {
  it('always gives registered lists priority over stale demo mode', () => {
    const list = createLookupList(inspection, inspection.spreadsheetId, 'US', ['Name', 'Code'], ['Name', 'Code'], ['Name', 'Code']);
    const demo: DatasetBundle = {
      definition: {
        dataset_id: 'companies', display_name: 'Demo', sheet_name: 'companies',
        search_columns: ['Name'], display_columns: ['Name'], copy_columns: ['Name'],
        primary_key: 'Name', enabled: true, provider: 'mock'
      },
      rows: [{ Name: 'Apple' }]
    };
    const google = mapBundleToLookupList({ ...demo, definition: { ...demo.definition, provider: 'google_sheets' } }, list, [list]);
    expect(activeLookupBundles([demo, google], [list])).toEqual([google]);
    expect(activeLookupBundles([demo, google], [list], true)).toEqual([google]);
    expect(activeLookupBundles([demo], [], true)).toEqual([demo]);
  });

  it('creates a stable list identity from source and columns', () => {
    const first = makeLookupListId(inspection.spreadsheetId, 'US', 'Name', 'Code');
    const second = makeLookupListId(inspection.spreadsheetId, 'US', 'Name', 'Code');
    const other = makeLookupListId(inspection.spreadsheetId, 'JP', 'Name', 'Code');
    expect(first).toBe(second);
    expect(first).not.toBe(other);
  });

  it('derives display names without asking the user for a list name', () => {
    const us = createLookupList(inspection, inspection.spreadsheetId, 'US', ['Name', 'Code'], ['Name', 'Code'], ['Name', 'Code']);
    expect(getLookupListDisplayName(us, [us])).toBe('Stocks');

    const jp = createLookupList(inspection, inspection.spreadsheetId, 'JP', ['Name', 'Code'], ['Name', 'Code'], ['Name', 'Code']);
    expect(getLookupListDisplayName(us, [us, jp])).toBe('Stocks / US');
    expect(getLookupListDisplayName(jp, [us, jp])).toBe('Stocks / JP');

    const usSector = createLookupList(inspection, inspection.spreadsheetId, 'US', ['Name', 'Sector'], ['Name', 'Sector'], ['Name', 'Sector']);
    expect(getLookupListDisplayName(us, [us, usSector])).toBe('Stocks / US (Name → Code)');

    const sameDisplay = createLookupList(inspection, inspection.spreadsheetId, 'US', ['Sector'], ['Name', 'Code'], ['Code']);
    expect(getLookupListDisplayName(us, [us, sameDisplay])).toBe('Stocks / US (Name → Code; 検索: Name、Code)');
    expect(us.id).not.toBe(sameDisplay.id);
  });

  it('maps a provider bundle to the configured columns', () => {
    const list = createLookupList(inspection, inspection.spreadsheetId, 'US', ['Sector', 'Name'], ['Code', 'Name', 'Sector'], ['Code']);
    const bundle: DatasetBundle = {
      definition: {
        dataset_id: 'us',
        display_name: 'US',
        sheet_name: 'US',
        search_columns: ['Name', 'Code', 'Sector'],
        display_columns: ['Name', 'Code', 'Sector'],
        copy_columns: ['Name', 'Code', 'Sector'],
        primary_key: 'Name',
        enabled: true,
        provider: 'google_sheets'
      },
      rows: [{ Name: 'Apple', Code: 'AAPL', Sector: 'Technology' }]
    };

    const mapped = mapBundleToLookupList(bundle, list, [list]);
    expect(mapped.definition.dataset_id).toBe(list.id);
    expect(mapped.definition.display_name).toBe('Stocks');
    expect(mapped.definition.search_columns).toEqual(['Sector', 'Name']);
    expect(mapped.definition.display_columns).toEqual(['Code', 'Name', 'Sector']);
    expect(mapped.definition.copy_columns).toEqual(['Code']);
    expect(mapped.definition.primary_key).toBe('Sector');
    expect(mapped.rows[0]?.Sector).toBe('Technology');
  });
});
