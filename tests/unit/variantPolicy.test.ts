import { describe, expect, it } from 'vitest';
import { selectVariant } from '@/src/core/application/variantPolicy';
import type { ResolvedMedia } from '@/src/core/domain/media';

const reference = {
  providerId: 'redgifs',
  canonicalId: 'example',
  sourceUrl: 'https://www.redgifs.com/watch/example',
};

function media(overrides: Partial<ResolvedMedia> = {}): ResolvedMedia {
  return {
    reference,
    variants: [
      {
        id: 'hd',
        url: 'https://cdn/hd.mp4',
        container: 'mp4',
        quality: 'hd',
        hasAudio: true,
        isSilentVariant: false,
      },
      {
        id: 'sd',
        url: 'https://cdn/sd.mp4',
        container: 'mp4',
        quality: 'sd',
        hasAudio: true,
        isSilentVariant: false,
      },
      {
        id: 'silent',
        url: 'https://cdn/silent.mp4',
        container: 'mp4',
        quality: 'hd',
        hasAudio: false,
        isSilentVariant: true,
      },
    ],
    metadata: {},
    ...overrides,
  };
}

describe('selectVariant', () => {
  it('prefers HD with audio by default and never selects the silent variant', () => {
    expect(selectVariant(media(), 'hd').variant.id).toBe('hd');
  });

  it('honors the SD preference', () => {
    expect(selectVariant(media(), 'sd').variant.id).toBe('sd');
  });

  it('prefers known audio over preferred quality with unknown audio', () => {
    const value = media();
    value.variants[0]!.hasAudio = 'unknown';
    expect(selectVariant(value, 'hd').variant.id).toBe('sd');
  });

  it('warns and uses the best non-silent variant when the source has no audio', () => {
    const value = media({
      variants: [
        {
          id: 'hd',
          url: 'https://cdn/hd.mp4',
          container: 'mp4',
          quality: 'hd',
          hasAudio: false,
          isSilentVariant: false,
        },
      ],
    });
    expect(selectVariant(value, 'hd').warning).toMatch(/no audio/i);
  });

  it('fails instead of substituting an explicit silent variant', () => {
    const value = media({
      variants: [
        {
          id: 'silent',
          url: 'https://cdn/silent.mp4',
          container: 'mp4',
          quality: 'hd',
          hasAudio: false,
          isSilentVariant: true,
        },
      ],
    });
    expect(() => selectVariant(value, 'hd')).toThrow(/non-silent MP4/i);
  });
});
