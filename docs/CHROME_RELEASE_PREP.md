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

The development manifest key produces extension ID
`fknnikkfcolngfdemfoimajmbjdpkjbp`. The Chrome Web Store draft created on
2026-09-26 has item ID `aplbknmobllopblceapancjecklfanni`. The Store rejects
ZIPs containing a manifest `key`, so the Store build omits it. Configure a
separate **Chrome Extension** Google OAuth client for the actual Store ID.
The development ID and its installed copies remain separate; do not assume
an existing unpacked installation changes its ID after Store publication.

Build the development candidate with `WXT_GOOGLE_CHROME_CLIENT_ID` configured,
and the Store candidate with the **production** client configured separately:

```bash
npm ci
npm run zip:chrome
npm run verify:chrome-zip
WXT_GOOGLE_CHROME_STORE_CLIENT_ID=<production-client-id> npm run zip:chrome:store
WXT_GOOGLE_CHROME_STORE_CLIENT_ID=<production-client-id> npm run verify:chrome-store-zip
```

The development ZIP check verifies its fixed key and development ID. The
Store ZIP check verifies that no key is included, the configured production
OAuth client ID is packaged, and the scope and permissions are correct. A
key-free ZIP cannot prove its assigned Store ID locally; check the actual
draft in the Developer Dashboard and the client registration in Google Cloud.
CI generates the Store ZIP only when repository variable
`WXT_GOOGLE_CHROME_STORE_CLIENT_ID` is set. Never submit the development ZIP
to the Store. Do not submit the current draft's test ZIP, which contains the
development OAuth client ID.
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
