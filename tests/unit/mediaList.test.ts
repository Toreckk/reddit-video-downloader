import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedMediaItem } from '@/src/core/domain/media';
import { MediaListView } from '@/src/popup/mediaList';

const items: DetectedMediaItem[] = [
  {
    itemId: 'one',
    reference: {
      providerId: 'redgifs',
      canonicalId: 'firstclip',
      sourceUrl: 'https://redgifs.com/watch/firstclip',
    },
    providerLabel: 'Redgifs',
    post: { postId: 't3_one', title: 'Dancing fox', creator: 'alice', subreddit: 'animals' },
    documentOrder: 0,
    isVisible: true,
  },
  {
    itemId: 'two',
    reference: {
      providerId: 'redgifs',
      canonicalId: 'secondclip',
      sourceUrl: 'https://redgifs.com/watch/secondclip',
    },
    providerLabel: 'Redgifs',
    post: { postId: 't3_two', title: 'City lights', creator: 'bob', subreddit: 'videos' },
    documentOrder: 1,
    isVisible: false,
  },
];

describe('MediaListView', () => {
  let list: HTMLUListElement;
  let view: MediaListView;

  beforeEach(() => {
    list = document.createElement('ul');
    view = new MediaListView(list);
    view.render(items, vi.fn());
  });

  it('filters case-insensitively across title, users, subreddit, provider, and ID', () => {
    expect(view.filter('FOX').map((item) => item.itemId)).toEqual(['one']);
    expect(view.filter('bob').map((item) => item.itemId)).toEqual(['two']);
    expect(view.filter('redgifs')).toHaveLength(2);
    expect(view.filter('missing')).toEqual([]);
  });

  it('removes the shown rows from the view', () => {
    const shown = view.filter('alice');
    view.remove(shown.map((item) => item.itemId));
    expect(view.size).toBe(1);
    expect(list.textContent).toContain('City lights');
  });

  it('keeps emoji in the title displayed by the popup', () => {
    const baseItem = items[0];
    if (!baseItem) throw new Error('Missing media-list fixture.');
    const emojiItem: DetectedMediaItem = {
      ...baseItem,
      post: { ...baseItem.post, title: 'Dancing fox 🦊✨' },
    };
    view.render([emojiItem], vi.fn());

    expect(list.textContent).toContain('Dancing fox 🦊✨');
  });
});
