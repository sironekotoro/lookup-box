# LookupBox

LookupBox turns reference lists into a small, fast browser lookup tool.

Current product direction: multiple Google Sheet-backed lookup lists with direct Google OAuth + Sheets API. Standard Chrome and Firefox distribution artifacts are OAuth-only and do not contain the previous gateway runtime or its host permissions.

## Current features

- Register multiple Google Sheet lookup lists
- Choose Sheet, key column, and value column per list
- Derive list names automatically from Spreadsheet metadata
- Search key/value columns incrementally
- Switch lists from the popup or search all lists together
- Copy values with one click
- Re-sync all registered lists from the popup
- Show last sync time
- Chrome and Firefox builds from one WXT codebase
- Legacy single-list/list-definition migration
- Direct Google Sheets API provider
- Browser-specific Google auth adapter

## Development

Requirements: Node.js 22+

```bash
npm install
npm run check
npm run build:chrome
npm run build:firefox
```

Package files:

```bash
npm run zip:chrome
npm run zip:firefox
```

WXT supports browser-specific targets through `-b chrome` and `-b firefox`.

## Google OAuth

OAuth client IDs are build-time configuration, not end-user settings.

- Chrome: `WXT_GOOGLE_CHROME_CLIENT_ID`
- Firefox development bridge: `WXT_GOOGLE_FIREFOX_CLIENT_ID`

The extension requests the read-only Sheets scope:

`https://www.googleapis.com/auth/spreadsheets.readonly`

The user flow is:

1. Install LookupBox.
2. Click **Googleに接続**.
3. Paste a Google Sheet URL.
4. Choose Sheet / Key / Value.
5. Search and copy from the popup.

See `docs/OAUTH_SETUP.md` for the Google Cloud development setup.

## CI

`.github/workflows/build-extensions.yml` runs typecheck/tests and generates downloadable Chrome and Firefox ZIP artifacts on pushes, pull requests, and manual runs.

GitHub Actions reads OAuth client IDs from repository variables named:

- `WXT_GOOGLE_CHROME_CLIENT_ID`
- `WXT_GOOGLE_FIREFOX_CLIENT_ID`

CI also unpacks both browser ZIPs and fails if the normal artifacts contain the old gateway host permissions or runtime configuration strings.

## GitHub Pages

The usage site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

Project site:

`https://sironekotoro.github.io/lookup-box/`

## Historical gateway reference

`gas/Code.gs` is retained only as historical/reference material for the earlier implementation. It is not imported by the extension runtime and is not part of the standard browser distribution artifacts.

When upgrading an older installation, LookupBox keeps compatible list definitions/cache where possible but does not carry legacy connection credentials into the current settings schema. Users reconnect through Google OAuth.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/OAUTH_SETUP.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
