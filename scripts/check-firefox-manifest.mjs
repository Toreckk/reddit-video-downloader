import { readFile } from 'node:fs/promises';
import { loadReleaseConfiguration, resolveStableRelease } from './firefox-release-policy.mjs';

const manifestPath = new URL('../.output/firefox-mv3/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const releaseConfiguration = await loadReleaseConfiguration();
const expectedRelease = resolveStableRelease(manifest.version, releaseConfiguration);
const expectedChannel = process.env.FIREFOX_CHANNEL ?? expectedRelease.channel;
const expectedUpdateUrl = process.env.FIREFOX_UPDATE_URL ?? expectedRelease.updateUrl;

const failures = [];
if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3');
if (!manifest.background?.scripts?.length)
  failures.push('Firefox MV3 must emit background.scripts');
if (manifest.background?.service_worker) failures.push('Firefox build must not use service_worker');
if (!manifest.action?.default_popup) failures.push('action.default_popup is missing');
if (manifest.permissions?.includes('tabs')) failures.push('unnecessary tabs permission is present');
if (manifest.host_permissions?.includes('<all_urls>'))
  failures.push('broad <all_urls> permission is present');
const expectedHostOrigins = [
  '*://*.reddit.com/*',
  'https://api.redgifs.com/*',
  'https://*.redgifs.com/*',
  'https://v.redd.it/*',
];
if (
  JSON.stringify([...(manifest.host_permissions ?? [])].sort()) !==
  JSON.stringify([...expectedHostOrigins].sort())
) {
  failures.push('host permissions do not match the required Reddit and provider origins');
}
if (manifest.optional_host_permissions?.length)
  failures.push('required host origins must not be declared optional');
if (
  manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.join(',') !==
  'websiteContent'
) {
  failures.push('Firefox data transmission disclosure must contain only websiteContent');
}
if (manifest.browser_specific_settings?.gecko?.id !== releaseConfiguration.firefox.extensionId) {
  failures.push('Firefox extension ID does not match release.config.json');
}
if (manifest.browser_specific_settings?.gecko_android?.strict_min_version !== '142.0') {
  failures.push('Firefox Android minimum must cover data_collection_permissions support');
}
if (expectedChannel === 'unlisted') {
  if (manifest.browser_specific_settings?.gecko?.update_url !== expectedUpdateUrl) {
    failures.push('Unlisted Firefox builds must contain the configured update URL');
  }
} else if (manifest.browser_specific_settings?.gecko?.update_url) {
  failures.push('Listed Firefox builds must not contain a self-hosted update URL');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Firefox MV3 manifest checks passed.');
}
