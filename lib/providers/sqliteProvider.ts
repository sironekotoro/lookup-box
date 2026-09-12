import initSqlJs, { type Database } from 'sql.js';
import type { DatasetBundle, DatasetDefinition, LookupProvider, LookupRow } from '../types';

export interface SqliteDatasetConfig {
  datasetId: string;
  displayName: string;
  tableOrView: string;
  searchColumns: string[];
  displayColumns: string[];
  copyColumns: string[];
  primaryKey: string;
}

export class LocalSqliteProvider implements LookupProvider {
  id = 'local_sqlite';
  label = 'Local SQLite';

  constructor(private file: File, private configs: SqliteDatasetConfig[]) {}

  async load(): Promise<DatasetBundle[]> {
    const SQL = await initSqlJs({
      locateFile: (file) => {
        // SQLite is not wired into the user-facing UI yet. Keep the provider
        // buildable while reserving the extension-local asset path for the
        // future WASM packaging step.
        const wasmPath = `/sql-wasm/${file}` as Parameters<typeof browser.runtime.getURL>[0];
        return browser.runtime.getURL(wasmPath);
      }
    });
    const bytes = new Uint8Array(await this.file.arrayBuffer());
    const db = new SQL.Database(bytes);

    try {
      return this.configs.map((config) => this.loadConfig(db, config));
    } finally {
      db.close();
    }
  }

  private loadConfig(db: Database, config: SqliteDatasetConfig): DatasetBundle {
    const safeName = quoteIdentifier(config.tableOrView);
    const result = db.exec(`SELECT * FROM ${safeName}`);
    const rows: LookupRow[] = [];
    if (result[0]) {
      const { columns, values } = result[0];
      for (const valueRow of values) {
        const row: LookupRow = {};
        columns.forEach((column, i) => {
          row[column] = valueRow[i] == null ? '' : String(valueRow[i]);
        });
        rows.push(row);
      }
    }

    const definition: DatasetDefinition = {
      dataset_id: config.datasetId,
      display_name: config.displayName,
      sheet_name: config.tableOrView,
      search_columns: config.searchColumns,
      display_columns: config.displayColumns,
      copy_columns: config.copyColumns,
      primary_key: config.primaryKey,
      enabled: true,
      provider: 'local_sqlite'
    };

    return { definition, rows };
  }
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
