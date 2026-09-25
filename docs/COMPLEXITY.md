# Complexity measurement

CI installs `cccc` v1.6.0 using a commit-pinned `cccc-action` v1.1.0 and
analyzes only `lib/` and `entrypoints/`. The config selects TypeScript/TSX;
tests, generated bundles, source ZIPs, dependencies, and lockfiles are outside
those target directories. Run locally with `npm run complexity` after installing
`cccc` v1.6.0.

The main-branch baseline measured on 2026-09-25 (commit `681edfd`) is
17 files, 210 functions, zero parse errors, maximum cognitive complexity 24,
and maximum cyclomatic complexity 25. The leading functions were
`searchDatasets` (`lib/search.ts`: cognitive 24, cyclomatic 12),
the options `App` (`entrypoints/options/main.tsx`: 22, 25),
`loadSettings` (`lib/storage.ts`: 16, 15), and
`normalizeSettings` (`lib/storage.ts`: 15, 25).

The job summary lists the five highest cognitive scores. Crossing either
observed maximum emits a CI warning and calls for reviewing the changed
function; it does not fail the build. A missing/wrong tool version, invalid
output, or parse error fails the job. After reviewing real PR output and
reducing the leading functions when useful, the team can decide whether a
blocking threshold is warranted. This measures per-function cognitive and
cyclomatic complexity, not coupling or duplication.
