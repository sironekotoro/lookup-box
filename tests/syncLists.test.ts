import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_CACHE_BYTES, CacheWriteError, loadCache, saveCache, saveListSettingsAndCache } from '../lib/storage';
import { syncLists, syncResultMessage } from '../lib/syncLists';
import { withSyncLock } from '../lib/syncLock';
import type { DatasetBundle, LookupList } from '../lib/types';

const lists: LookupList[] = ['one', 'two', 'three'].map((id) => ({
  id, spreadsheetId: id, spreadsheetUrl: id, spreadsheetTitle: id,
  sheetName: 'Sheet1', searchColumns: ['Code'], displayColumns: ['Code'], copyColumns: []
}));

function bundle(id: string, code: string): DatasetBundle {
  return {
    definition: {
      dataset_id: id, display_name: id, sheet_name: 'Sheet1', search_columns: ['Code'],
      display_columns: ['Code'], copy_columns: [], primary_key: 'Code', enabled: true
    }, rows: [{ Code: code }]
  };
}

function fakeStorage(initial: Record<string, unknown>, reject?: (update: Record<string, unknown>) => boolean) {
  const values = structuredClone(initial);
  const set = vi.fn(async (update: Record<string, unknown>) => {
    if (reject?.(update)) throw new Error('QUOTA_BYTES quota exceeded');
    Object.assign(values, structuredClone(update));
  });
  vi.stubGlobal('browser', { storage: { local: {
    async get(key: string | string[]) {
      return Object.fromEntries((Array.isArray(key) ? key : [key])
        .filter((item) => Object.hasOwn(values, item)).map((item) => [item, structuredClone(values[item])]));
    }, set
  } } });
  return { values, set };
}

afterEach(() => vi.unstubAllGlobals());

describe('cache synchronization', () => {
  it('keeps successful lists and old data for fetch or quota failures', async () => {
    const { values } = fakeStorage({ 'lookup.cache.v2': { bundles: [
      bundle('one', 'old-one'), bundle('two', 'old-two'), bundle('three', 'old-three')
    ] } }, (update) => (update['lookup.cache.v2'] as { bundles: DatasetBundle[] })?.bundles
      .some((item) => item.definition.dataset_id === 'three' && item.rows[0]?.Code === 'too-large'));

    const result = await syncLists(lists, async (list) => {
      if (list.id === 'two') throw new Error('Google API unavailable');
      return bundle(list.id, list.id === 'one' ? 'new-one' : 'too-large');
    });

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(2);
    expect(syncResultMessage(result)).toContain('2リストが失敗');
    expect(syncResultMessage(result)).toContain('保存できませんでした');
    expect((await loadCache()).bundles.map((item) => item.rows[0]?.Code))
      .toEqual(['old-two', 'old-three', 'new-one']);
    expect((values['lookup.cache.v2'] as { bundles: DatasetBundle[] }).bundles).toHaveLength(3);
  });

  it('rejects an oversized cache before a write and leaves prior settings and cache intact', async () => {
    const previous = { lists: [lists[0]] };
    const { values, set } = fakeStorage({
      'lookup.settings.v4': previous,
      'lookup.cache.v2': { bundles: [bundle('one', 'prior')] }
    });
    // A realistic value column of roughly 1 KiB across 9,000 rows exceeds 8 MiB.
    const large = bundle('two', 'x'.repeat(1024));
    large.rows = Array.from({ length: 9000 }, (_, index) => ({ Code: `${index}`, Value: 'x'.repeat(1024) }));
    expect(new TextEncoder().encode(JSON.stringify(large)).length).toBeGreaterThan(MAX_CACHE_BYTES);
    await expect(saveListSettingsAndCache({ lists }, [large])).rejects.toBeInstanceOf(CacheWriteError);
    expect(set).not.toHaveBeenCalled();
    expect(values['lookup.settings.v4']).toEqual(previous);
    expect((await loadCache()).bundles[0]?.rows[0]?.Code).toBe('prior');
  });

  it('retains the previous cache if the browser rejects a write below the bound', async () => {
    const { values } = fakeStorage({ 'lookup.cache.v2': { bundles: [bundle('one', 'prior')] } }, () => true);
    await expect(saveCache([bundle('one', 'fresh')])).rejects.toThrow('以前の検索データは保持');
    expect((values['lookup.cache.v2'] as { bundles: DatasetBundle[] }).bundles[0]?.rows[0]?.Code).toBe('prior');
  });

  it('does not commit edited list settings when the cache cannot be saved', async () => {
    const previous = { lists: [lists[0]] };
    const { values } = fakeStorage({
      'lookup.settings.v4': previous,
      'lookup.cache.v2': { bundles: [bundle('one', 'prior')] }
    }, () => true);
    await expect(saveListSettingsAndCache({ lists: [lists[0]!, lists[1]!] }, [
      bundle('one', 'prior'), bundle('two', 'fresh')
    ])).rejects.toBeInstanceOf(CacheWriteError);
    expect(values['lookup.settings.v4']).toEqual(previous);
    expect((await loadCache()).bundles.map((item) => item.rows[0]?.Code)).toEqual(['prior']);
  });

  it('serializes a slow sync before a newer edit across extension pages', async () => {
    fakeStorage({ 'lookup.cache.v2': { bundles: [bundle('one', 'initial')] } });
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    let queue = Promise.resolve();
    vi.stubGlobal('navigator', { locks: { request: (_name: string, operation: () => Promise<void>) => {
      const result = queue.then(operation);
      queue = result.catch(() => {});
      return result;
    } } });
    const order: string[] = [];
    const old = withSyncLock(async () => {
      order.push('old-start');
      await barrier;
      await saveCache([bundle('one', 'older')]);
      order.push('old-commit');
    });
    const newer = withSyncLock(async () => {
      await saveCache([bundle('one', 'newer')]);
      order.push('new-commit');
    });
    await Promise.resolve();
    expect(order).toEqual(['old-start']);
    release();
    await Promise.all([old, newer]);
    expect(order).toEqual(['old-start', 'old-commit', 'new-commit']);
    expect((await loadCache()).bundles[0]?.rows[0]?.Code).toBe('newer');
  });
});
