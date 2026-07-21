import { spawnSync } from 'node:child_process';
import {
  loadPackageVersion,
  loadReleaseConfiguration,
  resolveStableRelease,
} from './firefox-release-policy.mjs';

const configuration = await loadReleaseConfiguration();
const packageVersion = await loadPackageVersion();
const release = resolveStableRelease(
  process.env.FIREFOX_MANIFEST_VERSION ?? packageVersion,
  configuration,
);
const channel = process.env.FIREFOX_CHANNEL ?? release.channel;
const argumentsList = [
  'node_modules/web-ext/bin/web-ext.js',
  'lint',
  '--source-dir',
  '.output/firefox-mv3',
];

if (channel === 'unlisted') argumentsList.push('--self-hosted');

const result = spawnSync(process.execPath, argumentsList, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
