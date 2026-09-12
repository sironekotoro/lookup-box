# Google OAuth development setup

LookupBox is moving from the GAS gateway to direct Google Sheets API access.

The normal user experience should be:

1. Install LookupBox.
2. Click `Googleに接続`.
3. Approve read-only Google Sheets access.
4. Paste a Google Sheet URL and register a lookup list.

GAS URL and API Token are retained only as a migration/recovery fallback.

## Scope

LookupBox currently requests:

`https://www.googleapis.com/auth/spreadsheets.readonly`

This lets LookupBox read Google Sheets the signed-in user can access. It does not grant write access.

Google classifies this as a sensitive scope. During development, keep the OAuth consent screen in Testing mode and add the test Google accounts explicitly. Public distribution will require the appropriate Google OAuth verification or a later least-privilege design.

## Google Cloud project

1. Create or select a Google Cloud project for LookupBox.
2. Enable **Google Sheets API**.
3. Configure the OAuth consent screen.
4. During development, use **Testing** and add the Google accounts that will test LookupBox.

Do not create or embed an OAuth client secret in the extension. Browser extensions are public clients.

## Chrome

Chrome uses `chrome.identity.getAuthToken()`.

LookupBox now pins a development Chrome extension identity through the manifest `key`, so unpacked builds use this stable extension ID:

`fknnikkfcolngfdemfoimajmbjdpkjbp`

The earlier unpacked ID `pcijmegbnfhdklhemhejcpklmloenokk` was created before the ID was pinned. Do not use that older ID when creating the OAuth client.

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

## Firefox development bridge

Firefox does not expose Chrome's `getAuthToken()` API. LookupBox keeps the browser difference behind the Google auth adapter and currently uses `identity.launchWebAuthFlow()` for the Firefox development bridge.

The Firefox manifest uses a fixed Gecko extension ID:

`lookupbox@sironekotoro.com`

This keeps `browser.identity.getRedirectURL()` stable across temporary installs.

1. Install the Firefox build temporarily from `about:debugging`.
2. Open LookupBox settings.
3. Expand **開発情報** and copy the displayed `redirect URL`.
4. In Google Cloud, create a **Web application** OAuth client for the Firefox development bridge.
5. Register the exact redirect URL shown by LookupBox as an authorized redirect URI.
6. Copy the generated client ID.

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

The current Firefox bridge receives a short-lived access token and does not store a refresh token. Google's legacy implicit-flow documentation now recommends newer code/PKCE approaches for modern browser applications, so this path is considered development-only until the public-release auth design is finalized.

## Build

```bash
npm run check
npm run zip:chrome
npm run zip:firefox
```

When the relevant client ID is absent, LookupBox still builds successfully but the settings page reports that OAuth is not configured. This lets CI validate the code without putting credentials in the repository.

## GAS fallback

Existing GAS settings remain available under **従来のGAS接続（移行・復旧用）**. Existing multi-list definitions are preserved when switching the connection mode from GAS to OAuth.
