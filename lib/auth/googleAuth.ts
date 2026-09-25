import { isGoogleDisconnected, setGoogleDisconnected } from '../storage';

export const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

export type GoogleAuthBrowser = 'chrome' | 'firefox' | 'other';

export interface GoogleAuthRuntimeInfo {
  browser: GoogleAuthBrowser;
  configured: boolean;
  redirectUrl?: string;
  extensionId?: string;
}

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function configuredClientId(): string {
  if (import.meta.env.CHROME) return (import.meta.env.WXT_GOOGLE_CHROME_CLIENT_ID ?? '').trim();
  if (import.meta.env.FIREFOX) return (import.meta.env.WXT_GOOGLE_FIREFOX_CLIENT_ID ?? '').trim();
  return '';
}

function currentBrowser(): GoogleAuthBrowser {
  if (import.meta.env.CHROME) return 'chrome';
  if (import.meta.env.FIREFOX) return 'firefox';
  return 'other';
}

export function isGoogleOAuthConfigured(): boolean {
  return configuredClientId().length > 0;
}

export function makeOAuthState(bytes = 18): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function makeFirefoxLoopbackRedirectUrl(identityRedirectUrl: string): string {
  const url = new URL(identityRedirectUrl);
  const subdomain = url.hostname.split('.')[0]?.trim();
  if (!subdomain) throw new Error('Firefox OAuth redirect URLを生成できませんでした。');
  return `http://127.0.0.1/mozoauth2/${encodeURIComponent(subdomain)}`;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function makePkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64Url(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function buildFirefoxGoogleAuthUrl(
  clientId: string,
  redirectUrl: string,
  state: string,
  interactive: boolean,
  codeChallenge: string
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SHEETS_READONLY_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (!interactive) url.searchParams.set('prompt', 'none');
  return url.toString();
}

export function parseFirefoxOAuthRedirect(
  finalUrl: string,
  expectedRedirectUrl: string,
  expectedState: string
): string {
  const url = new URL(finalUrl);
  const expected = new URL(expectedRedirectUrl);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname) {
    throw new Error('Google OAuth redirect URL mismatch.');
  }
  const params = url.searchParams;
  const error = params.get('error');
  if (error) throw new Error(`Google OAuth error: ${error}`);

  const state = params.get('state');
  if (!state || state !== expectedState) throw new Error('Google OAuth state mismatch.');

  const code = params.get('code');
  if (!code) throw new Error('Google OAuth authorization code was not returned.');
  return code;
}

export async function exchangeFirefoxGoogleCode(
  clientId: string,
  redirectUrl: string,
  code: string,
  verifier: string
): Promise<{ token: string; expiresIn: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUrl,
      grant_type: 'authorization_code'
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    // OAuth error codes are safe to show; the response may also contain sensitive details.
    let reason = '';
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        const { error, error_description } = body as Record<string, unknown>;
        if (typeof error === 'string' && /^[a-z_]{1,40}$/.test(error)) reason = error;
        if (reason === 'invalid_request' && typeof error_description === 'string' &&
            /client_secret (?:is )?(?:missing|required)/i.test(error_description)) {
          reason = 'invalid_request / client_secret required';
        }
      }
    } catch { /* A non-JSON response is still a token exchange failure. */ }
    throw new Error(`Google認証コードの交換に失敗しました（HTTP ${response.status}${reason ? `: ${reason}` : ''}）。`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== 'object') throw new Error('Google OAuth token response was invalid.');
  const { access_token, token_type, expires_in, scope } = result as Record<string, unknown>;
  if (typeof access_token !== 'string' || !access_token || token_type !== 'Bearer' ||
      typeof expires_in !== 'number' || !Number.isFinite(expires_in) || expires_in <= 0 ||
      (typeof scope === 'string' && !scope.split(' ').includes(SHEETS_READONLY_SCOPE))) {
    throw new Error('Google OAuth token response was invalid.');
  }
  // Do not persist refresh_token, even if Google includes one in its response.
  return { token: access_token, expiresIn: expires_in };
}

function readCachedToken(): string | null {
  if (!cachedToken) return null;
  if (Date.now() >= cachedToken.expiresAt - 30_000) {
    cachedToken = null;
    return null;
  }
  return cachedToken.token;
}

function rememberToken(token: string, expiresIn = 3600): string {
  cachedToken = {
    token,
    expiresAt: Date.now() + Math.max(1, expiresIn) * 1000
  };
  return token;
}

async function getChromeAccessToken(interactive: boolean): Promise<string> {
  const identity = (globalThis as any).chrome?.identity;
  if (!identity?.getAuthToken) throw new Error('Chrome Identity API is unavailable.');

  const result = await identity.getAuthToken({
    interactive,
    scopes: [SHEETS_READONLY_SCOPE]
  });
  const token = typeof result === 'string' ? result : result?.token;
  if (!token) {
    throw new Error(interactive
      ? 'Googleへの接続を完了できませんでした。'
      : 'Googleへの再認証が必要です。設定画面から「Googleに接続」を実行してください。');
  }
  return rememberToken(token);
}

async function getFirefoxAccessToken(interactive: boolean): Promise<string> {
  const clientId = configuredClientId();
  if (!clientId) throw new Error('Firefox用Google OAuth Client IDがこのビルドに設定されていません。');

  const identityRedirectUrl = browser.identity.getRedirectURL();
  const redirectUrl = makeFirefoxLoopbackRedirectUrl(identityRedirectUrl);
  const state = makeOAuthState();
  const { verifier, challenge } = await makePkceChallenge();
  const authUrl = buildFirefoxGoogleAuthUrl(clientId, redirectUrl, state, interactive, challenge);
  const finalUrl = await (browser.identity as any).launchWebAuthFlow({
    url: authUrl,
    interactive
  }) as string | undefined;

  if (!finalUrl) {
    throw new Error(interactive
      ? 'Googleへの接続を完了できませんでした。'
      : 'Googleへの再認証が必要です。設定画面から「Googleに接続」を実行してください。');
  }

  const code = parseFirefoxOAuthRedirect(finalUrl, redirectUrl, state);
  const { token, expiresIn } = await exchangeFirefoxGoogleCode(clientId, redirectUrl, code, verifier);
  return rememberToken(token, expiresIn);
}

export async function getGoogleAccessToken(interactive = false): Promise<string> {
  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuthがこのビルドに設定されていません。');
  }

  if (!interactive && await isGoogleDisconnected()) {
    throw new Error('Google接続は解除されています。設定画面から「Googleに接続」を実行してください。');
  }

  const cached = readCachedToken();
  if (cached) {
    if (interactive) await setGoogleDisconnected(false);
    return cached;
  }

  let token: string;
  if (import.meta.env.CHROME) token = await getChromeAccessToken(interactive);
  else if (import.meta.env.FIREFOX) token = await getFirefoxAccessToken(interactive);
  else throw new Error('このブラウザのGoogle OAuthにはまだ対応していません。');
  if (interactive) await setGoogleDisconnected(false);
  else if (await isGoogleDisconnected()) {
    await invalidateGoogleAccessToken(token);
    throw new Error('Google接続は解除されています。');
  }
  return token;
}

export async function invalidateGoogleAccessToken(token: string): Promise<void> {
  if (cachedToken?.token === token) cachedToken = null;
  if (!import.meta.env.CHROME) return;

  const identity = (globalThis as any).chrome?.identity;
  if (identity?.removeCachedAuthToken) {
    await identity.removeCachedAuthToken({ token });
  }
}

export async function clearGoogleAuth(): Promise<boolean> {
  let token: string | null = null;
  try { token = await getGoogleAccessToken(false); } catch { /* No usable token to revoke. */ }
  await setGoogleDisconnected(true);
  cachedToken = null;
  let revoked = false;
  try {
    if (token) {
      const response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(8000)
      });
      revoked = response.ok;
    }
  } catch {
    revoked = false;
  } finally {
    if (import.meta.env.CHROME) {
      const identity = (globalThis as any).chrome?.identity;
      if (identity?.clearAllCachedAuthTokens) await identity.clearAllCachedAuthTokens();
    }
  }
  return revoked;
}

export function getGoogleAuthRuntimeInfo(): GoogleAuthRuntimeInfo {
  let redirectUrl: string | undefined;
  try {
    const identityRedirectUrl = browser.identity?.getRedirectURL?.();
    redirectUrl = currentBrowser() === 'firefox' && identityRedirectUrl
      ? makeFirefoxLoopbackRedirectUrl(identityRedirectUrl)
      : identityRedirectUrl;
  } catch {
    redirectUrl = undefined;
  }

  return {
    browser: currentBrowser(),
    configured: isGoogleOAuthConfigured(),
    redirectUrl,
    extensionId: browser.runtime.id
  };
}
