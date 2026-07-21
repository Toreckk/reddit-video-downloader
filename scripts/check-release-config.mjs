import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAmoJwt, resolveSignedFile } from './amo-release-client.mjs';
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

const jwt = createAmoJwt({ issuer: 'issuer', secret: 'secret', issuedAt: 10, jwtId: 'unique' });
const [header, payload, signature] = jwt.split('.');
assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
  alg: 'HS256',
  typ: 'JWT',
});
assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
  iss: 'issuer',
  jti: 'unique',
  iat: 10,
  exp: 70,
});
assert.equal(
  signature,
  createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url'),
);
assert.deepEqual(resolveSignedFile(null), { ready: false, status: 'not-found' });
assert.deepEqual(resolveSignedFile({ file: { status: 'awaiting_review' } }), {
  ready: false,
  status: 'awaiting_review',
});
assert.deepEqual(
  resolveSignedFile({ file: { status: 'public', url: 'https://example.test/a.xpi' } }),
  {
    ready: true,
    status: 'public',
    url: 'https://example.test/a.xpi',
    hash: undefined,
  },
);

console.log('Firefox release policy checks passed.');
