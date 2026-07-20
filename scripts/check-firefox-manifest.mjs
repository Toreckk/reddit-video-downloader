import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../.output/firefox-mv3/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const failures = [];
if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3');
if (!manifest.background?.scripts?.length)
  failures.push('Firefox MV3 must emit background.scripts');
if (manifest.background?.service_worker) failures.push('Firefox build must not use service_worker');
if (!manifest.action?.default_popup) failures.push('action.default_popup is missing');
if (manifest.permissions?.includes('tabs')) failures.push('unnecessary tabs permission is present');
if (manifest.host_permissions?.includes('<all_urls>'))
  failures.push('broad <all_urls> permission is present');
if (
  manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.join(',') !==
  'websiteContent'
) {
  failures.push('Firefox data transmission disclosure must contain only websiteContent');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Firefox MV3 manifest checks passed.');
}
