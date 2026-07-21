import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMocks = vi.hoisted(() => ({
  contains: vi.fn(),
  reload: vi.fn(),
  request: vi.fn(),
  query: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      contains: browserMocks.contains,
      request: browserMocks.request,
    },
    tabs: {
      query: browserMocks.query,
      reload: browserMocks.reload,
    },
  },
}));

import {
  containsRequiredHostPermissions,
  REDDIT_REQUIRED_ORIGINS,
  reloadOpenRedditTabs,
  REQUIRED_HOST_ORIGINS,
  requestRequiredHostPermissions,
} from '@/src/core/infrastructure/hostPermissions';

describe('host permissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks and requests the complete explicit origin set', async () => {
    browserMocks.contains.mockResolvedValue(true);
    browserMocks.request.mockResolvedValue(true);

    await expect(containsRequiredHostPermissions()).resolves.toBe(true);
    await expect(requestRequiredHostPermissions()).resolves.toBe(true);

    const expected = { origins: [...REQUIRED_HOST_ORIGINS] };
    expect(browserMocks.contains).toHaveBeenCalledWith(expected);
    expect(browserMocks.request).toHaveBeenCalledWith(expected);
  });

  it('reloads only open Reddit tabs after access is granted', async () => {
    browserMocks.query.mockResolvedValue([{ id: 11 }, { id: undefined }, { id: 12 }]);
    browserMocks.reload.mockResolvedValue(undefined);

    await reloadOpenRedditTabs();

    expect(browserMocks.query).toHaveBeenCalledWith({ url: [...REDDIT_REQUIRED_ORIGINS] });
    expect(browserMocks.reload).toHaveBeenCalledTimes(2);
    expect(browserMocks.reload).toHaveBeenNthCalledWith(1, 11);
    expect(browserMocks.reload).toHaveBeenNthCalledWith(2, 12);
  });
});
