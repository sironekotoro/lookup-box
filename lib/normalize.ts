export function normalizeText(input: unknown): string {
  return String(input ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ja-JP');
}

export function tokenizeQuery(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}
