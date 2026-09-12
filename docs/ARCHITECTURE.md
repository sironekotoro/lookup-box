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

The old GAS gateway remains available only as a migration/recovery fallback:

```text
LookupBox extension
  -> GAS Web App
  -> Google Sheets
```

Existing multi-list definitions do not depend on the connection method, so a list can move from GAS to OAuth without being recreated.

## Lookup list model

A lookup list is identified by:

- Spreadsheet URL / ID
- Sheet name
- key column
- value column

The visible list name is derived automatically from the Spreadsheet title. When multiple lists from the same Spreadsheet are registered, LookupBox adds the Sheet name, and if necessary the key/value pair, to disambiguate them.

The user does not invent a list name.

## Google auth adapter

The extension requests:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Chrome uses the platform-native Identity API token cache and expiration handling through `chrome.identity.getAuthToken()`.

Firefox does not expose Chrome's `getAuthToken()` API. The current development bridge isolates its `identity.launchWebAuthFlow()` implementation behind the same adapter. It uses a fixed Gecko extension ID so the redirect URL stays stable across temporary installs. The Firefox bridge is intentionally marked development-only until the public-release authorization design is hardened.

OAuth client IDs are build-time application configuration and are not end-user secrets or user settings.

## Direct Google Sheets provider

The direct provider uses Google Sheets API v4.

Inspection flow:

1. Read Spreadsheet metadata and visible Sheet titles.
2. Read row 1 for each visible Sheet to discover headers.
3. Let the user choose the Sheet, key column, and value column.

Sync flow:

1. Read the selected Sheet through the `values` API.
2. Request `FORMATTED_VALUE` so displayed strings such as leading-zero codes are preserved.
3. Map the result into the existing `DatasetBundle` cache shape.
4. Search and copy from local browser storage.

## Provider abstraction

Google Sheets direct API, the legacy GAS path, SQLite, CSV, and future sources remain behind provider boundaries so the search UI stays source-agnostic.

## Public-distribution direction

The initial direct OAuth implementation uses `spreadsheets.readonly`, which Google classifies as a sensitive scope. This is appropriate for a controlled development/testing phase but public distribution requires OAuth verification or a narrower permission model.

The later public-release milestone should evaluate Google Picker + `drive.file` or another least-privilege design while preserving the current list model and UI.
