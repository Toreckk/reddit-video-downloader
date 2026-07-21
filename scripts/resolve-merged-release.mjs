import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { compareNumericVersions, loadVersionMetadata } from './release-metadata.mjs';

const outputIndex = process.argv.indexOf('--github-output');
const outputPath = outputIndex === -1 ? undefined : process.argv[outputIndex + 1];
if (!outputPath) {
  throw new Error('Usage: node scripts/resolve-merged-release.mjs --github-output <path>');
}

const metadata = await loadVersionMetadata();
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
const shouldRelease = !tags.includes(metadata.tagName);

if (shouldRelease) {
  const newerOrEqualTag = tags.find(
    (tag) => compareNumericVersions(metadata.version, tag.slice(1)) <= 0,
  );
  if (newerOrEqualTag) {
    throw new Error(`${metadata.tagName} must be newer than existing release ${newerOrEqualTag}`);
  }
}

await appendFile(
  outputPath,
  [`should_release=${shouldRelease}`, `version=${metadata.version}`, `tag_name=${metadata.tagName}`]
    .map((line) => `${line}\n`)
    .join(''),
);

console.log(
  shouldRelease
    ? `${metadata.tagName} is ready for publication.`
    : `${metadata.tagName} already exists; no release is needed.`,
);
