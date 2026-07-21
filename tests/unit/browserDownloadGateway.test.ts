import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMocks = vi.hoisted(() => ({
  download: vi.fn(),
  getPlatformInfo: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    downloads: {
      download: browserMocks.download,
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      getPlatformInfo: browserMocks.getPlatformInfo,
    },
  },
}));

import { BrowserDownloadGateway } from '@/src/core/infrastructure/browserDownloadGateway';

describe('BrowserDownloadGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserMocks.download.mockResolvedValue(42);
  });

  it('shows the requested file chooser on desktop Firefox', async () => {
    browserMocks.getPlatformInfo.mockResolvedValue({ os: 'win' });

    await expect(
      new BrowserDownloadGateway().start({
        filename: 'video.mp4',
        saveAs: true,
        source: { kind: 'url', url: 'https://media.example/video.mp4' },
      }),
    ).resolves.toBe(42);

    expect(browserMocks.download).toHaveBeenCalledWith({
      url: 'https://media.example/video.mp4',
      filename: 'video.mp4',
      saveAs: true,
      conflictAction: 'uniquify',
    });
  });

  it('disables the unsupported file chooser on Firefox for Android', async () => {
    browserMocks.getPlatformInfo.mockResolvedValue({ os: 'android' });

    await new BrowserDownloadGateway().start({
      filename: 'video.mp4',
      saveAs: true,
      source: { kind: 'url', url: 'https://media.example/video.mp4' },
    });

    expect(browserMocks.download).toHaveBeenCalledWith(expect.objectContaining({ saveAs: false }));
  });
});
