import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderRegistry } from '@/src/core/application/providerRegistry';
import type { MediaProvider } from '@/src/core/domain/media';
import { RedgifsProvider } from '@/src/providers/redgifs';
import { VRedditProvider } from '@/src/providers/vreddit';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { CurrentRedditAdapter } from '@/src/surfaces/reddit/currentRedditAdapter';
import { scanActivePage } from '@/src/surfaces/reddit/scanActivePage';

const fixture = readFileSync('tests/fixtures/reddit-current/listing.html', 'utf8');
const neverHttp: HttpClient = {
  get: async () => Promise.reject(new Error('Scanning must not call the API')),
};

describe('scanActivePage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'https://www.reddit.com/r/test');
    document.body.innerHTML = fixture;
  });

  it('keeps the same media in separate posts and serializes plain data', () => {
    const provider: MediaProvider = new RedgifsProvider(neverHttp);
    const result = scanActivePage(document, window.location, new ProviderRegistry([provider]), [
      new CurrentRedditAdapter(),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.post.creator)).toEqual(['bob', 'carol']);
    expect(result.items[0]?.reference.canonicalId).toBe('secondclip');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('defaults to opened embeds and can include every supported loaded link', () => {
    const provider: MediaProvider = new RedgifsProvider(neverHttp);
    const registry = new ProviderRegistry([provider]);
    const adapter = new CurrentRedditAdapter();
    const opened = scanActivePage(document, window.location, registry, [adapter], 'opened');
    const all = scanActivePage(document, window.location, registry, [adapter], 'all');

    expect(opened.items.map((item) => item.post.postId)).toEqual(['t3_current', 't3_duplicate']);
    expect(all.items.map((item) => item.post.postId)).toEqual([
      't3_current',
      't3_duplicate',
      't3_closed',
    ]);
  });

  it('treats a visible native Reddit player as an opened v.redd.it video', () => {
    document.body.innerHTML = `
      <shreddit-post id="t3_native" author="reddit-user" content-href="https://v.redd.it/xko5vazktfeh1">
        <shreddit-player></shreddit-player>
      </shreddit-post>`;
    const provider: MediaProvider = new VRedditProvider(neverHttp);
    const result = scanActivePage(
      document,
      window.location,
      new ProviderRegistry([provider]),
      [new CurrentRedditAdapter()],
      'opened',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.reference).toMatchObject({
      providerId: 'vreddit',
      canonicalId: 'xko5vazktfeh1',
    });
  });
});
