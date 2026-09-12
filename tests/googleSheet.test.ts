import { describe, expect, it } from 'vitest';
import { extractSpreadsheetId, sanitizeDatasetId } from '../lib/googleSheet';

describe('Google Sheet helpers', () => {
  it('extracts a spreadsheet id from URL', () => {
    expect(extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1Abc_def-XYZ1234567890/edit#gid=0')).toBe('1Abc_def-XYZ1234567890');
  });
  it('accepts a raw spreadsheet id', () => {
    expect(extractSpreadsheetId('1Abc_def-XYZ1234567890')).toBe('1Abc_def-XYZ1234567890');
  });
  it('sanitizes a sheet name', () => {
    expect(sanitizeDatasetId('Customer List 2026')).toBe('customer_list_2026');
  });
});
