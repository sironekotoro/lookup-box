# Public distribution hardening

This document tracks the design constraints for publishing LookupBox to the Chrome Web Store and Firefox Add-ons.

## Current runtime model

LookupBox is a client-side browser extension. The normal build:

- uses Google OAuth
- calls the Google Sheets API directly
- stores list definitions and synchronized rows in browser local extension storage
- searches the cached rows locally
- does not use a LookupBox application server
- does not send popup search terms to analytics or telemetry services

## Current public-release blockers

### Google OAuth scope

The current implementation requests:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Google classifies this as a Sensitive scope. It allows read access to all Google Sheets the signed-in user can access.

The preferred public-release direction is to evaluate:

`https://www.googleapis.com/auth/drive.file`

Google classifies `drive.file` as Non-sensitive and recommends it for per-file access. The user should explicitly select the Sheet to use, ideally through Google Picker or another Google-supported file-selection flow.

Do not change the production scope until the Picker proof of concept proves all of the following:

1. A user-selected Google Sheet can be inspected through the Sheets API.
2. Unselected Sheets cannot be read using the same grant.
3. Existing multi-list registration and resync still work.
4. `FORMATTED_VALUE` behavior continues to preserve visible strings and leading zeroes.
5. Chrome and Firefox can use a public-release-safe auth flow without embedding a client secret.

### Firefox authorization flow

The current Firefox path exists as a development bridge and uses `identity.launchWebAuthFlow()` with a legacy implicit-style token response.

Google currently recommends authorization code + PKCE for modern browser authorization and discourages direct use of the implicit grant. The public Firefox build must not ship the development implicit bridge unchanged.

The least-privilege Picker proof of concept should therefore be treated as an auth architecture milestone, not as a scope-only edit.

### Firefox data collection declaration

New Firefox extensions must declare data collection/transmission practices through:

`browser_specific_settings.gecko.data_collection_permissions`

The final declaration must match the frozen public auth/data-flow design. Do not declare `none` merely because LookupBox has no analytics: the extension communicates with Google services as part of its primary function, so the final AMO classification must be reviewed against Mozilla's current data-transmission taxonomy.

### Chrome production identity

The development Chrome build pins an extension ID for OAuth testing. Before Chrome Web Store submission, confirm the production Web Store item identity and the Google OAuth client are paired correctly.

Do not assume the unpacked development ID and the Web Store production ID are interchangeable.

## Store-readiness phases

### Phase A — distribution baseline

- [x] Public privacy policy source document
- [x] Store listing / reviewer-note draft
- [x] Permission justification draft
- [x] Release checklist
- [ ] Publish the privacy policy on GitHub Pages
- [ ] Verify all disclosure text against the final auth implementation

### Phase B — least-privilege Google access

- [ ] Prototype Google Picker + `drive.file`
- [ ] Prove selected-file-only access
- [ ] Prove direct Sheets API reads still work
- [ ] Prove multi-list add/resync workflow
- [ ] Decide final Chrome authorization path
- [ ] Decide final Firefox authorization path

### Phase C — production authorization

- [ ] Remove Firefox implicit bridge from public builds
- [ ] Implement Google-supported public-client auth with PKCE where applicable
- [ ] Test token expiry, revocation, reconnect, and account switching
- [ ] Confirm no client secret exists in source, generated bundles, or CI artifacts

### Phase D — stores

- [ ] Freeze Firefox `data_collection_permissions`
- [ ] Prepare AMO source package and reviewer notes if required
- [ ] Fill Chrome Web Store Store Listing and Privacy tabs
- [ ] Verify Chrome production extension ID / OAuth client pairing
- [ ] Submit Firefox Add-ons package
- [ ] Submit Chrome Web Store package

## Permission justification draft

### `storage`

Required to keep registered list definitions and a local synchronized cache so LookupBox can search quickly without fetching Google Sheets on every keystroke.

### `identity`

Required to authorize the user with Google and obtain access needed to read the Google Sheet(s) selected or configured for LookupBox.

### `https://sheets.googleapis.com/*`

Required so the extension can read spreadsheet metadata and formatted cell values directly from the Google Sheets API. LookupBox does not request write access to Sheets.

## Security / review invariants

- no OAuth client secret in the extension
- no access token in repository files or logs
- no remote executable code
- no telemetry or advertising SDK
- no transmission of popup search terms
- no broad web-page host permissions unrelated to the product's single purpose
- list contents remain local after synchronization except for direct Google API requests needed to refresh them
