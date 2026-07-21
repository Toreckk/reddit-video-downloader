import { describe, expect, it, vi } from 'vitest';
import { ProviderRegistry } from '@/src/core/application/providerRegistry';
import { ResolveAndDownload } from '@/src/core/application/resolveAndDownload';
import type { MediaProvider } from '@/src/core/domain/media';
import type { DownloadGateway } from '@/src/core/infrastructure/browserDownloadGateway';
import {
  DEFAULT_SETTINGS,
  type SettingsReader,
} from '@/src/core/infrastructure/settingsRepository';

const reference = {
  providerId: 'fixture',
  canonicalId: 'clip',
  sourceUrl: 'https://provider.test/watch/clip',
};

describe('ResolveAndDownload', () => {
  it('coordinates provider, policy, filename, settings, and downloads without provider-specific branches', async () => {
    const provider: MediaProvider = {
      id: 'fixture',
      label: 'Fixture',
      requiredOrigins: [],
      match: () => reference,
      resolve: async () => ({
        reference,
        creator: 'provider_artist',
        variants: [
          {
            id: 'hd',
            asset: { kind: 'direct', url: 'https://cdn.test/clip.mp4' },
            container: 'mp4',
            quality: 'hd',
            hasAudio: true,
            isSilentVariant: false,
          },
        ],
        metadata: {},
      }),
    };
    const settings: SettingsReader = { get: async () => ({ ...DEFAULT_SETTINGS }) };
    const start = vi.fn(async () => 42);
    const downloads: DownloadGateway = { start };
    const assets = {
      prepare: vi.fn(async () => ({ kind: 'url' as const, url: 'https://cdn.test/clip.mp4' })),
    };
    const result = await new ResolveAndDownload(
      new ProviderRegistry([provider]),
      settings,
      assets,
      downloads,
    ).execute({ reference, post: { postId: 't3_1', creator: 'alice', title: 'Great clip' } });

    expect(result).toEqual({ downloadId: 42, filename: 'provider_artist - Great clip.mp4' });
    expect(start).toHaveBeenCalledWith({
      source: { kind: 'url', url: 'https://cdn.test/clip.mp4' },
      filename: 'provider_artist - Great clip.mp4',
      saveAs: true,
    });
  });

  it('sanitizes the source display name only when creating the download filename', async () => {
    const provider: MediaProvider = {
      id: 'fixture',
      label: 'Fixture',
      requiredOrigins: [],
      match: () => reference,
      resolve: async () => ({
        reference,
        creator: 'Trev💦',
        variants: [
          {
            id: 'hd',
            asset: { kind: 'direct', url: 'https://cdn.test/clip.mp4' },
            container: 'mp4',
            quality: 'hd',
            hasAudio: true,
            isSilentVariant: false,
          },
        ],
        metadata: {},
      }),
    };
    const settings: SettingsReader = { get: async () => ({ ...DEFAULT_SETTINGS }) };
    const start = vi.fn(async () => 43);

    const assets = {
      prepare: async () => ({ kind: 'url' as const, url: 'https://cdn.test/clip.mp4' }),
    };
    await new ResolveAndDownload(new ProviderRegistry([provider]), settings, assets, {
      start,
    }).execute({
      reference,
      post: { postId: 't3_2', creator: 'Trevv001', title: 'Sample' },
    });

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Trev - Sample.mp4' }));
  });
});
