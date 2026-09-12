# LookupBox architecture

## Current MVP

The current working baseline uses a thin Google Apps Script gateway:

```text
LookupBox extension
  -> GAS Web App
  -> Google Sheets
  -> browser.storage.local cache
  -> popup search / copy
```

The GAS version is retained as a known-good baseline while Google OAuth direct access is developed.

## Target user model

A lookup list is conceptually identified by:

- Spreadsheet URL / ID
- Sheet name
- key column
- value column

The visible list name should be derived automatically from the Spreadsheet title. When multiple lists from the same Spreadsheet are registered, display `Spreadsheet title / Sheet name` to disambiguate them.

The user should not have to invent a list name.

## Planned OAuth architecture

```text
LookupBox extension
  -> Google OAuth (chrome.identity / browser identity path)
  -> Google Sheets API
  -> browser.storage.local cache
  -> popup search / copy
```

For the first OAuth PoC, a read-only Sheets scope may be used. Before public distribution, prefer a least-privilege design such as Google Picker + drive.file where practical.

## Provider abstraction

Google Sheets, SQLite, CSV, and future sources should remain behind a provider boundary so the search UI is source-agnostic.
