import type { DatasetBundle, LookupRow } from './types';
import { normalizeText, tokenizeQuery } from './normalize';

export interface SearchHit {
  datasetId: string;
  datasetName: string;
  row: LookupRow;
  score: number;
}

export function searchDatasets(
  bundles: DatasetBundle[],
  query: string,
  selectedDatasetId?: string
): SearchHit[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const bundle of bundles) {
    if (selectedDatasetId && bundle.definition.dataset_id !== selectedDatasetId) continue;

    for (const row of bundle.rows) {
      const fields = bundle.definition.search_columns.map((c) => normalizeText(row[c]));
      const joined = fields.join(' ');
      if (!tokens.every((t) => joined.includes(t))) continue;

      let score = 0;
      for (const token of tokens) {
        for (const field of fields) {
          if (field === token) score += 100;
          else if (field.startsWith(token)) score += 40;
          else if (field.includes(token)) score += 10;
        }
      }
      hits.push({
        datasetId: bundle.definition.dataset_id,
        datasetName: bundle.definition.display_name,
        row,
        score
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 100);
}
