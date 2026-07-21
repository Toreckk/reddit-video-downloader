import type { ProviderRegistry } from '@/src/core/application/providerRegistry';
import type { DetectedMediaItem, DetectionMode } from '@/src/core/domain/media';
import { AppError } from '@/src/core/domain/errors';
import type { SiteSurfaceAdapter } from './types';
import type { PostContext } from './types';

export interface ScanResult {
  items: DetectedMediaItem[];
  surfaceId: string;
}

export function scanActivePage(
  root: ParentNode,
  pageLocation: Location,
  registry: ProviderRegistry,
  adapters: readonly SiteSurfaceAdapter[],
  detectionMode: DetectionMode = 'opened',
): ScanResult {
  const matching = adapters.filter((adapter) => adapter.matchesPage(pageLocation));
  if (matching.length === 0) {
    throw new AppError(
      'UNSUPPORTED_PAGE',
      'Open the extension on a Reddit page to scan for videos.',
    );
  }

  const contexts = matching.flatMap((adapter) => adapter.discover(root));
  const items = detectMediaItems(contexts, registry, detectionMode);
  const discoveredSurfaceIds = [...new Set(contexts.map((context) => context.surfaceId))];
  return { items, surfaceId: discoveredSurfaceIds.join(',') || matching[0]?.id || 'reddit' };
}

export function detectMediaItems(
  contexts: readonly PostContext[],
  registry: ProviderRegistry,
  detectionMode: DetectionMode,
): DetectedMediaItem[] {
  const seen = new Set<string>();
  const items: DetectedMediaItem[] = [];
  for (const context of contexts) {
    const candidateUrls =
      detectionMode === 'opened' ? context.activatedOutboundUrls : context.outboundUrls;
    for (const outboundUrl of candidateUrls) {
      const matched = registry.match(outboundUrl);
      if (!matched) continue;
      const key = `${matched.reference.providerId}:${matched.reference.canonicalId}:${context.postId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const post: DetectedMediaItem['post'] = { postId: context.postId };
      if (context.title !== undefined) post.title = context.title;
      if (context.author !== undefined) post.creator = context.author;
      if (context.subreddit !== undefined) post.subreddit = context.subreddit;
      if (context.thumbnailUrl !== undefined) post.thumbnailUrl = context.thumbnailUrl;
      items.push({
        itemId: key,
        reference: matched.reference,
        providerLabel: matched.provider.label,
        post,
        documentOrder: context.documentOrder,
        isVisible: context.isVisible,
      });
    }
  }

  items.sort((left, right) => {
    if (left.isVisible !== right.isVisible) return left.isVisible ? -1 : 1;
    return left.documentOrder - right.documentOrder;
  });
  return items;
}
