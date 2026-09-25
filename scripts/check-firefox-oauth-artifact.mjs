import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Pass the unpacked Firefox ZIP directory.');

function scripts(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? scripts(path) : path.endsWith('.js') ? [path] : [];
  });
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const gecko = manifest.browser_specific_settings?.gecko;
const permissions = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])];
if (!gecko?.strict_min_version || !permissions.includes('https://oauth2.googleapis.com/token')) {
  throw new Error('Firefox PKCE requires a minimum version and the Google token endpoint permission.');
}

const bundle = scripts(root).map((path) => readFileSync(path, 'utf8')).join('\n');
const setter = String.raw`\.set\(\s*([\x60"'])response_type\1\s*,\s*([\x60"'])(\w+)\2\s*\)`;
const grantTypes = [...bundle.matchAll(new RegExp(setter, 'g'))].map((match) => match[3]);
if (grantTypes.includes('token') || !grantTypes.includes('code') ||
    !bundle.includes('code_challenge') || !bundle.includes('code_verifier') ||
    !bundle.includes('https://oauth2.googleapis.com/token')) {
  throw new Error('Firefox artifact contains legacy implicit OAuth or lacks the PKCE code exchange.');
}
