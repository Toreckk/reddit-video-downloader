import assert from 'node:assert/strict';
import { extractReleaseNotes, loadVersionMetadata } from './release-metadata.mjs';

const metadata = await loadVersionMetadata();
assert.equal(metadata.tagName, `v${metadata.version}`);
assert.match(metadata.releaseNotes, /^### Notable changes/m);

const fixture = `# Changelog

## 1.2.3 (2026-01-01)

### Notable changes

- Current release.

## 1.2.2 (2025-12-01)

### Notable changes

- Previous release.
`;
assert.equal(extractReleaseNotes(fixture, '1.2.3'), '### Notable changes\n\n- Current release.\n');

console.log(`Version metadata checks passed for ${metadata.version}.`);
