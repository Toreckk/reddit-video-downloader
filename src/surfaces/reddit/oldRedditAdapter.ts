import {
  attributeFrom,
  collectActivatedEmbedUrls,
  collectActivatedNativeMediaUrls,
  collectUrls,
  elementIsVisible,
  isRedditLocation,
  stripPrefix,
  textFrom,
  thumbnailFrom,
} from './domUtils';
import type { PostContext, SiteSurfaceAdapter } from './types';

export class OldRedditAdapter implements SiteSurfaceAdapter {
  readonly id = 'reddit-old';

  matchesPage(location: Location): boolean {
    return isRedditLocation(location);
  }

  discover(root: ParentNode): PostContext[] {
    const posts = Array.from(
      root.querySelectorAll<HTMLElement>('.thing.link, .thing[data-fullname]'),
    );
    return posts.map((post, documentOrder) => {
      const postId =
        attributeFrom(post, ['data-fullname', 'data-id']) ?? `old-reddit-post-${documentOrder}`;
      const outboundUrls = collectUrls(
        post,
        ['data-url', 'data-href-url', 'data-outbound-url'],
        location.href,
      );
      const context: PostContext = {
        surfaceId: this.id,
        postElement: post,
        postId,
        outboundUrls,
        activatedOutboundUrls: [
          ...collectActivatedEmbedUrls(post, location.href),
          ...collectActivatedNativeMediaUrls(post, outboundUrls),
        ],
        documentOrder,
        isVisible: elementIsVisible(post),
      };
      assignIfPresent(context, 'title', textFrom(post, ['a.title', '.title > a', 'h1']));
      assignIfPresent(context, 'author', textFrom(post, ['a.author', '[data-author]']));
      assignIfPresent(
        context,
        'subreddit',
        stripPrefix(textFrom(post, ['a.subreddit', '.subreddit']), /^r\//i),
      );
      assignIfPresent(context, 'thumbnailUrl', thumbnailFrom(post, ['data-thumbnail']));
      return context;
    });
  }
}

function assignIfPresent<K extends 'title' | 'author' | 'subreddit' | 'thumbnailUrl'>(
  context: PostContext,
  key: K,
  value: string | undefined,
): void {
  if (value !== undefined) context[key] = value;
}
