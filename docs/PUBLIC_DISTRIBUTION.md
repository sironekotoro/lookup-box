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

The preferred least-privilege direction is to evaluate:

`https://www.googleapis.com/auth/drive.file`

Google classifies `drive.file` as Non-sensitive and recommends it for per-file access. The user should explicitly select the Sheet to use.

However, this is not a simple scope-string replacement. Google Picker's normal web integration relies on Google client scripts / `gapi`, while Manifest V3 extension pages cannot load remote executable code. The official Picker web-component package also notes that the underlying Picker API may not function directly in an MV3 extension environment.

A remotely hosted Picker page that receives OAuth tokens would broaden LookupBox's data-flow/security surface and is not the preferred architecture.

The least-privilege spike therefore tests whether Google's browser-mediated Picker / OnePick flow (`trigger_onepick=true`) can be combined with a public-client-safe authorization-code + PKCE flow without a LookupBox-operated token-bearing remote page.

Do not change the production scope until the spike proves all of the following:

1. A user-selected Google Sheet can be inspected through the Sheets API.
2. Unselected Sheets cannot be read using the same grant.
3. Existing multi-list registration and resync still work.
4. `FORMATTED_VALUE` behavior continues to preserve visible strings and leading zeroes.
5. Chrome and Firefox can use a public-release-safe auth flow without embedding a client secret.
6. Access tokens and Sheet contents do not pass through a LookupBox-operated remote web page/server.

If that path is not viable, the fallback is to retain direct `spreadsheets.readonly` and complete Google's Sensitive Scope Verification rather than introduce weaker token handling. Sensitive-scope verification is materially lighter than restricted-scope verification and does not by itself require the restricted-scope security assessment.

See Issue #11 for the spike acceptance criteria.

### OAuth homepage / verified domain

A production external Google OAuth app needs a real homepage and privacy policy on a verified domain controlled by the developer. The default `sironekotoro.github.io` project URL is useful for development/public documentation, but should not be treated as the final OAuth verification domain.

Before Google brand/sensitive-scope verification, serve the LookupBox homepage and privacy policy from a verified custom domain (for example a LookupBox subdomain under `sironekotoro.com`) and use those exact URLs in Google Auth Platform.

The homepage must:

- identify LookupBox clearly
- describe its functionality and why Google user data is requested
- be publicly accessible without login
- link to the same privacy policy URL configured in Google Auth Platform

The custom domain must be verified in Google Search Console by an owner/editor of the Google Cloud project.

### Firefox authorization flow

The current Firefox path exists as a development bridge and uses `identity.launchWebAuthFlow()` with a legacy implicit-style token response.

Google currently recommends authorization code + PKCE for modern browser authorization and discourages direct use of the implicit grant. The public Firefox build must not ship the development implicit bridge unchanged.

The least-privilege spike should therefore be treated as an auth architecture milestone, not as a scope-only edit.

### Firefox data collection declaration

New Firefox extensions must declare data collection/transmission practices through:

`browser_specific_settings.gecko.data_collection_permissions`

The final declaration must match the frozen public auth/data-flow design. Do not declare `none` merely because LookupBox has no analytics: Mozilla defines transmission broadly as data handled outside the add-on/local browser, and LookupBox communicates with Google services as part of its primary function. The final AMO classification must be reviewed against Mozilla's current taxonomy once the auth path is frozen.

### Chrome production identity

The development Chrome build pins an extension ID for OAuth testing. Before Chrome Web Store submission, confirm the production Web Store item identity and the Google OAuth client are paired correctly.

Do not assume the unpacked development ID and the Web Store production ID are interchangeable.

## Store-readiness phases

### Phase A — distribution baseline

- [x] Public privacy policy source document
- [x] Store listing / reviewer-note draft
- [x] Permission justification draft
- [x] Release checklist
- [x] Privacy page prepared for GitHub Pages development URL
- [ ] Move homepage/privacy URLs to a verified custom domain for production OAuth branding
- [ ] Verify all disclosure text against the final auth implementation

### Phase B — least-privilege Google access

- [ ] Prototype a no-server/no-remote-token `drive.file` selection flow
- [ ] Test Google OnePick / browser-mediated Picker flow with PKCE
- [ ] Prove selected-file-only access
- [ ] Prove direct Sheets API reads still work
- [ ] Prove multi-list add/resync workflow
- [ ] Decide final Chrome authorization path
- [ ] Decide final Firefox authorization path
- [ ] If the spike fails, freeze `spreadsheets.readonly` + Sensitive Scope Verification as the public fallback

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
- no remote executable code in extension packages
- no remote Picker page that receives OAuth tokens unless explicitly re-evaluated and disclosed
- no telemetry or advertising SDK
- no transmission of popup search terms
- no broad web-page host permissions unrelated to the product's single purpose
- list contents remain local after synchronization except for direct Google API requests needed to refresh them
