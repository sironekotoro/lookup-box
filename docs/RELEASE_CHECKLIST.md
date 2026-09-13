# Public release checklist

Use this checklist for a Chrome Web Store or Firefox Add-ons release candidate.

## Source / version

- [ ] `main` is clean and CI is green.
- [ ] `EXTENSION_VERSION` has been bumped according to `docs/VERSIONING.md`.
- [ ] `package.json` remains valid SemVer.
- [ ] Chrome and Firefox ZIP filenames match the manifest version.
- [ ] No secrets, private Sheet data, access tokens, refresh tokens, or client secrets are present in the repository or artifacts.

## OAuth / Google API

- [ ] Public OAuth flow is the approved production design, not the development bridge.
- [ ] Requested Google scope is the minimum needed for the released behavior.
- [ ] Chrome production extension ID matches its Google OAuth client configuration.
- [ ] Firefox production redirect/client configuration matches the packaged extension.
- [ ] Google APIs required by the final flow are enabled in the production Cloud project.
- [ ] OAuth consent screen branding/support/privacy URLs are current.
- [ ] Account connect, revoke, reconnect, token expiry, and wrong-account cases have been tested.

## Permissions / privacy

- [ ] Manifest permissions are limited to the extension's single purpose.
- [ ] Host permissions contain only required Google API origins.
- [ ] Public privacy policy exactly matches runtime behavior.
- [ ] Store data-use answers exactly match runtime behavior.
- [ ] Popup search terms are not transmitted.
- [ ] No analytics/telemetry is present unless explicitly documented and consented.
- [ ] Firefox `data_collection_permissions` matches the final Mozilla taxonomy classification.

## Package inspection

- [ ] 16/32/48/128px icons are present and wired to extension + toolbar icons.
- [ ] No legacy GAS host permissions or runtime strings are present.
- [ ] No remote executable code is loaded.
- [ ] Chrome package is Manifest V3.
- [ ] Firefox validator warnings are reviewed; privacy/security warnings are resolved before submission.
- [ ] If AMO requires source, the source ZIP and exact reproducible build instructions are prepared.

## Store listing

- [ ] Name, summary, and description describe only actual released features.
- [ ] Single-purpose statement is concise and accurate.
- [ ] Permission justifications are complete.
- [ ] Privacy policy URL is public and reachable.
- [ ] Support URL / support email are configured.
- [ ] Screenshots contain public sample data only.
- [ ] Reviewer notes explain Google authentication and data flow.

## Manual smoke test

### Chrome

- [ ] Fresh install.
- [ ] Official icon appears correctly.
- [ ] Google connect succeeds.
- [ ] Register a Sheet/list.
- [ ] Search and copy.
- [ ] Modify Sheet, re-sync, and confirm update.
- [ ] Disconnect/reconnect.

### Firefox

- [ ] Fresh install.
- [ ] Official icon appears correctly.
- [ ] Data-collection/permission prompt matches documentation.
- [ ] Google connect succeeds using the production auth path.
- [ ] Register a Sheet/list.
- [ ] Search and copy.
- [ ] Modify Sheet, re-sync, and confirm update.
- [ ] Disconnect/reconnect.

## Submission

- [ ] Chrome Store Listing and Privacy tabs are complete.
- [ ] Chrome package uploaded and review requested.
- [ ] AMO listing fields are complete.
- [ ] Firefox package and source bundle (if requested) uploaded.
- [ ] Submission IDs / review URLs are recorded in the release issue.
