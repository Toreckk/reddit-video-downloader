import { describe, expect, it } from 'vitest';
import { matchRedgifsUrl } from '@/src/providers/redgifs/match';

describe('matchRedgifsUrl', () => {
  it.each([
    'https://redgifs.com/watch/FancyOtter',
    'https://www.redgifs.com/watch/FancyOtter?ref=reddit#player',
    'https://www.redgifs.com/ifr/FancyOtter',
    'https://v3.redgifs.com/watch/FancyOtter',
  ])('normalizes %s', (rawUrl) => {
    expect(matchRedgifsUrl(new URL(rawUrl))).toEqual({
      providerId: 'redgifs',
      canonicalId: 'fancyotter',
      sourceUrl: 'https://www.redgifs.com/watch/fancyotter',
    });
  });

  it.each([
    'https://example.com/watch/FancyOtter',
    'https://api.redgifs.com/v2/gifs/FancyOtter',
    'https://redgifs.com/browse/FancyOtter',
    'https://redgifs.com/watch/a',
    'https://redgifs.com/watch/FancyOtter/extra',
  ])('rejects %s', (rawUrl) => {
    expect(matchRedgifsUrl(new URL(rawUrl))).toBeNull();
  });
});
