# LookupBox Privacy Policy

Last updated: 2026-09-25

LookupBox is a browser extension for searching and copying values from reference lists stored in Google Sheets.

## Data LookupBox accesses

When the user explicitly connects a Google account, LookupBox uses Google OAuth and the Google Sheets API to inspect metadata and headers for the Spreadsheet URL the user enters. When a list is registered or synchronized, LookupBox reads the selected Sheet's values.

LookupBox requests the Google Sheets read-only scope:

`https://www.googleapis.com/auth/spreadsheets.readonly`

Google grants read access to all Google Sheets that the signed-in account can access. LookupBox inspects only URLs the user enters and stores rows only for lists the user registers and synchronizes. This scope does not grant permission to modify Google Sheets.

## Local storage

LookupBox stores the following information in the browser's local extension storage so searches can be fast and work without re-fetching the Sheet on every keystroke:

- registered Spreadsheet URL/ID and title
- selected Sheet/tab name
- selected search, display, and copy column names
- a local cache of the rows used by registered lookup lists
- last synchronization metadata

Registered list settings remain until the user removes a list, clears extension storage, or uninstalls the extension. Disconnecting Google deletes the locally cached rows and synchronization metadata, while retaining list settings for a future connection.

## Search terms

Search text entered into the LookupBox popup is processed locally in the browser. LookupBox does not send popup search terms to the developer or to an analytics service.

## OAuth credentials

OAuth access tokens are used only to communicate directly with Google APIs. LookupBox does not send OAuth access tokens to a LookupBox developer-operated server.
When the user disconnects, LookupBox sends the current access token to Google's revocation endpoint if it can obtain one. If Google revocation cannot be confirmed, the extension stops automatic access locally and explains how to remove the grant from Google Account settings.

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
