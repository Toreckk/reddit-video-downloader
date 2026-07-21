import { describe, expect, it, vi } from 'vitest';
import type { HttpResponse } from '@/src/core/infrastructure/extensionHttpClient';
import { RedgifsTokenManager } from '@/src/providers/redgifs/tokenManager';

function jwt(expSeconds: number): string {
  return `header.${btoa(JSON.stringify({ exp: expSeconds })).replace(/=/g, '')}.signature`;
}

describe('RedgifsTokenManager', () => {
  it('deduplicates concurrent requests and caches until near expiry', async () => {
    const now = 1_700_000_000_000;
    const response: HttpResponse = {
      ok: true,
      status: 200,
      json: async () => ({ token: jwt(now / 1000 + 300) }),
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    const get = vi.fn(async () => response);
    const manager = new RedgifsTokenManager({ get }, () => now);

    const [first, second] = await Promise.all([manager.getToken(), manager.getToken()]);
    expect(first).toBe(second);
    expect(get).toHaveBeenCalledTimes(1);
    await manager.getToken();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches after invalidation', async () => {
    let counter = 0;
    const manager = new RedgifsTokenManager({
      get: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ token: `opaque-${++counter}` }),
        text: async () => '',
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });
    expect(await manager.getToken()).toBe('opaque-1');
    manager.invalidate();
    expect(await manager.getToken()).toBe('opaque-2');
  });
});
