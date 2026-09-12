# LookupBox

LookupBox turns reference lists into a small, fast browser lookup tool.

Current product direction: multiple Google Sheet-backed lookup lists with direct Google OAuth + Sheets API. The existing GAS gateway remains only as a migration/recovery fallback while OAuth is being validated.

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
- Legacy single-list settings migration
- Direct Google Sheets API provider
- Browser-specific Google auth adapter
- GAS fallback for existing installations

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

When the relevant client ID is present, the settings screen exposes **Googleに接続** and normal use no longer requires a GAS URL or API Token.

See `docs/OAUTH_SETUP.md` for the one-time Google Cloud development setup.

## CI

`.github/workflows/build-extensions.yml` runs typecheck/tests and generates downloadable Chrome and Firefox ZIP artifacts on pushes, pull requests, and manual runs.

GitHub Actions reads the optional OAuth client IDs from repository variables named:

- `WXT_GOOGLE_CHROME_CLIENT_ID`
- `WXT_GOOGLE_FIREFOX_CLIENT_ID`

The build remains valid when those variables are absent; OAuth is simply reported as not configured in that artifact.

## GitHub Pages

The usage site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

Project site:

`https://sironekotoro.github.io/lookup-box/`

## GAS fallback

The previous working gateway is documented in `gas/Code.gs`. Keep `LOOKUP_API_TOKEN` secret if this fallback is used.

GAS configuration is intentionally moved out of the normal product flow. Existing list definitions are preserved when changing the connection mode from GAS to OAuth.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/OAUTH_SETUP.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
