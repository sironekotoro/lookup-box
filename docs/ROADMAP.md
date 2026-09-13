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

### Distribution baseline

- [x] Privacy policy source document
- [x] Public privacy policy page prepared for GitHub Pages
- [x] Chrome / Firefox store listing draft
- [x] Permission justification draft
- [x] Public release checklist
- [ ] Re-verify disclosures after final auth design is frozen

### Least-privilege Google access

- [ ] Prototype Google Picker + `drive.file`
- [ ] Prove selected-file-only access
- [ ] Prove Sheets API metadata/value reads still work with the per-file grant
- [ ] Preserve multi-list registration/resync and formatted values
- [ ] Decide final Chrome public authorization flow

### Production Firefox authorization

- [ ] Remove the development implicit-flow bridge from public builds
- [ ] Implement/validate Google-supported public-client authorization using PKCE where applicable
- [ ] Test token expiry, revoke, reconnect, and account switching
- [ ] Finalize Firefox `data_collection_permissions` against the frozen data flow

### Store submission

- [ ] Confirm stable Chrome Web Store production extension ID / OAuth client pairing
- [ ] Complete Google OAuth verification only if still required by the final scope design
- [ ] Prepare AMO source package/reviewer notes if required
- [ ] Complete Chrome Web Store Store Listing and Privacy tabs
- [ ] Firefox Add-ons submission
- [ ] Chrome Web Store submission

See `docs/PUBLIC_DISTRIBUTION.md` and Issue #9 for the detailed acceptance criteria.

## Later

- [ ] Per-list sync timestamp
- [ ] SQLite file picker UI
- [ ] CSV provider
- [ ] Import/export of LookupBox settings
