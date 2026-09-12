# Roadmap

## Completed baseline

- [x] Google Sheet URL based lookup via GAS
- [x] Generic header-driven search
- [x] One-click copy
- [x] Popup re-sync
- [x] Last-sync timestamp
- [x] Local cache
- [x] Chrome / Firefox package builds in GitHub Actions
- [x] GitHub Pages usage site

## Multi-list milestone

- [x] Register multiple list configurations
- [x] Choose Sheet, key column, and value column
- [x] Auto-name from Spreadsheet title
- [x] Disambiguate duplicate title with `/ Sheet name`
- [x] Further disambiguate same Sheet with key/value columns
- [x] List switcher in popup
- [x] Re-sync all registered lists from popup
- [x] Legacy single-list settings migration
- [ ] Per-list sync timestamp

## Next milestone: direct Google OAuth

- [ ] Register extension identity / OAuth client
- [ ] Google sign-in from extension
- [ ] Fetch Spreadsheet metadata directly
- [ ] Keep Chrome/Firefox auth differences behind an auth adapter
- [ ] Remove GAS/API-token requirement from normal flow
- [ ] Preserve existing multi-list configuration during migration

## Public distribution hardening

- [ ] Google Picker + `drive.file` evaluation for least-privilege public distribution
- [ ] Privacy / permission documentation
- [ ] Firefox `data_collection_permissions` declaration
- [ ] Stable Firefox extension ID
- [ ] Firefox store publication
- [ ] Chrome Web Store publication

## Later

- [ ] SQLite file picker UI
- [ ] CSV provider
- [ ] Import/export of LookupBox settings
