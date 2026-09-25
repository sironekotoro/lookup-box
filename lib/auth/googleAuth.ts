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

export function buildFirefoxGoogleAuthUrl(
  clientId: string,
  redirectUrl: string,
  state: string,
  interactive: boolean
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUrl);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SHEETS_READONLY_SCOPE);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  if (!interactive) url.searchParams.set('prompt', 'none');
  return url.toString();
}

export function parseFirefoxOAuthRedirect(
  redirectUrl: string,
  expectedState: string
): { token: string; expiresIn: number } {
  const url = new URL(redirectUrl);
  const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const error = params.get('error');
  if (error) throw new Error(`Google OAuth error: ${error}`);

  const state = params.get('state');
  if (!state || state !== expectedState) throw new Error('Google OAuth state mismatch.');

  const token = params.get('access_token');
  if (!token) throw new Error('Google OAuth access token was not returned.');

  const expires = Number(params.get('expires_in') ?? '3600');
  const expiresIn = Number.isFinite(expires) && expires > 0 ? expires : 3600;
  return { token, expiresIn };
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
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000
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
  const authUrl = buildFirefoxGoogleAuthUrl(clientId, redirectUrl, state, interactive);
  const finalUrl = await (browser.identity as any).launchWebAuthFlow({
    url: authUrl,
    interactive
  }) as string | undefined;

  if (!finalUrl) {
    throw new Error(interactive
      ? 'Googleへの接続を完了できませんでした。'
      : 'Googleへの再認証が必要です。設定画面から「Googleに接続」を実行してください。');
  }

  const parsed = parseFirefoxOAuthRedirect(finalUrl, state);
  return rememberToken(parsed.token, parsed.expiresIn);
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
