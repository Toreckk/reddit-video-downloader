import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_API_BASE_URL = 'https://addons.mozilla.org/api/v5/';

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAmoJwt({
  issuer,
  secret,
  issuedAt = Math.floor(Date.now() / 1000),
  jwtId = randomUUID(),
}) {
  if (!issuer || !secret) throw new Error('Mozilla API credentials are required.');
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    iss: issuer,
    jti: jwtId,
    iat: issuedAt,
    exp: issuedAt + 60,
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function authHeaders(credentials) {
  return {
    Accept: 'application/json',
    Authorization: `JWT ${createAmoJwt(credentials)}`,
    'User-Agent': 'reddit-video-downloader-release-finalizer',
  };
}

export async function fetchAmoVersion({
  extensionId,
  version,
  issuer,
  secret,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImplementation = fetch,
}) {
  const url = new URL(
    `addons/addon/${encodeURIComponent(extensionId)}/versions/${encodeURIComponent(version)}/`,
    apiBaseUrl,
  );
  const response = await fetchImplementation(url, {
    headers: authHeaders({ issuer, secret }),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Mozilla version lookup failed with HTTP ${response.status}.`);
  }
  return response.json();
}

export function resolveSignedFile(versionDetails) {
  if (!versionDetails || typeof versionDetails !== 'object') {
    return { ready: false, status: 'not-found' };
  }
  const file = versionDetails.file;
  const status =
    file && typeof file === 'object' && typeof file.status === 'string' ? file.status : 'unknown';
  if (
    status !== 'public' ||
    !file ||
    typeof file !== 'object' ||
    typeof file.url !== 'string' ||
    !file.url
  ) {
    return { ready: false, status };
  }
  return {
    ready: true,
    status,
    url: file.url,
    hash: typeof file.hash === 'string' ? file.hash : undefined,
  };
}

export async function downloadSignedFile({
  url,
  hash,
  outputPath,
  issuer,
  secret,
  fetchImplementation = fetch,
}) {
  const response = await fetchImplementation(url, {
    headers: authHeaders({ issuer, secret }),
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Mozilla signed-file download failed with HTTP ${response.status}.`);
  }
  const file = Buffer.from(await response.arrayBuffer());
  if (hash?.startsWith('sha256:')) {
    const expected = hash.slice('sha256:'.length).toLowerCase();
    const actual = createHash('sha256').update(file).digest('hex');
    if (actual !== expected) {
      throw new Error("The signed XPI does not match Mozilla's SHA-256 hash.");
    }
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, file);
}
