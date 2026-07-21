import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stable = JSON.parse(await readFile('pages-output/updates.json', 'utf8'));
const prerelease = JSON.parse(await readFile('pages-output/prerelease-updates.json', 'utf8'));
const extensionId = 'reddit-video-downloader@toreckk';

assert.deepEqual(stable.addons[extensionId].updates, [
  { update_link: 'https://example.test/v1.0.0-listed.xpi', version: '1.0.0' },
  { update_link: 'https://example.test/v0.2.0.xpi', version: '0.2.0' },
]);
assert.deepEqual(prerelease.addons[extensionId].updates, [
  { update_link: 'https://example.test/v1.0.0-rc.1.xpi', version: '0.2.0.42' },
]);

console.log('Firefox update manifest checks passed.');
