import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const releaseDir = '.output';
const storeBuild = process.argv.includes('--store');
const builtManifest = JSON.parse(readFileSync(`${releaseDir}/chrome-mv3/manifest.json`, 'utf8'));
const zipPath = `${releaseDir}/lookup-box-${builtManifest.version}-chrome${storeBuild ? '-store' : ''}.zip`;
if (!existsSync(zipPath)) throw new Error(`Missing Chrome ZIP for build ${builtManifest.version}: ${zipPath}`);
const extracted = spawnSync('unzip', ['-p', zipPath, 'manifest.json'], { encoding: 'utf8' });
if (extracted.status !== 0) throw new Error(`Cannot read packaged manifest: ${extracted.stderr}`);
const manifest = JSON.parse(extracted.stdout);
if (manifest.version !== builtManifest.version) throw new Error('Chrome ZIP version differs from the current build');

function extensionId(publicKey) {
  if (typeof publicKey !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey)) {
    throw new Error('Chrome manifest has no valid public key');
  }
  const hex = createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest('hex').slice(0, 32);
  return hex.replace(/[0-9a-f]/g, (digit) => String.fromCharCode(parseInt(digit, 16) + 97));
}

if (storeBuild) {
  if (Object.hasOwn(manifest, 'key')) throw new Error('Chrome Web Store rejects manifest key');
  if (!process.env.WXT_GOOGLE_CHROME_STORE_CLIENT_ID) {
    throw new Error('Production Chrome Store OAuth client ID must be configured');
  }
  if (manifest.oauth2?.client_id !== process.env.WXT_GOOGLE_CHROME_STORE_CLIENT_ID) {
    throw new Error('Store ZIP OAuth client differs from the configured production client');
  }
} else {
  const actualId = extensionId(manifest.key);
  if (actualId !== 'fknnikkfcolngfdemfoimajmbjdpkjbp') {
    throw new Error(`Development Chrome ID mismatch: ZIP key produces ${actualId}`);
  }
}
if (manifest.manifest_version !== 3) throw new Error('Chrome package must use Manifest V3');
if (!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(manifest.oauth2?.client_id ?? '')) {
  throw new Error('Chrome ZIP is missing a Google OAuth client ID');
}
if (JSON.stringify(manifest.oauth2.scopes) !== JSON.stringify(['https://www.googleapis.com/auth/spreadsheets.readonly'])) {
  throw new Error('Chrome ZIP must request only the Google Sheets read-only scope');
}
for (const [label, actual, expected] of [
  ['permissions', manifest.permissions, ['storage', 'identity']],
  ['host permissions', manifest.host_permissions, ['https://sheets.googleapis.com/*', 'https://oauth2.googleapis.com/revoke']],
]) {
  if (!Array.isArray(actual) || JSON.stringify(actual.toSorted()) !== JSON.stringify(expected.toSorted())) {
    throw new Error(`Unexpected Chrome ${label}: ${JSON.stringify(actual)}`);
  }
}
console.log(`Chrome ${storeBuild ? 'Store' : 'development'} ZIP OAuth manifest verified: ${zipPath}`);
if (storeBuild) console.log('Verify the production OAuth client is registered to Store item aplbknmobllopblceapancjecklfanni in Google Cloud. A key-free ZIP cannot prove its Store ID locally.');
