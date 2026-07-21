import { appendFile } from 'node:fs/promises';
import { downloadSignedFile, fetchAmoVersion, resolveSignedFile } from './amo-release-client.mjs';
import { loadReleaseConfiguration, resolveStableRelease } from './firefox-release-policy.mjs';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function writeOutput(values) {
  const outputPath = readOption('--github-output');
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}`);
  await appendFile(outputPath, `${lines.join('\n')}\n`);
}

const version = readOption('--version');
const outputPath = readOption('--output');
if (!version || !outputPath) {
  throw new Error(
    'Usage: node scripts/finalize-firefox-release.mjs --version <version> --output <xpi> [--github-output <path>]',
  );
}

const configuration = await loadReleaseConfiguration();
const release = resolveStableRelease(version, configuration);
if (release.channel === 'listed') {
  console.log(`Firefox ${version} uses the listed channel; no signed XPI asset is required.`);
  await writeOutput({ ready: true, channel: release.channel, status: 'submitted' });
  process.exit(0);
}

const issuer = process.env.FIREFOX_JWT_ISSUER;
const secret = process.env.FIREFOX_JWT_SECRET;
if (!issuer || !secret) throw new Error('Mozilla API credentials are not available.');

const details = await fetchAmoVersion({
  extensionId: release.extensionId,
  version: release.manifestVersion,
  issuer,
  secret,
});
const signedFile = resolveSignedFile(details);
if (!signedFile.ready) {
  console.log(`Firefox ${version} is not signed yet (Mozilla status: ${signedFile.status}).`);
  await writeOutput({ ready: false, channel: release.channel, status: signedFile.status });
  process.exit(0);
}

await downloadSignedFile({
  url: signedFile.url,
  hash: signedFile.hash,
  outputPath,
  issuer,
  secret,
});
console.log(`Downloaded Mozilla-signed Firefox ${version} to ${outputPath}.`);
await writeOutput({ ready: true, channel: release.channel, status: signedFile.status });
