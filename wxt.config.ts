import { defineConfig } from 'wxt';

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const CHROME_EXTENSION_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Ny/S5uwAYf0feA1rgut9u6foRkdmunFx0Ea7rfUyXqfWuQh1ma22Y98ZO5q3Q0ft/+6OIbA3XcVHSSrAoWKCuPQQ52u+d/fujSyuaDoym/bS/fBJ6L0vY1hxM7RVI1/FzMX2FqWxyAdtz1DVR+TJO0V91yN8KwQUp67f9AmZUbtRMcBIpvoEKlr/3VLq4nfnP03M/eOKsCOXs3DYv0ns/bHao23x+JrSlBjvWyAtyXb25oyHGX6oTx0OMLoEMdbiavu+LbLeC4SlHqRwgvXG+Yg49gyaUOueIH8nmdjLLhpGKkDq4kuMVooN4ZDCAk7hmeghlcBgN78uWblsr6oowIDAQAB';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => {
    const chromeClientId = import.meta.env.WXT_GOOGLE_CHROME_CLIENT_ID?.trim();

    return {
      name: 'LookupBox',
      description: 'Search and copy key-value reference lists from Google Sheets and other data sources.',
      permissions: ['storage', 'identity'],
      host_permissions: [
        'https://sheets.googleapis.com/*'
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
            id: 'lookupbox@sironekotoro.com'
          }
        }
      } : {})
    };
  },
  zip: {
    artifactTemplate: 'lookup-box-{{packageVersion}}-{{browser}}.zip'
  }
});
