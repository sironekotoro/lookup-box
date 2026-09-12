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

## Direct Google OAuth milestone

- [x] Google auth adapter boundary
- [x] Chrome `chrome.identity.getAuthToken()` implementation
- [x] Firefox `identity.launchWebAuthFlow()` development bridge
- [x] Direct Google Sheets API provider
- [x] Read Spreadsheet metadata directly
- [x] Read formatted cell values directly
- [x] Keep existing multi-list definitions during GAS → OAuth migration
- [x] Move GAS URL / API Token out of the normal settings flow
- [x] Fixed Firefox extension ID for a stable redirect URL
- [x] CI support for build-time OAuth client IDs
- [ ] Create Google Cloud OAuth consent configuration for development
- [ ] Create Chrome Extension OAuth client and set `WXT_GOOGLE_CHROME_CLIENT_ID`
- [ ] Create Firefox development OAuth client and set `WXT_GOOGLE_FIREFOX_CLIENT_ID`
- [ ] Runtime smoke test direct OAuth in Chrome
- [ ] Runtime smoke test direct OAuth in Firefox
- [ ] Remove GAS dependency from the default shipped artifacts after OAuth smoke tests pass

## Public distribution hardening

- [ ] Google OAuth verification for public distribution or narrower scope design
- [ ] Google Picker + `drive.file` evaluation for least-privilege public distribution
- [ ] Replace/validate Firefox development auth bridge with public-release-safe authorization flow
- [ ] Privacy / permission documentation
- [ ] Firefox `data_collection_permissions` declaration
- [ ] Stable Chrome production extension ID
- [ ] Firefox store publication
- [ ] Chrome Web Store publication

## Later

- [ ] SQLite file picker UI
- [ ] CSV provider
- [ ] Import/export of LookupBox settings
