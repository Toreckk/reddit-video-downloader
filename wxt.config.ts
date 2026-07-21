import { defineConfig } from 'wxt';
import { readFileSync } from 'node:fs';

interface ReleaseConfiguration {
  firefox: {
    extensionId: string;
    listedFromVersion: string;
    stableChannelBeforeListed: 'listed' | 'unlisted';
    stableUpdateUrl: string;
  };
}

interface PackageMetadata {
  version: string;
}

const releaseConfiguration = JSON.parse(
  readFileSync(new URL('./release.config.json', import.meta.url), 'utf8'),
) as ReleaseConfiguration;
const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageMetadata;

function compareNumericVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

const configuredChannel = process.env.FIREFOX_CHANNEL;
if (configuredChannel && configuredChannel !== 'listed' && configuredChannel !== 'unlisted') {
  throw new Error(`Unsupported FIREFOX_CHANNEL: ${configuredChannel}`);
}

const defaultChannel =
  compareNumericVersions(packageMetadata.version, releaseConfiguration.firefox.listedFromVersion) >=
  0
    ? 'listed'
    : releaseConfiguration.firefox.stableChannelBeforeListed;
const firefoxChannel = configuredChannel ?? defaultChannel;
const firefoxVersion = process.env.FIREFOX_MANIFEST_VERSION ?? packageMetadata.version;
const firefoxUpdateUrl =
  process.env.FIREFOX_UPDATE_URL ?? releaseConfiguration.firefox.stableUpdateUrl;
const firefoxVersionName = process.env.FIREFOX_VERSION_NAME;

export default defineConfig({
  srcDir: '.',
  zip: {
    excludeSources: ['coverage/**', 'pages-output/**', 'signed-artifacts/**'],
  },
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    version: firefoxVersion,
    ...(firefoxVersionName ? { version_name: firefoxVersionName } : {}),
    default_locale: 'en',
    permissions: ['downloads', 'storage'],
    host_permissions: [
      '*://*.reddit.com/*',
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
        id: releaseConfiguration.firefox.extensionId,
        strict_min_version: '140.0',
        ...(firefoxChannel === 'unlisted' ? { update_url: firefoxUpdateUrl } : {}),
        data_collection_permissions: {
          required: ['websiteContent'],
        },
      },
      gecko_android: {
        strict_min_version: '142.0',
      },
    },
  },
});
