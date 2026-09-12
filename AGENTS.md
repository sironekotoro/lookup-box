# AGENTS.md — LookupBox

## Product intent

LookupBox is a generic browser lookup tool for reference lists. It is not a database editor. The primary interaction is search -> inspect -> copy.

## Canonical product direction

- Product name: LookupBox
- Repository name: `lookup-box`
- Keep the UX minimal.
- Users should not need to invent a list name; derive it from Spreadsheet metadata.
- Future minimum list configuration: Spreadsheet, Sheet, key column, value column.
- When a Spreadsheet title collides, display `Spreadsheet title / Sheet name`.

## Architecture

- Keep data-source-specific logic behind provider interfaces.
- Google Sheets is the first production source.
- Preserve room for local SQLite and CSV.
- The current GAS path is a working baseline, not the final public architecture.
- The target architecture is direct Google OAuth + Sheets API, subject to least-privilege review before public distribution.

## Security

- Never commit OAuth secrets, API tokens, access tokens, or private Sheet data.
- Do not add telemetry that transmits lookup data without explicit approval.
- SQLite remains read-only and local-only unless explicitly redesigned.
- Treat code-like values as strings; preserve leading zeroes.

## Changes and validation

Before proposing a PR:

```bash
npm run typecheck
npm test
npm run build:chrome
npm run build:firefox
```

For packaging changes also run:

```bash
npm run zip:chrome
npm run zip:firefox
```

## Git discipline

- Use feature branches for non-trivial changes.
- No force-push to shared branches.
- Do not auto-merge PRs.
- Keep `main` buildable.
- Update `docs/ROADMAP.md` when milestone scope changes materially.
