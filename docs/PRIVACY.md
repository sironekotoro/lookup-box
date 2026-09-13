# LookupBox Privacy Policy

Last updated: 2026-09-13

LookupBox is a browser extension for searching and copying values from reference lists stored in Google Sheets.

## Data LookupBox accesses

When the user explicitly connects a Google account and registers a Google Sheet, LookupBox uses Google OAuth and the Google Sheets API to read the spreadsheet metadata and cell values needed for the configured lookup list.

The current development build requests the Google Sheets read-only scope:

`https://www.googleapis.com/auth/spreadsheets.readonly`

This scope allows read access to Google Sheets that the signed-in Google account can access. LookupBox does not request permission to modify Google Sheets.

The public-release authorization design is being hardened toward per-file access before store submission. The policy will be updated if the final permission model changes.

## Local storage

LookupBox stores the following information in the browser's local extension storage so searches can be fast and work without re-fetching the Sheet on every keystroke:

- registered Spreadsheet URL/ID and title
- selected Sheet/tab name
- selected key/value column names
- a local cache of the rows used by registered lookup lists
- last synchronization metadata

This information remains in the user's browser profile until the user removes a list, clears extension storage, or uninstalls the extension.

## Search terms

Search text entered into the LookupBox popup is processed locally in the browser. LookupBox does not send popup search terms to the developer or to an analytics service.

## OAuth credentials

OAuth access tokens are used only to communicate directly with Google APIs. LookupBox does not send OAuth access tokens to a LookupBox developer-operated server.

## Network communication

LookupBox currently communicates directly with Google services required for its primary function, including Google OAuth and the Google Sheets API. The developer does not operate an application server that receives Google Sheet contents, lookup searches, or OAuth tokens.

Google's handling of data sent to Google services is governed by Google's own terms and privacy policies.

## Analytics, advertising, and tracking

LookupBox does not include advertising, analytics beacons, third-party tracking, or telemetry that sends lookup-list contents or user search activity to the developer.

## Selling or sharing data

LookupBox does not sell personal information or lookup-list data. LookupBox does not share lookup-list data with third parties for advertising or profiling.

## Changes to this policy

If LookupBox adds a feature that changes what information is accessed, stored, or transmitted, this policy and the relevant browser-store disclosures will be updated before that feature is released publicly.

## Contact

Questions or issues can be reported through the LookupBox GitHub repository:

https://github.com/sironekotoro/lookup-box
