import { describe, expect, it } from 'vitest';
import { normalizeText, tokenizeQuery } from '../lib/normalize';

describe('normalizeText', () => {
  it('normalizes width and case', () => {
    expect(normalizeText(' ＡＢＣ ')).toBe('abc');
  });
  it('tokenizes whitespace', () => {
    expect(tokenizeQuery(' 横浜   001 ')).toEqual(['横浜','001']);
  });
});
