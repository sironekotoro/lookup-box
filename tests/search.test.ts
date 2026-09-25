import { describe, expect, it } from 'vitest';
import { mockBundles } from '../lib/mock';
import { cellValue, searchDatasets } from '../lib/search';

describe('searchDatasets', () => {
  it('ignores inherited or malformed values in old caches', () => {
    expect(cellValue({}, '__proto__')).toBe('');
    expect(cellValue(Object.defineProperty({}, '__proto__', { value: { unsafe: true } }), '__proto__')).toBe('');
  });
  it('finds by name', () => {
    const hits = searchDatasets(mockBundles, 'Apple');
    expect(hits.some(h => h.row.Name === 'Apple')).toBe(true);
  });
  it('finds by code', () => {
    const hits = searchDatasets(mockBundles, 'MSFT', 'companies');
    expect(hits.some(h => h.row.Name === 'Microsoft')).toBe(true);
  });
  it('supports multi-token AND search', () => {
    const hits = searchDatasets(mockBundles, 'Apple AAPL', 'companies');
    expect(hits.length).toBe(1);
  });
});
