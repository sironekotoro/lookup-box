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
- Official magnifying-glass + list browser icon

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

The extension currently requests the read-only Sheets scope:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Normal users install LookupBox, click **Googleに接続**, paste a Google Sheet URL, and register the list. No GAS URL or API Token is present in the standard build.

Public distribution hardening is in progress. The current broad read-only Sheets scope and Firefox development auth bridge are not treated as the final public-store authorization design; see `docs/PUBLIC_DISTRIBUTION.md` and Issue #11.

See `docs/OAUTH_SETUP.md` for the development Google Cloud setup.

## Privacy

LookupBox keeps registered list definitions and synchronized rows in browser-local extension storage. Popup search terms are processed locally and are not sent to the developer or to an analytics service.

Development/public-documentation privacy page:

`https://sironekotoro.github.io/lookup-box/privacy.html`

Source: `docs/PRIVACY.md`

For production Google OAuth branding/verification, the homepage and privacy policy will be served from a verified custom domain controlled by the developer. The default `github.io` project URL is not treated as the final OAuth verification domain.

## Versioning

Browser-extension releases use a four-part numeric version such as `0.5.26.913`, while `package.json` remains normal SemVer for npm/tooling compatibility.

See `docs/VERSIONING.md` for the release-version convention.

## Icon assets

The editable master is `assets/branding/lookupbox-icon.svg`. Browser-ready 16/32/48/128px PNGs live under `public/icons/` and are wired into both the extension icon and toolbar action.

## CI

`.github/workflows/build-extensions.yml` runs typecheck/tests, generates Chrome and Firefox ZIP artifacts, verifies the release version and icon assets, and rejects packages that contain legacy GAS host permissions or runtime strings.

GitHub Actions reads OAuth client IDs from repository variables named:

- `WXT_GOOGLE_CHROME_CLIENT_ID`
- `WXT_GOOGLE_FIREFOX_CLIENT_ID`

The build remains valid when those variables are absent; OAuth is simply reported as not configured in that artifact.

## GitHub Pages

The usage site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

Development/public documentation site:

`https://sironekotoro.github.io/lookup-box/`

Privacy policy page:

`https://sironekotoro.github.io/lookup-box/privacy.html`

## Public distribution

Store submission work is tracked in `docs/PUBLIC_DISTRIBUTION.md` and Issue #9. The least-privilege authorization spike is tracked in Issue #11. Draft listing text and the release checklist live in:

- `docs/STORE_LISTING.md`
- `docs/RELEASE_CHECKLIST.md`

## Historical GAS reference

The previous gateway implementation remains in `gas/Code.gs` for historical/reference purposes only. Standard extension builds do not import it, expose its settings, or request its host permissions.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/OAUTH_SETUP.md`
- `docs/PUBLIC_DISTRIBUTION.md`
- `docs/PRIVACY.md`
- `docs/STORE_LISTING.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/VERSIONING.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
