import {
  loadPackageVersion,
  loadReleaseConfiguration,
  resolvePrerelease,
  writeGitHubOutput,
} from './firefox-release-policy.mjs';
import { execFileSync } from 'node:child_process';

function requiredOption(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}

function optionalOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const configuration = await loadReleaseConfiguration();
const packageVersion = await loadPackageVersion();
const baseRef = optionalOption('--base-ref');
const baseVersion = baseRef
  ? JSON.parse(execFileSync('git', ['show', `${baseRef}:package.json`], { encoding: 'utf8' }))
      .version
  : packageVersion;
const targetVersion = requiredOption('--target-version');
if (baseRef && targetVersion !== packageVersion) {
  throw new Error(
    `The prerelease target ${targetVersion} must match the version branch package ${packageVersion}`,
  );
}
const release = resolvePrerelease(
  {
    baseVersion,
    buildNumber: Number(requiredOption('--build-number')),
    rcNumber: Number(requiredOption('--rc-number')),
    targetVersion,
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
