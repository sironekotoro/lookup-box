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
  return {
    spreadsheetUrl: list.spreadsheetUrl,
    sheetName: list.sheetName,
    searchColumns: list.searchColumns,
    displayColumns: list.displayColumns,
    copyColumns: list.copyColumns
  };
}
