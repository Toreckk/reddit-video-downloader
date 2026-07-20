import type { MediaReference } from '@/src/core/domain/media';

const ID_PATTERN = /^[a-z0-9_-]{3,100}$/i;
const SUPPORTED_PATHS = new Set(['watch', 'ifr']);

export function matchRedgifsUrl(url: URL): MediaReference | null {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname !== 'redgifs.com' && !hostname.endsWith('.redgifs.com')) return null;
  if (hostname === 'api.redgifs.com') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const pathType = parts[0]?.toLowerCase();
  const rawId = parts[1];
  if (parts.length !== 2 || !pathType || !SUPPORTED_PATHS.has(pathType) || !rawId) return null;
  if (!ID_PATTERN.test(rawId)) return null;

  const canonicalId = rawId.toLowerCase();
  return {
    providerId: 'redgifs',
    canonicalId,
    sourceUrl: `https://www.redgifs.com/watch/${canonicalId}`,
  };
}
