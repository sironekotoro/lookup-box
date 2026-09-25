import type { SheetInspection } from './types';

export function selectableHeaders(sheet: SheetInspection | null | undefined): string[] {
  if (!sheet) return [];
  const unavailable = new Set(sheet.duplicateHeaders ?? []);
  return [...new Set(sheet.headers.filter((header) => header && !unavailable.has(header)))];
}
