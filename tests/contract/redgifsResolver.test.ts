import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { HttpClient, HttpResponse } from '@/src/core/infrastructure/extensionHttpClient';
import type { MediaReference } from '@/src/core/domain/media';
import { RedgifsResolver } from '@/src/providers/redgifs/resolver';
import { RedgifsTokenManager } from '@/src/providers/redgifs/tokenManager';

const audioFixture = JSON.parse(
  readFileSync('tests/fixtures/redgifs/audio.json', 'utf8'),
) as unknown;
const reference: MediaReference = {
  providerId: 'redgifs',
  canonicalId: 'examplevideo',
  sourceUrl: 'https://www.redgifs.com/watch/examplevideo',
};

function response(status: number, body: unknown): HttpResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('RedgifsResolver contract', () => {
  it('normalizes provider JSON without leaking provider-specific structure', async () => {
    const http: HttpClient = {
      get: async (url) =>
        url.includes('/auth/')
          ? response(200, { token: 'temporary-token' })
          : response(200, audioFixture),
    };
    const resolved = await new RedgifsResolver(http, new RedgifsTokenManager(http)).resolve(
      reference,
      {},
    );
    expect(resolved.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hd',
          quality: 'hd',
          hasAudio: true,
          isSilentVariant: false,
        }),
        expect.objectContaining({ id: 'silent', hasAudio: false, isSilentVariant: true }),
      ]),
    );
    expect(resolved.metadata).toEqual({
      providerMediaId: 'ExampleVideo',
      hasAudio: true,
      hls: true,
    });
    expect(resolved.creator).toBe('Redgifs Artist ✨');
  });

  it('invalidates its token and retries metadata exactly once after a 401', async () => {
    let metadataRequests = 0;
    const get = vi.fn(async (url: string) => {
      if (url.includes('/auth/')) return response(200, { token: `token-${get.mock.calls.length}` });
      metadataRequests += 1;
      return metadataRequests === 1 ? response(401, {}) : response(200, audioFixture);
    });
    const http = { get } as HttpClient;
    await new RedgifsResolver(http, new RedgifsTokenManager(http)).resolve(reference, {});
    expect(metadataRequests).toBe(2);
    expect(get.mock.calls.filter(([url]) => String(url).includes('/auth/'))).toHaveLength(2);
  });
});
