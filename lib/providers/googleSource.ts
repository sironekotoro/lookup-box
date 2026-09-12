import type { LookupList } from '../types';
import {
  GoogleSheetsApiProvider,
  type GoogleSheetLoadOptions
} from './googleSheetsApiProvider';

export function makeGoogleSourceProvider(
  simpleOptions?: GoogleSheetLoadOptions
): GoogleSheetsApiProvider {
  return new GoogleSheetsApiProvider(simpleOptions);
}

export function listLoadOptions(list: LookupList): GoogleSheetLoadOptions {
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
