import type { MediaReference } from '@/src/core/domain/media';

const ID_PATTERN = /^[a-z0-9]{5,32}$/i;

export function matchVRedditUrl(url: URL): MediaReference | null {
  if (url.hostname.toLowerCase().replace(/\.$/, '') !== 'v.redd.it') return null;
  const canonicalId = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (!canonicalId || !ID_PATTERN.test(canonicalId)) return null;

  return {
    providerId: 'vreddit',
    canonicalId,
    sourceUrl: `https://v.redd.it/${canonicalId}`,
  };
}
