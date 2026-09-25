export type LookupRow = Record<string, string>;

export interface DatasetDefinition {
  dataset_id: string;
  display_name: string;
  sheet_name: string;
  search_columns: string[];
  display_columns: string[];
  copy_columns: string[];
  primary_key: string;
  enabled: boolean;
  description?: string;
  provider?: 'google_sheets' | 'mock' | 'local_sqlite';
}

export interface DatasetBundle {
  definition: DatasetDefinition;
  rows: LookupRow[];
}

export interface LookupProvider {
  id: string;
  label: string;
  load(): Promise<DatasetBundle[]>;
}

export interface LookupList {
  id: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  sheetName: string;
  searchColumns: string[];
  displayColumns: string[];
  copyColumns: string[];
}

export interface SheetInspection {
  name: string;
  headers: string[];
  duplicateHeaders?: string[];
  rowCount?: number;
}

export interface SpreadsheetInspection {
  spreadsheetId: string;
  title: string;
  sheets: SheetInspection[];
}
