import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadReleaseConfiguration, parseNumericVersion } from './firefox-release-policy.mjs';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function compareVersionsDescending(left, right) {
  const leftParts = parseNumericVersion(left.version);
  const rightParts = parseNumericVersion(right.version);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

async function fetchReleases(repository, token) {
  const releases = [];
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let page = 1; ; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Unable to read GitHub releases: ${response.status} ${response.statusText}`);
    }

    const pageReleases = await response.json();
    releases.push(...pageReleases);
    if (pageReleases.length < 100) return releases;
  }
}

async function fetchListedVersions(extensionId) {
  const versions = [];
  let next = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(extensionId)}/versions/?page_size=100`;

  while (next) {
    const response = await fetch(next, { headers: { Accept: 'application/json' } });

    // Before 1.0.0 is listed, the add-on has no public AMO record.
    if ([401, 403, 404].includes(response.status)) return [];
    if (!response.ok) {
      throw new Error(
        `Unable to read public AMO versions: ${response.status} ${response.statusText}`,
      );
    }

    const page = await response.json();
    versions.push(...(page.results ?? []));
    next = page.next;
  }

  return versions;
}

function collectUpdates(releases, prerelease) {
  const assetPattern = /^reddit-video-downloader-(\d+(?:\.\d+){1,3})\.xpi$/;
  const updates = [];

  for (const release of releases) {
    if (release.draft || Boolean(release.prerelease) !== prerelease) continue;

    for (const asset of release.assets ?? []) {
      const match = assetPattern.exec(asset.name);
      if (!match) continue;

      const version = match[1];
      parseNumericVersion(version);
      updates.push({ update_link: asset.browser_download_url, version });
    }
  }

  return updates.sort(compareVersionsDescending);
}

function collectListedUpdates(versions) {
  return versions
    .filter((version) => version.channel === 'listed' && version.file?.url)
    .map((version) => {
      parseNumericVersion(version.version);
      return { update_link: version.file.url, version: version.version };
    });
}

function mergeUpdates(...updateGroups) {
  const updatesByVersion = new Map();

  for (const update of updateGroups.flat()) {
    if (!updatesByVersion.has(update.version)) updatesByVersion.set(update.version, update);
  }

  return [...updatesByVersion.values()].sort(compareVersionsDescending);
}

function createManifest(extensionId, updates) {
  return { addons: { [extensionId]: { updates } } };
}

const configuration = await loadReleaseConfiguration();
const outputDirectory = readOption('--output-dir') ?? 'pages-output';
const releasesFile = readOption('--releases-file');
const listedVersionsFile = readOption('--listed-versions-file');
const repository = process.env.GITHUB_REPOSITORY ?? 'Toreckk/reddit-video-downloader';
const token = process.env.GITHUB_TOKEN;
const releases = releasesFile
  ? JSON.parse(await readFile(releasesFile, 'utf8'))
  : await fetchReleases(repository, token ?? '');
const listedVersions = listedVersionsFile
  ? JSON.parse(await readFile(listedVersionsFile, 'utf8')).results
  : releasesFile
    ? []
    : await fetchListedVersions(configuration.firefox.extensionId);
const stableUpdates = mergeUpdates(
  collectUpdates(releases, false),
  collectListedUpdates(listedVersions),
);
const prereleaseUpdates = collectUpdates(releases, true);

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    `${outputDirectory}/updates.json`,
    `${JSON.stringify(createManifest(configuration.firefox.extensionId, stableUpdates), null, 2)}\n`,
  ),
  writeFile(
    `${outputDirectory}/prerelease-updates.json`,
    `${JSON.stringify(createManifest(configuration.firefox.extensionId, prereleaseUpdates), null, 2)}\n`,
  ),
  writeFile(`${outputDirectory}/.nojekyll`, ''),
  writeFile(
    `${outputDirectory}/index.html`,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reddit Media Downloader updates</title>
  </head>
  <body>
    <h1>Reddit Media Downloader</h1>
    <p>Firefox update manifests for signed self-distributed releases and the transition to AMO.</p>
    <ul>
      <li><a href="updates.json">Stable updates</a></li>
      <li><a href="prerelease-updates.json">Prerelease updates</a></li>
    </ul>
    <p><a href="https://github.com/Toreckk/reddit-video-downloader">Source and releases</a></p>
  </body>
</html>
`,
  ),
]);

console.log(
  `Generated ${stableUpdates.length} stable and ${prereleaseUpdates.length} prerelease update entries.`,
);
