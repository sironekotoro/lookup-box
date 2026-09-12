# LookupBox

LookupBox turns reference lists into a small, fast browser lookup tool.

Current MVP: Google Sheets via a thin GAS gateway. Planned: direct Google OAuth, multiple lists, SQLite and CSV.

## Current features

- Search every configured column incrementally
- Copy values with one click
- Re-sync from the popup
- Show last sync time
- Google Sheet URL based source selection
- Chrome and Firefox builds from one WXT codebase

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

## CI

`.github/workflows/build-extensions.yml` runs typecheck/tests and generates downloadable Chrome and Firefox ZIP artifacts on pushes, pull requests, and manual runs.

## GitHub Pages

The usage site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

After creating the repository, open:

`Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`

Expected project site:

`https://sironekotoro.github.io/lookup-box/`

## Current GAS setup

The current working baseline is documented in `gas/Code.gs`. Keep `LOOKUP_API_TOKEN` secret. The allowlist is optional; when absent, the gateway can open any Spreadsheet accessible to the GAS execution account if its ID is supplied.

The long-term target is to remove GAS from the normal user flow and use Google OAuth directly from the extension.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
