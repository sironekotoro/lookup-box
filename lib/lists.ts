import { extractSpreadsheetId, sanitizeDatasetId } from './googleSheet';
import type { DatasetBundle, LookupList, SpreadsheetInspection } from './types';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function makeLookupListId(
  spreadsheetId: string,
  sheetName: string,
  keyColumn: string,
  valueColumn: string
): string {
  const base = [spreadsheetId, sheetName, keyColumn, valueColumn].join('\u001f');
  return `sheet_${sanitizeDatasetId(sheetName)}_${stableHash(base)}`;
}

export function createLookupList(
  inspection: SpreadsheetInspection,
  spreadsheetUrl: string,
  sheetName: string,
  keyColumn: string,
  valueColumn: string
): LookupList {
  const spreadsheetId = inspection.spreadsheetId || extractSpreadsheetId(spreadsheetUrl);
  return {
    id: makeLookupListId(spreadsheetId, sheetName, keyColumn, valueColumn),
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle: inspection.title || 'Google Sheet',
    sheetName,
    keyColumn,
    valueColumn
  };
}

export function getLookupListDisplayName(list: LookupList, lists: LookupList[]): string {
  const title = list.spreadsheetTitle || 'Google Sheet';
  const sameTitle = lists.filter((candidate) => candidate.spreadsheetTitle === list.spreadsheetTitle);
  if (sameTitle.length <= 1) return title;

  const sameSheet = sameTitle.filter((candidate) => candidate.sheetName === list.sheetName);
  if (sameSheet.length <= 1) return `${title} / ${list.sheetName}`;

  return `${title} / ${list.sheetName} (${list.keyColumn} → ${list.valueColumn})`;
}

function selectedColumns(list: LookupList): string[] {
  return list.keyColumn === list.valueColumn
    ? [list.keyColumn]
    : [list.keyColumn, list.valueColumn];
}

export function mapBundleToLookupList(
  bundle: DatasetBundle,
  list: LookupList,
  lists: LookupList[]
): DatasetBundle {
  const columns = selectedColumns(list);
  return {
    definition: {
      ...bundle.definition,
      dataset_id: list.id,
      display_name: getLookupListDisplayName(list, lists),
      sheet_name: list.sheetName,
      search_columns: columns,
      display_columns: columns,
      copy_columns: columns,
      primary_key: list.keyColumn,
      enabled: true,
      provider: 'google_sheets'
    },
    rows: bundle.rows
  };
}

export function activeLookupBundles(
  bundles: DatasetBundle[],
  lists: LookupList[],
  useMock = false
): DatasetBundle[] {
  if (useMock) return bundles.filter((bundle) => bundle.definition.provider === 'mock');
  const activeIds = new Set(lists.map((list) => list.id));
  return bundles.filter((bundle) => activeIds.has(bundle.definition.dataset_id));
}

export function applyLookupListDisplayNames(
  bundles: DatasetBundle[],
  lists: LookupList[]
): DatasetBundle[] {
  const byId = new Map(lists.map((list) => [list.id, list]));
  return bundles.map((bundle) => {
    const list = byId.get(bundle.definition.dataset_id);
    if (!list) return bundle;
    return {
      ...bundle,
      definition: {
        ...bundle.definition,
        display_name: getLookupListDisplayName(list, lists)
      }
    };
  });
}
