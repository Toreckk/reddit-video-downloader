import {
  loadPackageVersion,
  loadReleaseConfiguration,
  resolvePrerelease,
  writeGitHubOutput,
} from './firefox-release-policy.mjs';

function requiredOption(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}

const configuration = await loadReleaseConfiguration();
const baseVersion = await loadPackageVersion();
const release = resolvePrerelease(
  {
    baseVersion,
    buildNumber: Number(requiredOption('--build-number')),
    rcNumber: Number(requiredOption('--rc-number')),
    targetVersion: requiredOption('--target-version'),
  },
  configuration,
);
const githubOutput = requiredOption('--github-output');

await writeGitHubOutput(githubOutput, {
  channel: release.channel,
  display_version: release.displayVersion,
  extension_id: release.extensionId,
  manifest_version: release.manifestVersion,
  release_tag: release.releaseTag,
  update_url: release.updateUrl,
});
