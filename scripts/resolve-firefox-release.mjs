import {
  loadPackageVersion,
  loadReleaseConfiguration,
  resolveStableRelease,
  writeGitHubOutput,
} from './firefox-release-policy.mjs';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const configuration = await loadReleaseConfiguration();
const version = readOption('--version') ?? (await loadPackageVersion());
const release = resolveStableRelease(version, configuration);
const githubOutput = readOption('--github-output');

if (githubOutput) {
  await writeGitHubOutput(githubOutput, {
    channel: release.channel,
    extension_id: release.extensionId,
    manifest_version: release.manifestVersion,
    update_url: release.updateUrl,
  });
} else {
  console.log(JSON.stringify(release, null, 2));
}
