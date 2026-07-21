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

const POST_SELECTOR = 'shreddit-post, [data-testid="post-container"]';

export class CurrentRedditAdapter implements SiteSurfaceAdapter {
  readonly id = 'reddit-current';

  matchesPage(location: Location): boolean {
    return isRedditLocation(location);
  }

  discover(root: ParentNode): PostContext[] {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(POST_SELECTOR));
    const posts = candidates.filter(
      (candidate) => !candidate.parentElement?.closest(POST_SELECTOR),
    );

    return posts.map((post, documentOrder) => {
      const postId =
        attributeFrom(post, ['id', 'thing-id', 'data-post-id', 'data-fullname']) ??
        `current-reddit-post-${documentOrder}`;
      const outboundUrls = collectUrls(
        post,
        ['content-href', 'outbound-url', 'data-url', 'url'],
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
      assignIfPresent(
        context,
        'title',
        attributeFrom(post, ['post-title', 'data-title']) ??
          textFrom(post, ['[slot="title"]', 'h1', 'h2', 'h3']),
      );
      assignIfPresent(
        context,
        'author',
        stripPrefix(
          attributeFrom(post, ['author', 'data-author']) ??
            textFrom(post, ['[slot="authorName"]', 'a[href*="/user/"]']),
          /^u\//i,
        ),
      );
      assignIfPresent(
        context,
        'subreddit',
        stripPrefix(
          attributeFrom(post, ['subreddit-prefixed-name', 'subreddit-name', 'data-subreddit']) ??
            textFrom(post, ['a[href^="/r/"]']),
          /^r\//i,
        ),
      );
      assignIfPresent(
        context,
        'thumbnailUrl',
        thumbnailFrom(post, ['thumbnail', 'data-thumbnail']),
      );
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
