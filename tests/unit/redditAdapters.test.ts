import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CurrentRedditAdapter } from '@/src/surfaces/reddit/currentRedditAdapter';
import { OldRedditAdapter } from '@/src/surfaces/reddit/oldRedditAdapter';

const oldFixture = readFileSync('tests/fixtures/reddit-old/listing.html', 'utf8');
const currentFixture = readFileSync('tests/fixtures/reddit-current/listing.html', 'utf8');

describe('Reddit surface adapters', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'https://www.reddit.com/r/test');
  });

  it('discovers old Reddit metadata and includes closed/open RES iframe URLs without mutating DOM', () => {
    document.body.innerHTML = oldFixture;
    const before = document.body.innerHTML;
    const contexts = new OldRedditAdapter().discover(document);
    expect(contexts[0]).toMatchObject({
      postId: 't3_first',
      title: 'First old Reddit post',
      author: 'alice',
      subreddit: 'videos',
      documentOrder: 0,
    });
    expect(contexts[0]?.outboundUrls.map(String)).toContain(
      'https://www.redgifs.com/watch/FirstClip?ref=reddit',
    );
    expect(contexts[0]?.outboundUrls.map(String)).toContain(
      'https://www.redgifs.com/ifr/FirstClip',
    );
    expect(contexts[0]?.activatedOutboundUrls.map(String)).toContain(
      'https://www.redgifs.com/ifr/FirstClip',
    );
    expect(contexts[1]?.activatedOutboundUrls).toEqual([]);
    expect(document.body.innerHTML).toBe(before);
  });

  it('discovers current Reddit custom-element metadata', () => {
    document.body.innerHTML = currentFixture;
    const contexts = new CurrentRedditAdapter().discover(document);
    expect(contexts).toHaveLength(3);
    expect(contexts[0]).toMatchObject({
      postId: 't3_current',
      title: 'Current Reddit post',
      author: 'bob',
      subreddit: 'funny',
    });
    expect(contexts[0]?.activatedOutboundUrls).toHaveLength(1);
    expect(contexts[2]?.activatedOutboundUrls).toEqual([]);
  });

  it('sees dynamically appended posts on a fresh scan', () => {
    document.body.innerHTML = '<main></main>';
    const adapter = new CurrentRedditAdapter();
    expect(adapter.discover(document)).toHaveLength(0);
    document
      .querySelector('main')
      ?.insertAdjacentHTML(
        'beforeend',
        '<shreddit-post id="t3_new" content-href="https://redgifs.com/watch/NewClip"></shreddit-post>',
      );
    expect(adapter.discover(document)).toHaveLength(1);
  });
});
