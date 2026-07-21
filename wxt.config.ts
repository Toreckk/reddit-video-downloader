import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    permissions: ['downloads', 'storage'],
    host_permissions: [
      'https://api.redgifs.com/*',
      'https://*.redgifs.com/*',
      'https://v.redd.it/*',
    ],
    action: {
      default_title: '__MSG_actionTitle__',
      default_icon: {
        16: 'icon.svg',
        32: 'icon.svg',
        48: 'icon.svg',
        96: 'icon.svg',
      },
    },
    icons: {
      16: 'icon.svg',
      32: 'icon.svg',
      48: 'icon.svg',
      96: 'icon.svg',
    },
    browser_specific_settings: {
      gecko: {
        id: 'reddit-video-downloader@toreckk',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['websiteContent'],
        },
      },
    },
  },
});
