export function extractSpreadsheetId(input: string): string {
  const value = input.trim();
  if (!value) throw new Error('Google Sheet URL を入力してください。');

  const urlMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  throw new Error('Google Sheets のURLまたはSpreadsheet IDを確認してください。');
}

export function sanitizeDatasetId(sheetName: string): string {
  const normalized = sheetName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'sheet';
}
