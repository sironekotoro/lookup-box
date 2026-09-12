# LookupBox extension versioning

LookupBox keeps the npm package version and the browser-extension release version separate.

## Browser extension version

Chrome / Firefox distribution artifacts use four numeric components:

`0.<feature-line>.<YY>.<MDD>`

Example for the OAuth-only feature line released on 2026-09-13:

`0.4.26.913`

- `0`: pre-1.0 major version
- `4`: feature/release line
- `26`: two-digit year
- `913`: month/day without a leading zero (`MDD` or `MMDD`)

The same value is written to `manifest.json` and included in the ZIP filename. Chrome and Firefox both support 1–4 dot-separated numeric version components.

The canonical value lives in `wxt.config.ts` as `EXTENSION_VERSION`. CI checks that packaged manifests and ZIP names match it.

## npm package version

`package.json` stays valid SemVer (for example `0.4.0`). It is development/package metadata and does not have to match the four-component browser-extension version.

## Release rule

Change `EXTENSION_VERSION` only for a release candidate or distributed build, not for every local edit. If another official build is needed on the same day, advance the feature/release line rather than inventing a fifth component.
