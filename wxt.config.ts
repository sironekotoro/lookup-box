import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LookupBox',
    description: 'Search and copy key-value reference lists from Google Sheets and other data sources.',
    permissions: ['storage'],
    host_permissions: [
      'https://script.google.com/*',
      'https://script.googleusercontent.com/*'
    ]
  },
  zip: {
    artifactTemplate: 'lookup-box-{{packageVersion}}-{{browser}}.zip'
  }
});
