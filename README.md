# LookupBox

LookupBox turns reference lists into a small, fast browser lookup tool.

Current MVP: multiple Google Sheet-backed lookup lists via a thin GAS gateway. Planned: direct Google OAuth, SQLite and CSV.

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

Project site:

`https://sironekotoro.github.io/lookup-box/`

## Current GAS setup

The current working baseline is documented in `gas/Code.gs`. Keep `LOOKUP_API_TOKEN` secret. The allowlist is optional; when absent, the gateway can open any Spreadsheet accessible to the GAS execution account if its ID is supplied.

The long-term target is to remove GAS from the normal user flow and use Google OAuth directly from the extension.

## Design notes

See:

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `AGENTS.md`
