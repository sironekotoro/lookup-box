import { describe, expect, it } from 'vitest';
import {
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
  it('creates a stable list identity from source and columns', () => {
    const first = makeLookupListId(inspection.spreadsheetId, 'US', 'Name', 'Code');
    const second = makeLookupListId(inspection.spreadsheetId, 'US', 'Name', 'Code');
    const other = makeLookupListId(inspection.spreadsheetId, 'JP', 'Name', 'Code');
    expect(first).toBe(second);
    expect(first).not.toBe(other);
  });

  it('derives display names without asking the user for a list name', () => {
    const us = createLookupList(inspection, inspection.spreadsheetId, 'US', 'Name', 'Code');
    expect(getLookupListDisplayName(us, [us])).toBe('Stocks');

    const jp = createLookupList(inspection, inspection.spreadsheetId, 'JP', 'Name', 'Code');
    expect(getLookupListDisplayName(us, [us, jp])).toBe('Stocks / US');
    expect(getLookupListDisplayName(jp, [us, jp])).toBe('Stocks / JP');

    const usSector = createLookupList(inspection, inspection.spreadsheetId, 'US', 'Name', 'Sector');
    expect(getLookupListDisplayName(us, [us, usSector])).toBe('Stocks / US (Name → Code)');
  });

  it('maps a provider bundle to the selected key/value columns', () => {
    const list = createLookupList(inspection, inspection.spreadsheetId, 'US', 'Name', 'Code');
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
    expect(mapped.definition.search_columns).toEqual(['Name', 'Code']);
    expect(mapped.definition.display_columns).toEqual(['Name', 'Code']);
    expect(mapped.definition.copy_columns).toEqual(['Name', 'Code']);
    expect(mapped.rows[0]?.Sector).toBe('Technology');
  });
});
