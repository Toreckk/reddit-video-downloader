import { AppError } from '@/src/core/domain/errors';
import type {
  MediaReference,
  MediaVariant,
  ResolvedMedia,
  ResolveContext,
} from '@/src/core/domain/media';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { redgifsHttpError } from './errors';
import { parseGifResponse, type RedgifsGif } from './schema';
import type { RedgifsTokenManager } from './tokenManager';

const API_BASE = 'https://api.redgifs.com/v2/gifs/';

export class RedgifsResolver {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: RedgifsTokenManager,
  ) {}

  async resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia> {
    let token = await this.tokens.getToken(context.signal);
    let response = await this.fetchMetadata(reference.canonicalId, token, context.signal);
    if (response.status === 401) {
      this.tokens.invalidate();
      token = await this.tokens.getToken(context.signal);
      response = await this.fetchMetadata(reference.canonicalId, token, context.signal);
    }
    if (!response.ok) throw redgifsHttpError(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new AppError('INVALID_PROVIDER_RESPONSE', 'Redgifs returned malformed media data.', {
        cause: error,
      });
    }
    const gif = parseGifResponse(body);
    return normalizeGif(reference, gif);
  }

  private fetchMetadata(id: string, token: string, signal?: AbortSignal) {
    const options: { headers: Record<string, string>; signal?: AbortSignal } = {
      headers: { Authorization: `Bearer ${token}` },
    };
    if (signal) options.signal = signal;
    return this.http.get(`${API_BASE}${encodeURIComponent(id)}`, options);
  }
}

function normalizeGif(reference: MediaReference, gif: RedgifsGif): ResolvedMedia {
  const variants: MediaVariant[] = [];
  if (gif.urls.hd) variants.push(createVariant('hd', gif.urls.hd, gif, false));
  if (gif.urls.sd) variants.push(createVariant('sd', gif.urls.sd, gif, false));
  if (gif.urls.silent) variants.push(createVariant('silent', gif.urls.silent, gif, true));

  const metadata: Record<string, unknown> = {
    providerMediaId: gif.id,
    hasAudio: gif.hasAudio,
  };
  if (gif.hls !== undefined) metadata.hls = gif.hls;

  const resolved: ResolvedMedia = { reference, variants, metadata };
  if (gif.creator !== undefined) resolved.creator = gif.creator;
  if (gif.duration !== undefined) resolved.durationSeconds = gif.duration;
  return resolved;
}

function createVariant(
  id: 'hd' | 'sd' | 'silent',
  url: string,
  gif: RedgifsGif,
  silent: boolean,
): MediaVariant {
  const variant: MediaVariant = {
    id,
    url,
    container: 'mp4',
    quality: id === 'silent' ? 'unknown' : id,
    hasAudio: silent ? false : gif.hasAudio,
    isSilentVariant: silent,
  };
  if (gif.width !== undefined) variant.width = gif.width;
  if (gif.height !== undefined) variant.height = gif.height;
  return variant;
}
