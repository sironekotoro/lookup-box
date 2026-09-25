import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSheetsApiProvider, type GoogleAccessTokenSource } from '../lib/providers/googleSheetsApiProvider';
import { createLookupList, mapBundleToLookupList } from '../lib/lists';
import { searchDatasets } from '../lib/search';
import { selectableHeaders } from '../lib/sheetHeaders';

const tokenSource: GoogleAccessTokenSource = {
  async getAccessToken() { return 'token'; },
  async invalidateAccessToken() {}
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('GoogleSheetsApiProvider', () => {
  it('inspects visible sheets and reads formatted header values', async () => {
    const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes('values:batchGet')) {
        return jsonResponse({ valueRanges: [{ values: [['Name', 'Code']] }] });
      }
      return jsonResponse({
        spreadsheetId: '1Abc_def-XYZ1234567890',
        properties: { title: 'Stocks' },
        sheets: [
          { properties: { title: 'US', hidden: false } },
          { properties: { title: 'Hidden', hidden: true } }
        ]
      });
    };

    const provider = new GoogleSheetsApiProvider(undefined, tokenSource, fakeFetch);
    const result = await provider.inspect('https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit');

    expect(result.title).toBe('Stocks');
    expect(result.sheets).toEqual([{ name: 'US', headers: ['Name', 'Code'] }]);
  });

  it('loads formatted strings without dropping leading zeroes', async () => {
    const fakeFetch = async (): Promise<Response> => jsonResponse({
      values: [
        ['Name', 'Code'],
        ['Example', '00123'],
        ['Second', '00007']
      ]
    });

    const provider = new GoogleSheetsApiProvider({
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit',
      sheetName: 'US',
      searchColumns: ['Name', 'Code'],
      displayColumns: ['Name', 'Code'],
      copyColumns: ['Name', 'Code']
    }, tokenSource, fakeFetch);

    const bundles = await provider.load();
    expect(bundles).toHaveLength(1);
    expect(bundles[0]?.rows).toEqual([
      { Name: 'Example', Code: '00123' },
      { Name: 'Second', Code: '00007' }
    ]);
  });

  it('keeps __proto__ as an ordinary cell value', async () => {
    const provider = new GoogleSheetsApiProvider({
      spreadsheetUrl: '1Abc_def-XYZ1234567890', sheetName: 'US',
      searchColumns: ['__proto__'], displayColumns: ['__proto__'], copyColumns: []
    }, tokenSource, async () => jsonResponse({ values: [['__proto__'], ['safe value']] }));
    const row = (await provider.load())[0]!.rows[0]!;
    expect(Object.getOwnPropertyDescriptor(row, '__proto__')?.value).toBe('safe value');
    expect(searchDatasets((await provider.load()), 'safe')[0]?.row['__proto__']).toBe('safe value');
  });

  it('keeps a tab with duplicate headers and offers its unambiguous columns for registration', async () => {
    const provider = new GoogleSheetsApiProvider(undefined, tokenSource, async (input) => String(input).includes('values:batchGet')
      ? jsonResponse({ valueRanges: [
          { values: [['Name', 'Notes', 'Notes', 'Code']] }, { values: [['Name', 'Code']] }
        ] })
      : jsonResponse({ sheets: [
          { properties: { title: 'Notes' } }, { properties: { title: 'US' } }
        ] }));
    const inspection = await provider.inspect('1Abc_def-XYZ1234567890');
    expect(inspection.sheets).toEqual([
      { name: 'Notes', headers: ['Name', 'Notes', 'Notes', 'Code'], duplicateHeaders: ['Notes'] },
      { name: 'US', headers: ['Name', 'Code'] }
    ]);
    expect(selectableHeaders(inspection.sheets[0])).toEqual(['Name', 'Code']);
  });

  it('shows a tab with only ambiguous headers but offers no columns to select', async () => {
    const provider = new GoogleSheetsApiProvider(undefined, tokenSource, async (input) => String(input).includes('values:batchGet')
      ? jsonResponse({ valueRanges: [{ values: [['Name', 'Name']] }] })
      : jsonResponse({ sheets: [{ properties: { title: 'Notes' } }] }));
    const sheet = (await provider.inspect('1Abc_def-XYZ1234567890')).sheets[0];
    expect(sheet?.duplicateHeaders).toEqual(['Name']);
    expect(selectableHeaders(sheet)).toEqual([]);
  });

  it('rejects duplicates in selected columns but ignores unused duplicate headers', async () => {
    const provider = new GoogleSheetsApiProvider({
      spreadsheetUrl: '1Abc_def-XYZ1234567890', sheetName: 'US',
      searchColumns: ['Name'], displayColumns: ['Name']
    }, tokenSource, async () => jsonResponse({ values: [['Name', 'Name'], ['A', 'B']] }));
    await expect(provider.load()).rejects.toThrow('重複');

    const unrelated = new GoogleSheetsApiProvider({
      spreadsheetUrl: '1Abc_def-XYZ1234567890', sheetName: 'US',
      searchColumns: ['Name'], displayColumns: ['Name'], copyColumns: []
    }, tokenSource, async () => jsonResponse({ values: [
      ['Name', 'Notes', 'Notes'], ['A', 'first', 'second']
    ] }));
    expect((await unrelated.load())[0]?.rows[0]?.Name).toBe('A');
  });

  it('keeps an existing list editable and syncable after an unused duplicate header is added', async () => {
    const provider = new GoogleSheetsApiProvider({
      spreadsheetUrl: '1Abc_def-XYZ1234567890', sheetName: 'US',
      searchColumns: ['Name'], displayColumns: ['Code'], copyColumns: ['Code']
    }, tokenSource, async (input) => {
      const url = String(input);
      if (url.includes('values:batchGet')) return jsonResponse({
        valueRanges: [{ values: [['Name', 'Notes', 'Notes', 'Code']] }]
      });
      if (url.includes('/values/')) return jsonResponse({ values: [
        ['Name', 'Notes', 'Notes', 'Code'], ['Example', 'A', 'B', '00123']
      ] });
      return jsonResponse({ sheets: [{ properties: { title: 'US' } }] });
    });
    const inspection = await provider.inspect('1Abc_def-XYZ1234567890');
    const sheet = inspection.sheets.find((item) => item.name === 'US');
    expect(selectableHeaders(sheet)).toEqual(['Name', 'Code']);
    expect((await provider.load())[0]?.rows).toEqual([{ Name: 'Example', Code: '00123' }]);
  });

  it('supports four columns, search-only fields, display order and an empty copy selection', async () => {
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit';
    const provider = new GoogleSheetsApiProvider({
      spreadsheetUrl, sheetName: 'US',
      searchColumns: ['Alias', 'Name'],
      displayColumns: ['Code', 'Name', 'Region'],
      copyColumns: []
    }, tokenSource, async () => jsonResponse({ values: [
      ['Name', 'Code', 'Region', 'Alias', 'Ignored'],
      ['Example', '00123', 'East', 'Alternative', 'secret']
    ] }));
    const list = createLookupList({
      spreadsheetId: '1Abc_def-XYZ1234567890', title: 'Stocks', sheets: []
    }, spreadsheetUrl, 'US', ['Alias', 'Name'], ['Code', 'Name', 'Region'], []);
    const loaded = await provider.load();
    const bundle = mapBundleToLookupList(loaded[0]!, list, [list]);
    expect(bundle.rows[0]).toEqual({ Name: 'Example', Code: '00123', Region: 'East', Alias: 'Alternative' });
    expect(bundle.definition.display_columns).toEqual(['Code', 'Name', 'Region']);
    expect(bundle.definition.copy_columns).toEqual([]);
    expect(searchDatasets([bundle], 'Alternative')[0]?.row.Code).toBe('00123');
    expect(searchDatasets([bundle], '00123')).toHaveLength(0);
  });

  it('invalidates a rejected token and retries once', async () => {
    let tokenCalls = 0;
    let invalidated = '';
    let fetchCalls = 0;
    const retryingTokenSource: GoogleAccessTokenSource = {
      async getAccessToken() {
        tokenCalls += 1;
        return tokenCalls === 1 ? 'old-token' : 'new-token';
      },
      async invalidateAccessToken(token) { invalidated = token; }
    };
    const fakeFetch = async (): Promise<Response> => {
      fetchCalls += 1;
      if (fetchCalls === 1) return jsonResponse({ error: { message: 'expired' } }, 401);
      return jsonResponse({
        spreadsheetId: '1Abc_def-XYZ1234567890',
        properties: { title: 'Stocks' },
        sheets: []
      });
    };

    const provider = new GoogleSheetsApiProvider(undefined, retryingTokenSource, fakeFetch);
    await provider.inspect('1Abc_def-XYZ1234567890');
    expect(invalidated).toBe('old-token');
    expect(tokenCalls).toBe(2);
    expect(fetchCalls).toBe(2);
  });

  it('does not invoke the default fetch with the provider instance as this', async () => {
    globalThis.fetch = function(this: unknown, input: RequestInfo | URL): Promise<Response> {
      if (this instanceof GoogleSheetsApiProvider) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      const url = String(input);
      if (url.includes('values:batchGet')) {
        return Promise.resolve(jsonResponse({ valueRanges: [{ values: [['Name', 'Code']] }] }));
      }
      return Promise.resolve(jsonResponse({
        spreadsheetId: '1Abc_def-XYZ1234567890',
        properties: { title: 'Stocks' },
        sheets: [{ properties: { title: 'US', hidden: false } }]
      }));
    } as typeof fetch;

    const provider = new GoogleSheetsApiProvider(undefined, tokenSource);
    const result = await provider.inspect('1Abc_def-XYZ1234567890');
    expect(result.title).toBe('Stocks');
    expect(result.sheets[0]?.headers).toEqual(['Name', 'Code']);
  });
});
