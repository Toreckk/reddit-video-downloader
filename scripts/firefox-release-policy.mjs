import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);

export function parseNumericVersion(version, label = 'version') {
  if (!/^(0|[1-9]\d{0,8})(\.(0|[1-9]\d{0,8})){1,3}$/.test(version)) {
    throw new Error(`${label} must contain 2-4 dot-separated numbers: ${version}`);
  }

  return version.split('.').map(Number);
}

export function compareNumericVersions(left, right) {
  const leftParts = parseNumericVersion(left, 'left version');
  const rightParts = parseNumericVersion(right, 'right version');
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export function resolveStableRelease(version, configuration) {
  parseNumericVersion(version);
  const firefox = configuration.firefox;
  const listed = compareNumericVersions(version, firefox.listedFromVersion) >= 0;
  const channel = listed ? 'listed' : firefox.stableChannelBeforeListed;

  if (channel !== 'listed' && channel !== 'unlisted') {
    throw new Error(`Unsupported stable Firefox channel: ${channel}`);
  }

  return {
    channel,
    extensionId: firefox.extensionId,
    manifestVersion: version,
    updateUrl: channel === 'unlisted' ? firefox.stableUpdateUrl : '',
  };
}

export function resolvePrerelease(
  { baseVersion, buildNumber, rcNumber, targetVersion },
  configuration,
) {
  const baseParts = parseNumericVersion(baseVersion, 'base version');
  parseNumericVersion(targetVersion, 'target version');

  if (baseParts.length !== 3) {
    throw new Error(`The stable base version must have exactly 3 parts: ${baseVersion}`);
  }
  if (compareNumericVersions(targetVersion, baseVersion) <= 0) {
    throw new Error(`The prerelease target ${targetVersion} must be newer than ${baseVersion}`);
  }
  if (!Number.isSafeInteger(buildNumber) || buildNumber < 1 || buildNumber > 999_999_999) {
    throw new Error('The prerelease build number must be an integer between 1 and 999999999');
  }
  if (!Number.isSafeInteger(rcNumber) || rcNumber < 1 || rcNumber > 999_999_999) {
    throw new Error('The RC number must be an integer between 1 and 999999999');
  }

  const manifestVersion = `${baseVersion}.${buildNumber}`;
  const displayVersion = `${targetVersion}-rc.${rcNumber}`;

  return {
    channel: configuration.firefox.prereleaseChannel,
    displayVersion,
    extensionId: configuration.firefox.extensionId,
    manifestVersion,
    releaseTag: `v${displayVersion}`,
    updateUrl: configuration.firefox.prereleaseUpdateUrl,
  };
}

export async function loadReleaseConfiguration() {
  return JSON.parse(await readFile(new URL('release.config.json', rootUrl), 'utf8'));
}

export async function loadPackageVersion() {
  const packageMetadata = JSON.parse(await readFile(new URL('package.json', rootUrl), 'utf8'));
  return packageMetadata.version;
}

export async function writeGitHubOutput(filePath, values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}`);
  await writeFile(filePath, `${lines.join('\n')}\n`, { flag: 'a' });
}
