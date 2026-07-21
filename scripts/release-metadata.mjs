import { readFile } from 'node:fs/promises';

export async function loadVersionMetadata() {
  const [packageJson, packageLock, changelog] = await Promise.all([
    readJson('package.json'),
    readJson('package-lock.json'),
    readFile('CHANGELOG.md', 'utf8'),
  ]);
  const version = packageJson.version;

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json must contain a stable numeric version, received ${version}`);
  }
  if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
    throw new Error('package.json and package-lock.json versions must match');
  }

  return {
    changelog,
    releaseNotes: extractReleaseNotes(changelog, version),
    tagName: `v${version}`,
    version,
  };
}

export function extractReleaseNotes(changelog, version) {
  const headingPattern = new RegExp(`^## ${escapeRegExp(version)}(?: \\(.*\\))?\\s*$`, 'm');
  const heading = headingPattern.exec(changelog);
  if (!heading) throw new Error(`CHANGELOG.md has no release section for ${version}`);

  const contentStart = heading.index + heading[0].length;
  const remaining = changelog.slice(contentStart);
  const nextHeading = /^## /m.exec(remaining);
  const notes = remaining.slice(0, nextHeading?.index).trim();
  if (!notes) throw new Error(`CHANGELOG.md release section for ${version} is empty`);
  if (!/^### Notable changes$/m.test(notes)) {
    throw new Error(`CHANGELOG.md release section for ${version} needs a Notable changes heading`);
  }
  return `${notes}\n`;
}

export function compareNumericVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
