import { execFileSync } from 'node:child_process';
import { compareNumericVersions, loadVersionMetadata } from './release-metadata.mjs';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const baseRef = readOption('--base-ref');
const headRef = readOption('--head-ref');
if (!baseRef || !headRef) {
  throw new Error('Usage: node scripts/check-release-pr.mjs --base-ref <ref> --head-ref <branch>');
}

const metadata = await loadVersionMetadata();
const expectedBranch = `release/v${metadata.version}`;
if (headRef !== expectedBranch) {
  throw new Error(
    `Pull requests into master must come from ${expectedBranch}, received ${headRef}`,
  );
}

const basePackage = JSON.parse(
  execFileSync('git', ['show', `${baseRef}:package.json`], { encoding: 'utf8' }),
);
if (compareNumericVersions(metadata.version, basePackage.version) <= 0) {
  throw new Error(
    `Release version ${metadata.version} must be newer than master version ${basePackage.version}`,
  );
}

const existingTag = execFileSync('git', ['tag', '--list', metadata.tagName], {
  encoding: 'utf8',
}).trim();
if (existingTag) throw new Error(`${metadata.tagName} already exists`);

console.log(
  `Release PR checks passed: ${headRef} advances ${basePackage.version} to ${metadata.version}.`,
);
