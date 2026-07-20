import { AppError } from '@/src/core/domain/errors';
import type { MediaVariant, ResolvedMedia } from '@/src/core/domain/media';
import type { PreferredQuality } from '@/src/core/infrastructure/settingsRepository';

export interface VariantSelection {
  variant: MediaVariant;
  warning?: string;
}

export function selectVariant(
  media: ResolvedMedia,
  preferredQuality: PreferredQuality,
): VariantSelection {
  const nonSilentMp4 = media.variants.filter(
    (variant) => variant.container === 'mp4' && !variant.isSilentVariant,
  );
  const qualityOrder: MediaVariant['quality'][] =
    preferredQuality === 'sd'
      ? ['sd', 'hd', 'original', 'unknown']
      : ['hd', 'sd', 'original', 'unknown'];

  const ranked = [...nonSilentMp4].sort((left, right) => {
    const audioRank = rankAudio(left.hasAudio) - rankAudio(right.hasAudio);
    if (audioRank !== 0) return audioRank;
    return (
      qualityOrder.indexOf(left.quality ?? 'unknown') -
      qualityOrder.indexOf(right.quality ?? 'unknown')
    );
  });

  const variant = ranked[0];
  if (!variant) {
    throw new AppError(
      'NO_DOWNLOADABLE_VARIANT',
      'No non-silent MP4 download is available for this media.',
    );
  }

  if (variant.hasAudio === false) {
    return { variant, warning: 'The source reports that this video has no audio.' };
  }
  return { variant };
}

function rankAudio(hasAudio: MediaVariant['hasAudio']): number {
  if (hasAudio === true) return 0;
  if (hasAudio === 'unknown') return 1;
  return 2;
}
