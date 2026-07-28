import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentRedditAdapter } from '@/src/surfaces/reddit/currentRedditAdapter';
import { OldRedditAdapter } from '@/src/surfaces/reddit/oldRedditAdapter';
import { InlineDownloadController } from '@/src/surfaces/reddit/inlineDownloadController';
import { ProviderRegistry } from '@/src/core/application/providerRegistry';
import { RedgifsProvider } from '@/src/providers/redgifs';
import { VRedditProvider } from '@/src/providers/vreddit';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';

const browserMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: browserMocks.sendMessage,
    },
  },
}));

const oldFixture = readFileSync('tests/fixtures/reddit-old/listing.html', 'utf8');
const oldSearchFixture = readFileSync('tests/fixtures/reddit-old/search.html', 'utf8');
const currentFixture = readFileSync('tests/fixtures/reddit-current/listing.html', 'utf8');
const neverHttp: HttpClient = {
  get: async () => Promise.reject(new Error('DOM discovery must not call the provider API')),
};

describe('Reddit surface adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', 'https://www.reddit.com/r/test');
  });

  afterEach(() => vi.useRealTimers());

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

  it('adds inline actions only to supported old Reddit posts', () => {
    document.body.innerHTML = oldFixture;
    for (const post of document.querySelectorAll('.thing.link')) {
      post.insertAdjacentHTML('beforeend', '<ul class="flat-list buttons"></ul>');
    }
    const controller = new InlineDownloadController(
      new ProviderRegistry([new RedgifsProvider(neverHttp)]),
      [new OldRedditAdapter()],
    );

    controller.start();
    expect(document.querySelectorAll('.rmd-inline-download')).toHaveLength(2);
    expect(
      document.querySelector('.thing[data-fullname="t3_other"] .rmd-inline-download'),
    ).toBeNull();
    controller.stop();
    expect(document.querySelector('.rmd-inline-download')).toBeNull();
  });

  it('keeps the old Reddit action immediately after the RES [l+c] action', async () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_order" data-url="https://redgifs.com/watch/OrderClip">
        <p class="title"><a class="title">Ordered post</a></p>
        <ul class="flat-list buttons"><li class="comments">comments</li></ul>
      </div>`;
    const controller = new InlineDownloadController(
      new ProviderRegistry([new RedgifsProvider(neverHttp)]),
      [new OldRedditAdapter()],
    );
    controller.start();

    const mount = document.querySelector<HTMLElement>('.flat-list.buttons');
    mount?.insertAdjacentHTML(
      'beforeend',
      '<li class="res-combined"><a class="noCtrlF" data-text="[l+c]"></a></li>',
    );

    await vi.waitFor(() => {
      expect(
        document
          .querySelector('.res-combined')
          ?.nextElementSibling?.classList.contains('rmd-inline-action'),
      ).toBe(true);
    });
    controller.stop();
  });

  it('shows download errors in an auto-dismissing toast without inline layout content', async () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_error" data-url="https://redgifs.com/watch/ErrorClip">
        <p class="title"><a class="title">Error post</a></p>
        <ul class="flat-list buttons"></ul>
      </div>`;
    browserMocks.sendMessage.mockResolvedValue({
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the media provider.',
        details: 'Temporary failure',
      },
    });
    const controller = new InlineDownloadController(
      new ProviderRegistry([new RedgifsProvider(neverHttp)]),
      [new OldRedditAdapter()],
    );
    controller.start();
    vi.useFakeTimers();

    document.querySelector<HTMLButtonElement>('.rmd-inline-download')?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(document.querySelector('.rmd-inline-status')).toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not reach the media provider. Detail: Temporary failure [NETWORK_ERROR]',
    );
    expect(document.querySelector('.rmd-inline-download')?.textContent).toBe('retry');

    await vi.advanceTimersByTimeAsync(8000);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    controller.stop();
  });

  it('discovers old Reddit search cards and mounts actions in their metadata rows', () => {
    window.history.replaceState({}, '', 'https://www.reddit.com/search?q=url%3Av.redd.it');
    document.body.innerHTML = oldSearchFixture;
    const adapter = new OldRedditAdapter();
    const contexts = adapter.discover(document);

    expect(contexts).toHaveLength(3);
    expect(contexts[0]).toMatchObject({
      postId: 't3_vreddit_search',
      title: 'Crystal chase',
      author: 'joenun',
      subreddit: 'nunvids',
    });
    expect(contexts[0]?.outboundUrls.map(String)).toContain('https://v.redd.it/xxl4555bd18f1');

    const controller = new InlineDownloadController(
      new ProviderRegistry([new RedgifsProvider(neverHttp), new VRedditProvider(neverHttp)]),
      [adapter],
    );
    controller.start();
    expect(document.querySelectorAll('.rmd-inline-download')).toHaveLength(2);
    expect(
      document.querySelector(
        '[data-fullname="t3_vreddit_search"] .search-result-meta .rmd-inline-download',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-fullname="t3_unsupported_search"] .rmd-inline-download'),
    ).toBeNull();
    controller.stop();
  });
});
