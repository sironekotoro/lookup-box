import { extractSpreadsheetId } from './googleSheet';
import { makeLookupListId, mapBundleToLookupList } from './lists';
import type { DatasetBundle, LookupList } from './types';

const CACHE_KEY = 'lookup.cache.v2';
const LEGACY_SETTINGS_V2_KEY = 'lookup.settings.v2';
const LEGACY_SETTINGS_V3_KEY = 'lookup.settings.v3';
const SETTINGS_KEY = 'lookup.settings.v4';
const INVALID_SETTINGS_BACKUP_KEY = 'lookup.settings.v4.invalid';
const DISCONNECTED_KEY = 'lookup.google.disconnected';
// Keep room for settings and browser bookkeeping below Chrome's 10 MiB local quota.
export const MAX_CACHE_BYTES = 8 * 1024 * 1024;

export class CacheWriteError extends Error {
  constructor(message: string) { super(message); }
}

export interface LookupSettings {
  useMock?: boolean;
  lists: LookupList[];
  legacySpreadsheetUrl?: string;
  legacySheetName?: string;
}

export class InvalidLookupSettingsError extends Error {
  constructor(public readonly invalidCount: number, invalidShape = false) {
    super(invalidShape
      ? '保存済みのリスト設定の形式を読み取れません。設定は変更せずに保持しました。'
      : `保存済みリストのうち${invalidCount}件を読み取れません。設定は変更せずに保持しました。`);
  }
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

function normalizeLookupList(value: unknown): LookupList | null {
  if (!value || typeof value !== 'object') return null;
  const list = value as Partial<LookupList> & { keyColumn?: string; valueColumn?: string };
  if (![
    list.id,
    list.spreadsheetId,
    list.spreadsheetUrl,
    list.spreadsheetTitle,
    list.sheetName,
  ].every((part) => typeof part === 'string' && part.length > 0)) return null;

  const legacyColumns = [list.keyColumn, list.valueColumn]
    .filter((column): column is string => typeof column === 'string' && column.length > 0);
  const legacySelection = [...new Set(legacyColumns)];
  const validColumns = (columns: unknown): columns is string[] =>
    Array.isArray(columns) && columns.every((column) => typeof column === 'string' && column.length > 0)
    && new Set(columns).size === columns.length;
  const searchColumns = validColumns(list.searchColumns) ? list.searchColumns : legacySelection;
  const displayColumns = validColumns(list.displayColumns) ? list.displayColumns : legacySelection;
  const copyColumns = validColumns(list.copyColumns) ? list.copyColumns : legacySelection;
  if (searchColumns.length === 0 || displayColumns.length === 0) return null;
  if (copyColumns.some((column) => !displayColumns.includes(column))) return null;
  return {
    id: list.id!, spreadsheetId: list.spreadsheetId!, spreadsheetUrl: list.spreadsheetUrl!,
    spreadsheetTitle: list.spreadsheetTitle!, sheetName: list.sheetName!,
    searchColumns, displayColumns, copyColumns
  };
}

export function normalizeSettings(raw: unknown, cache?: Partial<CacheValue>): LookupSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (Array.isArray(source.lists)) {
    const lists = source.lists.map(normalizeLookupList).filter((list): list is LookupList => list !== null);
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
        searchColumns: [...new Set([keyColumn, valueColumn])],
        displayColumns: [...new Set([keyColumn, valueColumn])],
        copyColumns: [...new Set([keyColumn, valueColumn])]
      });
    } catch {
      // Preserve the source URL/name below so the settings screen can repair it.
    }
  }

  return {
    useMock: legacy.useMock === true && lists.length === 0,
    lists,
    legacySpreadsheetUrl: spreadsheetUrl,
    legacySheetName: sheetName
  };
}

export async function saveCache(bundles: DatasetBundle[]): Promise<void> {
  await saveCacheValue({ bundles, syncedAt: new Date().toISOString() });
}

export async function clearCache(): Promise<void> {
  await browser.storage.local.remove(CACHE_KEY);
}

export async function isGoogleDisconnected(): Promise<boolean> {
  const result = await browser.storage.local.get(DISCONNECTED_KEY);
  return result[DISCONNECTED_KEY] === true;
}

export async function setGoogleDisconnected(disconnected: boolean): Promise<void> {
  await browser.storage.local.set({ [DISCONNECTED_KEY]: disconnected });
}

async function saveCacheValue(value: CacheValue): Promise<void> {
  await writeCache({ [CACHE_KEY]: value });
}

async function writeCache(update: Record<string, unknown>): Promise<void> {
  const cache = update[CACHE_KEY];
  const bytes = new TextEncoder().encode(CACHE_KEY + JSON.stringify(cache)).length;
  if (bytes > MAX_CACHE_BYTES) {
    throw new CacheWriteError('同期データが保存上限（約8 MB）を超えました。使用する列やリストを減らし、再同期してください。以前の検索データは保持しています。');
  }
  try {
    await browser.storage.local.set(update);
  } catch {
    throw new CacheWriteError('同期データを保存できませんでした。ブラウザの空き容量やリストの大きさを確認してください。以前の検索データは保持しています。');
  }
}

export async function saveListSettingsAndCache(settings: LookupSettings, bundles: DatasetBundle[]): Promise<void> {
  await writeCache({
    [SETTINGS_KEY]: settings,
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
  const result = await browser.storage.local.get([
    SETTINGS_KEY,
    LEGACY_SETTINGS_V3_KEY,
    LEGACY_SETTINGS_V2_KEY,
    CACHE_KEY
  ]);
  const current = result[SETTINGS_KEY];
  if (Object.hasOwn(result, SETTINGS_KEY)) {
    if (!current || typeof current !== 'object' || !Array.isArray((current as LookupSettings).lists)) {
      throw new InvalidLookupSettingsError(0, true);
    }
    const normalized = normalizeSettings(current);
    if (normalized.lists.length !== (current as LookupSettings).lists.length) {
      throw new InvalidLookupSettingsError((current as LookupSettings).lists.length - normalized.lists.length);
    }
    if (JSON.stringify(current) !== JSON.stringify(normalized)) await saveSettings(normalized);
    return normalized;
  }

  const cached = result[CACHE_KEY] as Partial<CacheValue> | undefined;
  const legacy = result[LEGACY_SETTINGS_V3_KEY] ?? result[LEGACY_SETTINGS_V2_KEY];
  const migrated = normalizeSettings(legacy, cached);
  let mappedCache: CacheValue | undefined;
  if (migrated.lists.length === 1 && cached?.bundles?.length) {
    const list = migrated.lists[0]!;
    const sourceBundle = cached.bundles.find((bundle) => bundle.definition.sheet_name === list.sheetName)
      ?? cached.bundles[0];
    if (sourceBundle) {
      const mapped = mapBundleToLookupList(sourceBundle, list, migrated.lists);
      mappedCache = { bundles: [mapped], syncedAt: cached.syncedAt };
    }
  }

  if (mappedCache) await writeCache({ [SETTINGS_KEY]: migrated, [CACHE_KEY]: mappedCache });
  else await saveSettings(migrated);
  await browser.storage.local.remove([LEGACY_SETTINGS_V3_KEY, LEGACY_SETTINGS_V2_KEY]);

  return migrated;
}

export async function recoverInvalidSettings(): Promise<LookupSettings> {
  const stored = await browser.storage.local.get([SETTINGS_KEY, INVALID_SETTINGS_BACKUP_KEY]);
  const raw = stored[SETTINGS_KEY];
  if (!Object.hasOwn(stored, SETTINGS_KEY)) throw new Error('復旧する設定が見つかりません。');
  const validListArray = !!raw && typeof raw === 'object' && Array.isArray((raw as LookupSettings).lists);
  const normalized = validListArray ? normalizeSettings(raw) : { lists: [] };
  if (validListArray && normalized.lists.length === (raw as LookupSettings).lists.length) return loadSettings();
  // Keep the first damaged version so repeated recovery cannot overwrite the backup.
  if (stored[INVALID_SETTINGS_BACKUP_KEY] === undefined) {
    await browser.storage.local.set({ [INVALID_SETTINGS_BACKUP_KEY]: raw });
  }
  await saveSettings(normalized);
  return normalized;
}

export async function loadInvalidSettingsBackup(): Promise<unknown> {
  const stored = await browser.storage.local.get([SETTINGS_KEY, INVALID_SETTINGS_BACKUP_KEY]);
  return Object.hasOwn(stored, SETTINGS_KEY) ? stored[SETTINGS_KEY] : stored[INVALID_SETTINGS_BACKUP_KEY];
}

export async function saveSettings(settings: LookupSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
