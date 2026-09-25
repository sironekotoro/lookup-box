import { activeLookupBundles, applyLookupListDisplayNames, getLookupListDisplayName, mapBundleToLookupList } from './lists';
import { listLoadOptions, makeGoogleSourceProvider } from './providers/googleSource';
import { loadCache, saveCache } from './storage';
import type { DatasetBundle, LookupList } from './types';

export type ListSyncResult = {
  succeeded: string[];
  failed: Array<{ name: string; reason: string }>;
};

async function loadList(list: LookupList, lists: LookupList[]): Promise<DatasetBundle> {
  const loaded = await makeGoogleSourceProvider(listLoadOptions(list)).load();
  const source = loaded[0];
  if (!source) throw new Error('リストを読み込めませんでした。');
  return mapBundleToLookupList(source, list, lists);
}

// Call while holding the sync lock. Each successful list is saved separately;
// a failed fetch or write leaves that list's previous cache intact.
export async function syncLists(
  lists: LookupList[],
  readList: (list: LookupList, lists: LookupList[]) => Promise<DatasetBundle> = loadList
): Promise<ListSyncResult> {
  const result: ListSyncResult = { succeeded: [], failed: [] };
  let bundles = activeLookupBundles((await loadCache()).bundles, lists);
  for (const list of lists) {
    const name = getLookupListDisplayName(list, lists);
    try {
      const bundle = await readList(list, lists);
      const next = applyLookupListDisplayNames([
        ...bundles.filter((current) => current.definition.dataset_id !== list.id), bundle
      ], lists);
      await saveCache(next);
      bundles = next;
      result.succeeded.push(name);
    } catch (error) {
      result.failed.push({ name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

export function syncResultMessage(result: ListSyncResult): string {
  const success = result.succeeded.length ? `✓ ${result.succeeded.length}リストを同期しました。` : '';
  const failure = result.failed.length
    ? `${result.failed.length}リストが失敗しました: ${result.failed.map(({ name, reason }) => `${name}（${reason}）`).join('、')}`
    : '';
  return [success, failure].filter(Boolean).join(' ');
}
