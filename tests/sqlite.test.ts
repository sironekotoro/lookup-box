import { describe, expect, it } from 'vitest';
import { quoteIdentifier } from '../lib/providers/sqliteProvider';

describe('SQLite identifier quoting', () => {
  it('quotes identifiers safely', () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
  });
});
