import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSheetsApiProvider, type GoogleAccessTokenSource } from '../lib/providers/googleSheetsApiProvider';

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
