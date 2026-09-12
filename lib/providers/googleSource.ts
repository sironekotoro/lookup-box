import type { LookupList } from '../types';
import type { LookupSettings } from '../storage';
import { GoogleSheetsApiProvider } from './googleSheetsApiProvider';
import { GoogleSheetsProvider, type SimpleSheetLoadOptions } from './googleSheetsProvider';

export type GoogleConnectionMode = 'oauth' | 'gas';

export function effectiveGoogleConnectionMode(settings: LookupSettings): GoogleConnectionMode | undefined {
  if (settings.connectionMode === 'oauth') return 'oauth';
  if (settings.connectionMode === 'gas') return 'gas';
  if (settings.gasUrl && settings.apiToken) return 'gas';
  return undefined;
}

export function makeGoogleSourceProvider(
  settings: LookupSettings,
  simpleOptions?: SimpleSheetLoadOptions
): GoogleSheetsApiProvider | GoogleSheetsProvider {
  const mode = effectiveGoogleConnectionMode(settings);
  if (mode === 'oauth') return new GoogleSheetsApiProvider(simpleOptions);
  if (mode === 'gas') {
    return new GoogleSheetsProvider(settings.gasUrl ?? '', settings.apiToken ?? '', simpleOptions);
  }
  throw new Error('Googleに接続してください。従来のGAS接続を使う場合は詳細設定から保存してください。');
}

export function listLoadOptions(list: LookupList): SimpleSheetLoadOptions {
  const columns = list.keyColumn === list.valueColumn
    ? [list.keyColumn]
    : [list.keyColumn, list.valueColumn];
  return {
    spreadsheetUrl: list.spreadsheetUrl,
    sheetName: list.sheetName,
    searchColumns: columns,
    displayColumns: columns,
    copyColumns: columns
  };
}
