import type { DatasetBundle } from './types';

const CACHE_KEY = 'lookup.cache.v2';
const SETTINGS_KEY = 'lookup.settings.v2';

export interface LookupSettings {
  gasUrl?: string;
  apiToken?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
  useMock?: boolean;
}

type CacheValue = {
  bundles: DatasetBundle[];
  syncedAt?: string;
};

export async function saveCache(bundles: DatasetBundle[]): Promise<void> {
  await browser.storage.local.set({
    [CACHE_KEY]: { bundles, syncedAt: new Date().toISOString() }
  });
}

export async function loadCache(): Promise<CacheValue> {
  const result = await browser.storage.local.get(CACHE_KEY);
  const cached = result[CACHE_KEY] as Partial<CacheValue> | undefined;
  return {
    bundles: cached?.bundles ?? [],
    syncedAt: cached?.syncedAt
  };
}

export async function loadSettings(): Promise<LookupSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as LookupSettings | undefined) ?? {};
}

export async function saveSettings(settings: LookupSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
