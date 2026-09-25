# AGENTS.md — LookupBox

## Product intent

LookupBox is a generic browser lookup tool for reference lists. It is not a database editor. The primary interaction is search -> inspect -> copy.

## Canonical product direction

- Product name: LookupBox
- Repository name: `lookup-box`
- Keep the UX minimal.
- Users should not need to invent a list name; derive it from Spreadsheet metadata.
- Minimum Google list configuration: Spreadsheet, Sheet, at least one search column and one display column. Copy columns may be empty.
- When a Spreadsheet title collides, display `Spreadsheet title / Sheet name`.

## Architecture

- Keep data-source-specific logic behind provider interfaces.
- Google Sheets is the first production source.
- Standard Chrome/Firefox artifacts use direct Google OAuth + Sheets API only.
- Do not reintroduce the old gateway runtime or its host permissions into normal distribution artifacts.
- `gas/` is historical/reference material only and must not be imported by extension runtime code.
- Preserve room for local SQLite and CSV.
- Public distribution still requires least-privilege/OAuth review.

## Security

- Never commit OAuth secrets, API tokens, access tokens, or private Sheet data.
- OAuth client IDs are public application identifiers; client secrets are not used in the browser extension.
- Do not add telemetry that transmits lookup data without explicit approval.
- SQLite remains read-only and local-only unless explicitly redesigned.
- Treat code-like values as strings; preserve leading zeroes.
- Keep CI checks that reject old gateway permissions/runtime strings from packaged artifacts.

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
