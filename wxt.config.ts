import { defineConfig } from 'wxt';

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const CHROME_EXTENSION_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Ny/S5uwAYf0feA1rgut9u6foRkdmunFx0Ea7rfUyXqfWuQh1ma22Y98ZO5q3Q0ft/+6OIbA3XcVHSSrAoWKCuPQQ52u+d/fujSyuaDoym/bS/fBJ6L0vY1hxM7RVI1/FzMX2FqWxyAdtz1DVR+TJO0V91yN8KwQUp67f9AmZUbtRMcBIpvoEKlr/3VLq4nfnP03M/eOKsCOXs3DYv0ns/bHao23x+JrSlBjvWyAtyXb25oyHGX6oTx0OMLoEMdbiavu+LbLeC4SlHqRwgvXG+Yg49gyaUOueIH8nmdjLLhpGKkDq4kuMVooN4ZDCAk7hmeghlcBgN78uWblsr6oowIDAQAB';
const EXTENSION_VERSION = '0.10.26.926';

const ICONS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => {
    const chromeClientId = import.meta.env.WXT_GOOGLE_CHROME_CLIENT_ID?.trim();

    return {
      name: 'LookupBox',
      version: EXTENSION_VERSION,
      description: 'Search and copy configurable reference lists from Google Sheets.',
      icons: ICONS,
      permissions: ['storage', 'identity'],
      host_permissions: [
        'https://sheets.googleapis.com/*',
        'https://oauth2.googleapis.com/revoke'
      ],
      ...(browser === 'chrome' ? {
        key: CHROME_EXTENSION_KEY,
        ...(chromeClientId ? {
          oauth2: {
            client_id: chromeClientId,
            scopes: [SHEETS_READONLY_SCOPE]
          }
        } : {})
      } : {}),
      ...(browser === 'firefox' ? {
        browser_specific_settings: {
          gecko: {
            id: 'lookupbox@sironekotoro.com',
            strict_min_version: '96.0'
          }
        }
      } : {})
    };
  },
  zip: {
    artifactTemplate: `lookup-box-${EXTENSION_VERSION}-{{browser}}.zip`
  }
});
