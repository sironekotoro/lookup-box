import { describe, expect, it } from 'vitest';
import {
  SHEETS_READONLY_SCOPE,
  buildFirefoxGoogleAuthUrl,
  makeFirefoxLoopbackRedirectUrl,
  parseFirefoxOAuthRedirect
} from '../lib/auth/googleAuth';

describe('Google OAuth helpers', () => {
  it('converts Firefox identity redirect URLs to the supported loopback form', () => {
    expect(makeFirefoxLoopbackRedirectUrl('https://abc123.extensions.allizom.org/'))
      .toBe('http://127.0.0.1/mozoauth2/abc123');
  });

  it('builds a Firefox auth URL with the readonly Sheets scope and state', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl(
      'client.apps.googleusercontent.com',
      'http://127.0.0.1/mozoauth2/abc123',
      'state-123',
      true
    ));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1/mozoauth2/abc123');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('scope')).toBe(SHEETS_READONLY_SCOPE);
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('requests a silent flow when interaction is disabled', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl('client', 'http://127.0.0.1/mozoauth2/example', 'state', false));
    expect(url.searchParams.get('prompt')).toBe('none');
  });

  it('parses an OAuth access token and validates state', () => {
    const result = parseFirefoxOAuthRedirect(
      'http://127.0.0.1/mozoauth2/example#access_token=abc123&token_type=Bearer&expires_in=1800&state=state-123',
      'state-123'
    );
    expect(result).toEqual({ token: 'abc123', expiresIn: 1800 });
  });

  it('rejects an unexpected OAuth state', () => {
    expect(() => parseFirefoxOAuthRedirect(
      'http://127.0.0.1/mozoauth2/example#access_token=abc123&state=wrong',
      'expected'
    )).toThrow('state mismatch');
  });
});
