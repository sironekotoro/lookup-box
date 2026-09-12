import { describe, expect, it } from 'vitest';
import {
  SHEETS_READONLY_SCOPE,
  buildFirefoxGoogleAuthUrl,
  parseFirefoxOAuthRedirect
} from '../lib/auth/googleAuth';

describe('Google OAuth helpers', () => {
  it('builds a Firefox auth URL with the readonly Sheets scope and state', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl(
      'client.apps.googleusercontent.com',
      'https://example.extensions.allizom.org/',
      'state-123',
      true
    ));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.extensions.allizom.org/');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('scope')).toBe(SHEETS_READONLY_SCOPE);
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('requests a silent flow when interaction is disabled', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl('client', 'https://redirect/', 'state', false));
    expect(url.searchParams.get('prompt')).toBe('none');
  });

  it('parses an OAuth access token and validates state', () => {
    const result = parseFirefoxOAuthRedirect(
      'https://redirect/#access_token=abc123&token_type=Bearer&expires_in=1800&state=state-123',
      'state-123'
    );
    expect(result).toEqual({ token: 'abc123', expiresIn: 1800 });
  });

  it('rejects an unexpected OAuth state', () => {
    expect(() => parseFirefoxOAuthRedirect(
      'https://redirect/#access_token=abc123&state=wrong',
      'expected'
    )).toThrow('state mismatch');
  });
});
