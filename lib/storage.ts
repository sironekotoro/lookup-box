import { extractSpreadsheetId } from './googleSheet';
import { makeLookupListId, mapBundleToLookupList } from './lists';
import type { DatasetBundle, LookupList } from './types';

const CACHE_KEY = 'lookup.cache.v2';
const LEGACY_SETTINGS_V2_KEY = 'lookup.settings.v2';
const LEGACY_SETTINGS_V3_KEY = 'lookup.settings.v3';
const SETTINGS_KEY = 'lookup.settings.v4';

export interface LookupSettings {
  useMock?: boolean;
  lists: LookupList[];
  legacySpreadsheetUrl?: string;
  legacySheetName?: string;
}

export type CacheValue = {
  bundles: DatasetBundle[];
  syncedAt?: string;
};

type LegacySingleListSettings = {
  spreadsheetUrl?: string;
  sheetName?: string;
  useMock?: boolean;
};

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isLookupList(value: unknown): value is LookupList {
  if (!value || typeof value !== 'object') return false;
  const list = value as Partial<LookupList>;
  return [
    list.id,
    list.spreadsheetId,
    list.spreadsheetUrl,
    list.spreadsheetTitle,
    list.sheetName,
    list.keyColumn,
    list.valueColumn
  ].every((part) => typeof part === 'string' && part.length > 0);
}

export function normalizeSettings(raw: unknown, cache?: Partial<CacheValue>): LookupSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (Array.isArray(source.lists)) {
    const lists = source.lists.filter(isLookupList);
    return {
      useMock: source.useMock === true && lists.length === 0,
      lists,
      legacySpreadsheetUrl: text(source.legacySpreadsheetUrl),
      legacySheetName: text(source.legacySheetName)
    };
  }

  const legacy = source as LegacySingleListSettings;
  const spreadsheetUrl = text(legacy.spreadsheetUrl);
  const sheetName = text(legacy.sheetName);
  const bundles = cache?.bundles ?? [];
  const bundle = bundles.find((candidate) => candidate.definition.sheet_name === sheetName) ?? bundles[0];
  const searchColumns = bundle?.definition.search_columns?.filter(Boolean) ?? [];
  const displayColumns = bundle?.definition.display_columns?.filter(Boolean) ?? [];
  const keyColumn = searchColumns[0] ?? bundle?.definition.primary_key ?? displayColumns[0];
  const valueColumn = searchColumns.find((column) => column !== keyColumn)
    ?? displayColumns.find((column) => column !== keyColumn)
    ?? keyColumn;

  const lists: LookupList[] = [];
  if (spreadsheetUrl && sheetName && keyColumn && valueColumn) {
    try {
      const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
      lists.push({
        id: makeLookupListId(spreadsheetId, sheetName, keyColumn, valueColumn),
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: 'Google Sheet',
        sheetName,
        keyColumn,
        valueColumn
      });
    } catch {
      // Preserve the source URL/name below so the settings screen can repair it.
    }
  }

  return {
    useMock: legacy.useMock === true,
    lists,
    legacySpreadsheetUrl: spreadsheetUrl,
    legacySheetName: sheetName
  };
}

export async function saveCache(bundles: DatasetBundle[]): Promise<void> {
  await browser.storage.local.set({
    [CACHE_KEY]: { bundles, syncedAt: new Date().toISOString() }
  });
}

async function saveCacheValue(value: CacheValue): Promise<void> {
  await browser.storage.local.set({ [CACHE_KEY]: value });
}

export async function loadCache(): Promise<CacheValue> {
  const result = await browser.storage.local.get(CACHE_KEY);
  const cached = result[CACHE_KEY] as Partial<CacheValue> | undefined;
  return {
    bundles: cached?.bundles ?? [],
    syncedAt: cached?.syncedAt
  };
}

export async function upsertCacheBundle(bundle: DatasetBundle): Promise<void> {
  const cache = await loadCache();
  const bundles = cache.bundles.filter((candidate) => candidate.definition.dataset_id !== bundle.definition.dataset_id);
  bundles.push(bundle);
  await saveCache(bundles);
}

export async function removeCacheBundle(datasetId: string): Promise<void> {
  const cache = await loadCache();
  await saveCache(cache.bundles.filter((bundle) => bundle.definition.dataset_id !== datasetId));
}

export async function loadSettings(): Promise<LookupSettings> {
  const result = await browser.storage.local.get([
    SETTINGS_KEY,
    LEGACY_SETTINGS_V3_KEY,
    LEGACY_SETTINGS_V2_KEY,
    CACHE_KEY
  ]);
  const current = result[SETTINGS_KEY];
  if (current) return normalizeSettings(current);

  const cached = result[CACHE_KEY] as Partial<CacheValue> | undefined;
  const legacy = result[LEGACY_SETTINGS_V3_KEY] ?? result[LEGACY_SETTINGS_V2_KEY];
  const migrated = normalizeSettings(legacy, cached);
  await saveSettings(migrated);
  await browser.storage.local.remove([LEGACY_SETTINGS_V3_KEY, LEGACY_SETTINGS_V2_KEY]);

  if (migrated.lists.length === 1 && cached?.bundles?.length) {
    const list = migrated.lists[0]!;
    const sourceBundle = cached.bundles.find((bundle) => bundle.definition.sheet_name === list.sheetName)
      ?? cached.bundles[0];
    if (sourceBundle) {
      const mapped = mapBundleToLookupList(sourceBundle, list, migrated.lists);
      await saveCacheValue({ bundles: [mapped], syncedAt: cached.syncedAt });
    }
  }

  return migrated;
}

export async function saveSettings(settings: LookupSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
