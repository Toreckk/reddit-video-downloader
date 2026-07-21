import { AppError } from '@/src/core/domain/errors';
import type {
  MediaReference,
  MediaVariant,
  ResolvedMedia,
  ResolveContext,
} from '@/src/core/domain/media';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';

interface DashRepresentation {
  id: string;
  url: string;
  bandwidth: number;
  width?: number;
  height?: number;
}

export class VRedditResolver {
  constructor(private readonly http: HttpClient) {}

  async resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia> {
    const manifestUrl = `${reference.sourceUrl}/DASHPlaylist.mpd`;
    const response = await this.http.get(
      manifestUrl,
      context.signal ? { signal: context.signal } : undefined,
    );
    if (response.status === 404) {
      throw new AppError('MEDIA_NOT_FOUND', 'This Reddit video is no longer available.');
    }
    if (!response.ok) {
      throw new AppError('NETWORK_ERROR', 'Reddit could not provide the video manifest.', {
        cause: new Error(`HTTP ${response.status}`),
      });
    }

    let body: string;
    try {
      body = await response.text();
    } catch (error) {
      throw invalidManifest(error);
    }

    const parsed = parseDashManifest(body, manifestUrl, reference.canonicalId);
    if (parsed.video.length === 0) {
      throw new AppError(
        'NO_DOWNLOADABLE_VARIANT',
        'The Reddit manifest did not contain a downloadable MP4 video.',
      );
    }

    const audio = parsed.audio.sort(compareRepresentation)[0];
    const variants = parsed.video
      .sort(compareRepresentation)
      .map((video) => createVariant(video, audio));
    const resolved: ResolvedMedia = {
      reference,
      variants,
      metadata: {
        manifestUrl,
        hasSeparateAudio: Boolean(audio),
      },
    };
    if (parsed.durationSeconds !== undefined) resolved.durationSeconds = parsed.durationSeconds;
    return resolved;
  }
}

export function parseDashManifest(
  xml: string,
  manifestUrl: string,
  canonicalId: string,
): { video: DashRepresentation[]; audio: DashRepresentation[]; durationSeconds?: number } {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'MPD') {
    throw invalidManifest();
  }

  const video: DashRepresentation[] = [];
  const audio: DashRepresentation[] = [];
  for (const element of Array.from(document.getElementsByTagName('Representation'))) {
    const parent = element.parentElement;
    const contentType = representationType(element, parent);
    if (!contentType) continue;
    const rawBaseUrl = element.getElementsByTagName('BaseURL')[0]?.textContent?.trim();
    if (!rawBaseUrl) continue;
    const url = safeMediaUrl(rawBaseUrl, manifestUrl, canonicalId);
    if (!url || !url.pathname.toLowerCase().endsWith('.mp4')) continue;

    const representation: DashRepresentation = {
      id: element.getAttribute('id')?.trim() || rawBaseUrl,
      url: url.href,
      bandwidth: numericAttribute(element, 'bandwidth') ?? 0,
    };
    const width = numericAttribute(element, 'width');
    const height = numericAttribute(element, 'height');
    if (width !== undefined) representation.width = width;
    if (height !== undefined) representation.height = height;
    (contentType === 'video' ? video : audio).push(representation);
  }

  const result: {
    video: DashRepresentation[];
    audio: DashRepresentation[];
    durationSeconds?: number;
  } = {
    video,
    audio,
  };
  const durationSeconds = parseIsoDuration(
    document.documentElement.getAttribute('mediaPresentationDuration'),
  );
  if (durationSeconds !== undefined) result.durationSeconds = durationSeconds;
  return result;
}

function createVariant(
  video: DashRepresentation,
  audio: DashRepresentation | undefined,
): MediaVariant {
  const asset: MediaVariant['asset'] = audio
    ? { kind: 'separate-mp4-tracks', videoUrl: video.url, audioUrl: audio.url }
    : { kind: 'direct', url: video.url };
  const variant: MediaVariant = {
    id: video.id,
    asset,
    container: 'mp4',
    quality: video.height !== undefined && video.height <= 480 ? 'sd' : 'hd',
    hasAudio: Boolean(audio),
    isSilentVariant: false,
  };
  if (video.width !== undefined) variant.width = video.width;
  if (video.height !== undefined) variant.height = video.height;
  return variant;
}

function representationType(
  element: Element,
  parent: Element | null,
): 'video' | 'audio' | undefined {
  const contentType =
    element.getAttribute('contentType') ??
    element.getAttribute('mimeType') ??
    parent?.getAttribute('contentType') ??
    parent?.getAttribute('mimeType') ??
    element.getAttribute('codecs') ??
    parent?.getAttribute('codecs') ??
    '';
  const normalized = contentType.toLowerCase();
  if (normalized.includes('video') || /(?:avc|h26[45]|vp0?9|av01)/.test(normalized)) return 'video';
  if (normalized.includes('audio') || /(?:mp4a|aac|opus)/.test(normalized)) return 'audio';
  return undefined;
}

function safeMediaUrl(raw: string, manifestUrl: string, canonicalId: string): URL | undefined {
  try {
    const url = new URL(raw, manifestUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'v.redd.it') return undefined;
    if (!url.pathname.toLowerCase().startsWith(`/${canonicalId.toLowerCase()}/`)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function numericAttribute(element: Element, name: string): number | undefined {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function compareRepresentation(left: DashRepresentation, right: DashRepresentation): number {
  const leftPixels = (left.width ?? 0) * (left.height ?? 0);
  const rightPixels = (right.width ?? 0) * (right.height ?? 0);
  return rightPixels - leftPixels || right.bandwidth - left.bandwidth;
}

function parseIsoDuration(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(value);
  if (!match) return undefined;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function invalidManifest(cause?: unknown): AppError {
  return new AppError('INVALID_PROVIDER_RESPONSE', 'Reddit returned a malformed video manifest.', {
    cause,
  });
}
