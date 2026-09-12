# Roadmap

## Completed baseline

- [x] Initial Google Sheet lookup prototype
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

## Direct Google OAuth milestone

- [x] Google auth adapter boundary
- [x] Chrome `chrome.identity.getAuthToken()` implementation
- [x] Firefox `identity.launchWebAuthFlow()` development bridge
- [x] Direct Google Sheets API provider
- [x] Read Spreadsheet metadata directly
- [x] Read formatted cell values directly
- [x] Google Cloud OAuth consent configuration for development
- [x] Chrome Extension OAuth client configured in CI
- [x] Firefox development OAuth client configured in CI
- [x] Runtime smoke test direct OAuth in Chrome
- [x] Runtime smoke test direct OAuth in Firefox
- [x] Preserve compatible list definitions during old-settings migration

## OAuth-only distribution milestone

- [x] Remove old gateway host permissions from Chrome / Firefox manifests
- [x] Remove old gateway settings from normal UI
- [x] Remove runtime gateway provider from standard extension source path
- [x] Migrate settings to OAuth-only schema and discard old connection credentials
- [x] Add CI package audit for forbidden gateway runtime strings/permissions
- [x] Keep historical gateway code only as repository reference material

## Public distribution hardening

- [ ] Google OAuth verification for public distribution or narrower scope design
- [ ] Google Picker + `drive.file` evaluation for least-privilege public distribution
- [ ] Replace/validate Firefox development auth bridge with public-release-safe authorization flow
- [ ] Privacy / permission documentation
- [ ] Firefox `data_collection_permissions` declaration
- [ ] Stable Chrome production extension ID / Web Store identity strategy
- [ ] Firefox store publication
- [ ] Chrome Web Store publication

## Later

- [ ] Per-list sync timestamp
- [ ] SQLite file picker UI
- [ ] CSV provider
- [ ] Import/export of LookupBox settings
