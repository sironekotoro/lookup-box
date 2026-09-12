# Roadmap

## Completed baseline

- Google Sheet URL based lookup via GAS
- Generic header-driven search
- One-click copy
- Popup re-sync
- Last-sync timestamp
- Local cache
- Chrome MVP verified manually

## Next milestone: GitHub baseline

- [x] Repository skeleton
- [x] GitHub Actions: Chrome package
- [x] GitHub Actions: Firefox package
- [x] GitHub Pages usage site workflow
- [ ] Create `sironekotoro/lookup-box`
- [ ] First Actions run succeeds
- [ ] Enable Pages source = GitHub Actions and verify live URL
- [ ] Commit generated lockfile after first successful install

## OAuth milestone

- [ ] Register extension identity / OAuth client
- [ ] Google sign-in from extension
- [ ] Fetch Spreadsheet metadata directly
- [ ] Choose Sheet
- [ ] Choose key column
- [ ] Choose value column
- [ ] Remove GAS/API-token requirement from normal flow

## Multi-list milestone

- [ ] Register multiple list configurations
- [ ] Auto-name from Spreadsheet title
- [ ] Disambiguate duplicate title with `/ Sheet name`
- [ ] List switcher in popup
- [ ] Per-list sync metadata

## Later

- [ ] Google Picker + drive.file evaluation for public distribution
- [ ] SQLite file picker UI
- [ ] CSV provider
- [ ] Firefox store publication
- [ ] Chrome Web Store publication
