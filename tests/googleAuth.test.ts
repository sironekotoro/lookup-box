import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SHEETS_READONLY_SCOPE,
  buildFirefoxGoogleAuthUrl,
  exchangeFirefoxGoogleCode,
  makeFirefoxLoopbackRedirectUrl,
  makePkceChallenge,
  parseFirefoxOAuthRedirect
} from '../lib/auth/googleAuth';

afterEach(() => vi.unstubAllGlobals());

describe('Google OAuth helpers', () => {
  it('converts Firefox identity redirect URLs to the supported loopback form', () => {
    expect(makeFirefoxLoopbackRedirectUrl('https://abc123.extensions.allizom.org/'))
      .toBe('http://127.0.0.1/mozoauth2/abc123');
  });

  it('creates a unique PKCE S256 challenge for each authorization attempt', async () => {
    const first = await makePkceChallenge();
    const second = await makePkceChallenge();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(first.verifier));
    const expected = Buffer.from(digest).toString('base64url');

    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.challenge).toBe(expected);
    expect(second.verifier).not.toBe(first.verifier);
  });

  it('builds a Firefox code auth URL with the readonly Sheets scope and state', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl(
      'client.apps.googleusercontent.com',
      'http://127.0.0.1/mozoauth2/abc123',
      'state-123',
      true,
      'challenge-123'
    ));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1/mozoauth2/abc123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(SHEETS_READONLY_SCOPE);
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-123');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('include_granted_scopes')).toBe(false);
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('requests a silent flow when interaction is disabled', () => {
    const url = new URL(buildFirefoxGoogleAuthUrl('client', 'http://127.0.0.1/mozoauth2/example', 'state', false, 'challenge'));
    expect(url.searchParams.get('prompt')).toBe('none');
  });

  it('parses an OAuth authorization code and validates state', () => {
    const result = parseFirefoxOAuthRedirect(
      'http://127.0.0.1/mozoauth2/example?code=abc123&state=state-123',
      'http://127.0.0.1/mozoauth2/example',
      'state-123'
    );
    expect(result).toBe('abc123');
  });

  it('rejects an unexpected OAuth state', () => {
    expect(() => parseFirefoxOAuthRedirect(
      'http://127.0.0.1/mozoauth2/example?code=abc123&state=wrong',
      'http://127.0.0.1/mozoauth2/example',
      'expected'
    )).toThrow('state mismatch');
  });

  it('rejects a redirect from a different identity or an implicit token response', () => {
    const redirect = 'http://127.0.0.1/mozoauth2/example';
    expect(() => parseFirefoxOAuthRedirect(
      'http://127.0.0.1/mozoauth2/another?code=abc123&state=state', redirect, 'state'
    )).toThrow('redirect URL mismatch');
    expect(() => parseFirefoxOAuthRedirect(
      `${redirect}#access_token=abc123&state=state`, redirect, 'state'
    )).toThrow('state mismatch');
  });

  it('exchanges the code and verifier without a client secret or stored refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { access_token: 'access-token', token_type: 'Bearer', expires_in: 3600,
          refresh_token: 'never-persist', scope: SHEETS_READONLY_SCOPE };
      }
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await exchangeFirefoxGoogleCode('client-id', 'http://127.0.0.1/mozoauth2/example', 'code', 'verifier');

    expect(result).toEqual({ token: 'access-token', expiresIn: 3600 });
    const [endpoint, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://oauth2.googleapis.com/token');
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'client-id', code: 'code', code_verifier: 'verifier',
      redirect_uri: 'http://127.0.0.1/mozoauth2/example', grant_type: 'authorization_code'
    });
    expect(body.has('client_secret')).toBe(false);
  });

  it('rejects failed token exchanges and tokens with insufficient scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400,
      async json() { return { error: 'invalid_request', error_description: 'client_secret is missing' }; }
    }));
    await expect(exchangeFirefoxGoogleCode('client', 'redirect', 'code', 'verifier'))
      .rejects.toThrow('HTTP 400: invalid_request / client_secret required');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400,
      async json() { return { error: 'invalid_grant', error_description: 'Sensitive authorization code: abc' }; }
    }));
    await expect(exchangeFirefoxGoogleCode('client', 'redirect', 'code', 'verifier'))
      .rejects.toThrow('HTTP 400: invalid_grant');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      async json() { return { access_token: 'token', token_type: 'Bearer', expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/userinfo.email' }; }
    }));
    await expect(exchangeFirefoxGoogleCode('client', 'redirect', 'code', 'verifier'))
      .rejects.toThrow('token response was invalid');
  });
});
