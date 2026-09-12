import type { DatasetBundle } from './types';

export const mockBundles: DatasetBundle[] = [
  {
    definition: {
      dataset_id: 'companies',
      display_name: 'Company codes',
      sheet_name: 'companies',
      search_columns: ['Name', 'Code'],
      display_columns: ['Name', 'Code'],
      copy_columns: ['Name', 'Code'],
      primary_key: 'Code',
      enabled: true,
      description: 'Public demo data for name ↔ code lookup',
      provider: 'mock'
    },
    rows: [
      { Name: 'Apple', Code: 'AAPL' },
      { Name: 'Microsoft', Code: 'MSFT' }
    ]
  }
];
