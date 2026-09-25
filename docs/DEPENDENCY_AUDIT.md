# Development dependency audit (2026-09-25)

`npm audit` on the previous lockfile reported 12 affected packages: 1 low,
4 moderate, 4 high, and 3 critical. `npm audit --omit=dev` reported 0.
The `npm audit fix` pass without `--force` made no changes, so this branch
updates the two affected direct development tools separately: WXT from
0.20.27 to 0.21.4 and Vitest from 3.2.7 to 5.0.2.

| Dependency path | Advisory in the previous lockfile | Exposure |
| --- | --- | --- |
| `vitest → @vitest/mocker` | Redirect mock path traversal / file read (moderate) | Test runner, if untrusted mock redirects are evaluated |
| `wxt → web-ext-run → firefox-profile → adm-zip` | Crafted ZIP memory allocation and destination symlink overwrite (high) | Firefox development tooling processing a crafted ZIP |
| `wxt → web-ext-run → fx-runner → shell-quote` | Newline escaping and quadratic parsing (critical) | Development tooling if attacker-controlled arguments reach it |
| `wxt → web-ext-run → tmp` | Path traversal in prefix/postfix (high) | Development tooling if untrusted paths reach it |
| `wxt → web-ext-run → node-notifier → uuid` | Buffer bounds check (moderate) | Development notification tooling if a caller provides a buffer |
| `esbuild` | Development server file read on Windows (low) | Windows development server, not extension runtime |

The severity labels for `web-ext-run`, `fx-runner`, `firefox-profile`,
`node-notifier`, `wxt`, and `vitest` also appear in npm's total as affected
parent packages. The affected paths are build, test, and development tools;
they execute on developer or CI machines, so an empty production-dependency
audit alone does not make them harmless. No `node_modules` or development
tools are present in either browser extension ZIP.

After updating the lockfile, `npm audit` and `npm audit --omit=dev` both
report 0 vulnerabilities. Reproducible validation: `npm ci`, typecheck,
47 tests, Chrome and Firefox ZIP builds, and inspection of ZIP entries.
The Firefox source ZIP includes project source and a lockfile for reviewers;
it does not contain installed dependencies.
