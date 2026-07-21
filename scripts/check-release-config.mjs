import assert from 'node:assert/strict';
import {
  loadReleaseConfiguration,
  resolvePrerelease,
  resolveStableRelease,
} from './firefox-release-policy.mjs';

const configuration = await loadReleaseConfiguration();

assert.deepEqual(resolveStableRelease('0.2.0', configuration), {
  channel: 'unlisted',
  extensionId: 'reddit-video-downloader@toreckk',
  manifestVersion: '0.2.0',
  updateUrl: 'https://toreckk.github.io/reddit-video-downloader/updates.json',
});
assert.deepEqual(resolveStableRelease('1.0.0', configuration), {
  channel: 'listed',
  extensionId: 'reddit-video-downloader@toreckk',
  manifestVersion: '1.0.0',
  updateUrl: '',
});
assert.deepEqual(
  resolvePrerelease(
    { baseVersion: '0.2.0', buildNumber: 42, rcNumber: 1, targetVersion: '1.0.0' },
    configuration,
  ),
  {
    channel: 'unlisted',
    displayVersion: '1.0.0-rc.1',
    extensionId: 'reddit-video-downloader@toreckk',
    manifestVersion: '0.2.0.42',
    releaseTag: 'v1.0.0-rc.1',
    updateUrl: 'https://toreckk.github.io/reddit-video-downloader/prerelease-updates.json',
  },
);

console.log('Firefox release policy checks passed.');
