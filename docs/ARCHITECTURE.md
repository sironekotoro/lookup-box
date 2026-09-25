# LookupBox architecture

## Current product architecture

LookupBox keeps search, list identity, and source access separated.

```text
LookupBox extension
  -> Google auth adapter
       -> Chrome: chrome.identity.getAuthToken()
       -> Firefox development bridge: identity.launchWebAuthFlow()
  -> Google Sheets API
  -> browser.storage.local cache
  -> popup search / copy
```

The standard Chrome and Firefox distribution artifacts are OAuth-only. They do not request gateway host permissions and do not include a gateway runtime provider.

The previous `gas/Code.gs` implementation remains in the repository only as historical/reference material.

## Lookup list model

A lookup list is identified by:

- Spreadsheet URL / ID
- Sheet name
- search columns
- display columns (including their order)
- copy columns (chosen from the display columns)

The visible list name is derived automatically from the Spreadsheet title. When multiple lists from the same Spreadsheet are registered, LookupBox adds the Sheet name, and if necessary the display columns, to disambiguate them.

The user does not invent a list name.

## Settings migration

Current settings use an OAuth-only schema.

On upgrade from older settings, LookupBox preserves compatible list definitions and cache data where possible, but does not carry old connection credentials into the current settings key. The user reconnects through Google OAuth.

## Google auth adapter

The extension requests:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Chrome uses the platform-native Identity API token cache and expiration handling through `chrome.identity.getAuthToken()`.

Firefox does not expose Chrome's `getAuthToken()` API. The current development bridge isolates its `identity.launchWebAuthFlow()` implementation behind the same adapter and uses a fixed Gecko extension ID plus loopback redirect. The Firefox bridge is intentionally marked development-only until the public-release authorization design is hardened.

OAuth client IDs are build-time application configuration and are not end-user secrets or user settings.

## Direct Google Sheets provider

The direct provider uses Google Sheets API v4.

Inspection flow:

1. Read Spreadsheet metadata and visible Sheet titles.
2. Read row 1 for each visible Sheet to discover headers.
3. Let the user choose the Sheet and configure search, display, and copy columns.

Sync flow:

1. Read the selected Sheet through the `values` API.
2. Request `FORMATTED_VALUE` so displayed strings such as leading-zero codes are preserved.
3. Map the result into the existing `DatasetBundle` cache shape.
4. Search and copy from local browser storage.

## Provider abstraction

Google Sheets API, SQLite, CSV, and future sources remain behind provider boundaries so the search UI stays source-agnostic.

## Artifact security boundary

CI unpacks both browser package ZIPs and rejects a build if it contains the previous gateway host permissions or runtime setup strings. This makes the OAuth-only distribution boundary executable rather than documentation-only.

## Public-distribution direction

The public-release design retains `spreadsheets.readonly` so Google does not grant LookupBox permission to edit Sheets. Google classifies this as a sensitive scope and public distribution requires OAuth verification. The consent screen grants read access to all Google Sheets available to the account, while LookupBox inspects user-entered URLs and synchronizes only registered lists.

`drive.file` would limit access to picked files but would also grant edit/create/delete permission for those files. Issue #11 records why LookupBox's read-only product promise takes priority over per-file scope.
