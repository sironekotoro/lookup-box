# Chrome public-release preparation (Issue #9)

This is the remaining operational sequence. A passing extension build is not
an OAuth verification or Chrome Web Store approval. Firefox's development
implicit OAuth flow remains outside AMO release until Issues #27 and #28 are
resolved.

## 1. Production homepage and privacy policy

The homepage at `https://lookupbox.sironekotoro.com/` and privacy policy at
`https://lookupbox.sironekotoro.com/privacy.html` are live over HTTPS.
GitHub Pages is configured with this custom domain and **Enforce HTTPS**.
The DNS `CNAME` points to `sironekotoro.github.io` (without `/lookup-box`).
For a new custom subdomain, configure **Repository Settings → Pages → Custom
domain** before adding the DNS record, to prevent subdomain takeover.
This site deploys with a GitHub Actions workflow, so a `site/CNAME` file alone
does not configure the domain.

Remaining steps:

1. Verify ownership of the domain in Google Search Console with a project
   owner/editor of the production Google Cloud project. Use the exact final
   homepage and privacy URLs in Google Auth Platform. The privacy page must
   remain a separate HTML page linked from the homepage.
2. Confirm the Google Auth Platform and Chrome Web Store URLs use the final
   canonical address. Update the Store listing before submission.

## 2. Chrome identity and release ZIP

The current manifest key produces the development extension ID
`fknnikkfcolngfdemfoimajmbjdpkjbp`. Create a Chrome Web Store draft item
without publishing it; compare its assigned item ID with that value. Do not
assume they match. Configure a **Chrome Extension** Google OAuth client for the
actual Store ID. If the assigned ID differs, update the manifest identity
strategy and OAuth client before submitting. Preserve existing installations
when choosing the migration path.

Build the exact candidate with `WXT_GOOGLE_CHROME_CLIENT_ID` configured,
then run:

```bash
npm ci
npm run zip:chrome
LOOKUPBOX_CHROME_STORE_ID=<actual-store-item-id> npm run verify:chrome-zip
```

The ZIP check verifies the packaged manifest, client ID shape, read-only
scope, required permissions, and ID derived from its public key. It cannot
prove the client ID is registered to the Google Cloud project or that Google
has verified the application. CI runs the same manifest check when its Chrome
client ID repository variable is configured; without that variable it still
builds a development package, but it must not be submitted to the Store.
No client secret belongs in the extension or repository variables.

## 3. Google OAuth sensitive-scope review

In the intended production Cloud project, confirm Google Sheets API is
enabled and the external app's branding (name, monitored support email,
homepage, separate privacy URL, authorized domain) matches the final site.
In **Data Access**, request only
`https://www.googleapis.com/auth/spreadsheets.readonly`. Move the audience
to production as required for review, prepare a demonstration showing account
connection, a user-entered Sheet URL, list registration, search, and removal,
then submit the app for brand/sensitive-scope verification. Use public demo
Sheet data and show the OAuth client ID in the consent browser address bar if
Google requests it. Record Google's approval in Issue #9; do not treat a
submitted request as approval. Google Workspace administrators may still
restrict access for their users.

## 4. Store and final tests

Complete the Chrome Store Listing and Privacy answers using
`docs/STORE_LISTING.md`, the final public privacy URL, and screenshots made
with sample data. Test the actual candidate with the Store item ID: connect,
register, search/copy, resync, disconnect and revoke, reconnect, token expiry,
and wrong-account handling. Confirm package permissions and source data are
the same as the approved description, and update `docs/RELEASE_CHECKLIST.md`.
The actual Store submission and published URL are tracked by Issue #12.

## Source references

- [Google sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Google app privacy-policy requirements](https://support.google.com/cloud/answer/13806988)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Chrome OAuth manifest and development key](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2)
