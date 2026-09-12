import { defineConfig } from 'wxt';

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => {
    const chromeClientId = import.meta.env.WXT_GOOGLE_CHROME_CLIENT_ID?.trim();

    return {
      name: 'LookupBox',
      description: 'Search and copy key-value reference lists from Google Sheets and other data sources.',
      permissions: ['storage', 'identity'],
      host_permissions: [
        'https://sheets.googleapis.com/*',
        'https://script.google.com/*',
        'https://script.googleusercontent.com/*'
      ],
      ...(browser === 'chrome' && chromeClientId ? {
        oauth2: {
          client_id: chromeClientId,
          scopes: [SHEETS_READONLY_SCOPE]
        }
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
