# Google OAuth development setup

LookupBox uses direct Google OAuth + Google Sheets API access in its standard Chrome and Firefox builds.

Normal user experience:

1. Install LookupBox.
2. Click `Googleに接続`.
3. Approve read-only Google Sheets access.
4. Paste a Google Sheet URL and register a lookup list.

## Scope

LookupBox currently requests:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Google grants read access to all Google Sheets the signed-in user can access. LookupBox inspects the Spreadsheet URL entered by the user and synchronizes registered lists. This scope does not grant write access.

Google classifies this as a sensitive scope. During development, keep the OAuth consent screen in Testing mode and add the test Google accounts explicitly. Public distribution requires Google OAuth sensitive-scope verification.

## Google Cloud project

1. Create or select a Google Cloud project for LookupBox.
2. Enable **Google Sheets API**.
3. Configure the OAuth consent screen.
4. During development, use **Testing** and add the Google accounts that will test LookupBox.

Do not create or embed an OAuth client secret in the extension. Browser extensions are public clients.

## Chrome

Chrome uses `chrome.identity.getAuthToken()`.

LookupBox pins a development Chrome extension identity through the manifest `key`, so unpacked builds use this stable extension ID:

`fknnikkfcolngfdemfoimajmbjdpkjbp`

1. In Google Cloud, open **Google Auth Platform -> Clients**.
2. Create an OAuth client with application type **Chrome Extension**.
3. Use `LookupBox Chrome` as the client name.
4. Enter `fknnikkfcolngfdemfoimajmbjdpkjbp` as the Item ID.
5. Copy the generated client ID.

For a local build, put it in `.env.chrome.local`:

```text
WXT_GOOGLE_CHROME_CLIENT_ID=...apps.googleusercontent.com
```

For GitHub Actions, set a repository variable:

```bash
gh variable set WXT_GOOGLE_CHROME_CLIENT_ID \
  --repo sironekotoro/lookup-box \
  --body '...apps.googleusercontent.com'
```

The OAuth client ID is an application identifier, not a secret. Do not add a client secret.

Before Chrome Web Store publication, verify that the production Web Store identity matches the OAuth client strategy. If the store identity changes, create a production OAuth client for that production ID.

## Firefox authorization code + PKCE

Firefox does not expose Chrome's `getAuthToken()` API. LookupBox uses `identity.launchWebAuthFlow()` to receive a Google authorization code and exchanges it directly for a short-lived access token using PKCE (S256). It keeps the access token in memory, does not save refresh tokens, and sends no client secret.

The Firefox manifest uses a fixed Gecko extension ID:

`lookupbox@sironekotoro.com`

Firefox's normal identity redirect URL uses a Mozilla-owned dummy domain. LookupBox converts that identity to the loopback form supported by Firefox 86+. The manifest requires Firefox 140+ to prepare for the built-in AMO data consent declaration tracked in #28:

`http://127.0.0.1/mozoauth2/<stable-subdomain>`

The LookupBox settings page shows the actual loopback URI used by the browser. A Desktop OAuth client permits the loopback redirect without registering an exact URI in Google Cloud.

1. Install the Firefox build temporarily from `about:debugging`.
2. Open LookupBox settings.
3. Expand **開発情報** and copy the displayed `redirect URL`.
4. In Google Cloud, create a new OAuth client of application type **Desktop app** in the same project. The previous Firefox **Web application** client ID is not valid for this secretless token exchange.
5. Copy the new Desktop app client ID only; do not copy its client secret into the extension, repository, or Actions variables.

For a local Firefox build:

```text
WXT_GOOGLE_FIREFOX_CLIENT_ID=...apps.googleusercontent.com
```

For GitHub Actions:

```bash
gh variable set WXT_GOOGLE_FIREFOX_CLIENT_ID \
  --repo sironekotoro/lookup-box \
  --body '...apps.googleusercontent.com'
```

Replace the existing `WXT_GOOGLE_FIREFOX_CLIENT_ID` value in CI with this new Desktop app client ID before testing a Firefox build from Actions. The old Web application client ID can remain in Google Cloud during migration, but a build that still uses it cannot complete the new Firefox token exchange. A locally loaded Firefox build also needs its own `.env.firefox.local` value. Build success alone does not confirm live Google authorization.

After configuring the client, verify Google connect, search, token expiry, disconnect/revoke, reconnect, and account switching in Firefox. The user data declaration and AMO consent screen are tracked separately in #28.

## Build

```bash
npm run check
npm run zip:chrome
npm run zip:firefox
```

When the relevant client ID is absent, LookupBox still builds successfully but the settings page reports that OAuth is not configured.

## Upgrade from older builds

The current settings schema is OAuth-only. When an older installation is opened, compatible lookup-list definitions and cached rows are migrated forward where possible. Old connection credentials are not retained in the current settings key, so the user reconnects with **Googleに接続**.

The historical `gas/Code.gs` file is kept in the repository for reference only; it is not part of the standard browser runtime or package permissions.
