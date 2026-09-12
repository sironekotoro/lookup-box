# LookupBox

<img src="assets/branding/lookupbox-icon.svg" alt="LookupBox icon" width="96">

LookupBox turns reference lists into a small, fast browser lookup tool.

Current product direction: multiple Google Sheet-backed lookup lists with direct Google OAuth + Sheets API. Standard Chrome/Firefox distribution artifacts are OAuth-only; the old GAS gateway is retained in the repository only as historical/reference material.

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
- Legacy single-list settings migration without carrying forward old gateway credentials
- Direct Google Sheets API provider
- Browser-specific Google auth adapter
- OAuth-only standard distribution artifacts

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

Normal users install LookupBox, click **Googleに接続**, paste a Google Sheet URL, and register the list. No GAS URL or API Token is present in the standard build.

See `docs/OAUTH_SETUP.md` for the one-time Google Cloud development setup.

## Versioning

Browser-extension releases use a four-part numeric version such as `0.4.26.913`, while `package.json` remains normal SemVer for npm/tooling compatibility.

See `docs/VERSIONING.md` for the release-version convention.

## CI

`.github/workflows/build-extensions.yml` runs typecheck/tests, generates Chrome and Firefox ZIP artifacts, verifies the release version, and rejects packages that contain legacy GAS host permissions or runtime strings.

GitHub Actions reads OAuth client IDs from repository variables named:

- `WXT_GOOGLE_CHROME_CLIENT_ID`
- `WXT_GOOGLE_FIREFOX_CLIENT_ID`

The build remains valid when those variables are absent; OAuth is simply reported as not configured in that artifact.

## GitHub Pages

The usage site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

Project site:

`https://sironekotoro.github.io/lookup-box/`

## Historical GAS reference

The previous gateway implementation remains in `gas/Code.gs` for historical/reference purposes only. Standard extension builds do not import it, expose its settings, or request its host permissions.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/OAUTH_SETUP.md`
- `docs/VERSIONING.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
