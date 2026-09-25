import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const version = 'cccc 1.6.0';
const baseline = { cognitive: 24, cyclomatic: 25 };
const targetPaths = ['lib', 'entrypoints'];
const installed = spawnSync('cccc', ['--version'], { encoding: 'utf8' });
if (installed.status !== 0 || installed.stdout.trim() !== version) {
  throw new Error(`Expected ${version}; got ${installed.stdout.trim() || installed.error || 'no cccc'}`);
}

const result = spawnSync('cccc', ['--config', 'cccc.toml', ...targetPaths], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (result.error) throw result.error;
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  throw new Error(`cccc did not produce JSON: ${result.stderr || result.stdout}`);
}
const summary = report.summary;
if (!summary || result.status !== 0 || summary.parse_error_count !== 0) {
  throw new Error(`cccc failed to analyze the sources: ${result.stderr || JSON.stringify(summary)}`);
}

const functions = [];
function collect(entries, path) {
  for (const entry of entries ?? []) {
    functions.push({ ...entry, path });
    collect(entry.children, path);
  }
}
for (const file of report.files ?? []) collect(file.functions, file.path);
functions.sort((a, b) => b.cognitive - a.cognitive || b.cyclomatic - a.cyclomatic);

const alert = summary.cognitive.max > baseline.cognitive || summary.cyclomatic.max > baseline.cyclomatic;
const lines = [
  '## cccc complexity (report only)',
  '',
  `Version: ${version}; targets: ${targetPaths.join(', ')}; files: ${summary.file_count}; functions: ${summary.function_count}; parse errors: ${summary.parse_error_count}.`,
  '',
  '| Metric | Current maximum | Baseline maximum |',
  '| --- | ---: | ---: |',
  `| Cognitive | ${summary.cognitive.max} | ${baseline.cognitive} |`,
  `| Cyclomatic | ${summary.cyclomatic.max} | ${baseline.cyclomatic} |`,
  '',
  '| Source | Function | Cognitive | Cyclomatic |',
  '| --- | --- | ---: | ---: |',
  ...functions.slice(0, 5).map(({ path, line, name, cognitive, cyclomatic }) =>
    `| \`${path}:${line}\` | \`${String(name).replaceAll('|', '\\|')}\` | ${cognitive} | ${cyclomatic} |`),
  '',
  alert ? 'Complexity exceeded the recorded baseline; review the changed functions.' : 'Complexity is within the recorded baseline.',
  '',
];
const output = lines.join('\n');
process.stdout.write(`${output}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${output}\n`);
if (alert && process.env.GITHUB_ACTIONS) {
  process.stdout.write('::warning::cccc complexity exceeds the recorded baseline; review the job summary.\n');
}
