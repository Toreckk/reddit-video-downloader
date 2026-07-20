import { AppError } from '@/src/core/domain/errors';

export interface RedgifsGif {
  id: string;
  creator?: string;
  urls: {
    hd?: string;
    sd?: string;
    silent?: string;
  };
  hasAudio: boolean | 'unknown';
  width?: number;
  height?: number;
  duration?: number;
  hls?: boolean;
}

export function parseTokenResponse(value: unknown): string {
  const record = asRecord(value);
  if (!record || typeof record.token !== 'string' || !record.token) {
    throw invalidResponse('Redgifs returned an invalid temporary token response.');
  }
  return record.token;
}

export function parseGifResponse(value: unknown): RedgifsGif {
  const root = asRecord(value);
  const gif = asRecord(root?.gif);
  const user = asRecord(root?.user);
  const urls = asRecord(gif?.urls);
  if (!gif || typeof gif.id !== 'string' || !urls) {
    throw invalidResponse('Redgifs returned invalid media metadata.');
  }

  const parsedUrls = {
    ...optionalUrl('hd', urls.hd),
    ...optionalUrl('sd', urls.sd),
    ...optionalUrl('silent', urls.silent),
  };
  if (!parsedUrls.hd && !parsedUrls.sd && !parsedUrls.silent) {
    throw invalidResponse('Redgifs metadata did not contain a downloadable media URL.');
  }

  const result: RedgifsGif = {
    id: gif.id,
    urls: parsedUrls,
    hasAudio: typeof gif.hasAudio === 'boolean' ? gif.hasAudio : 'unknown',
  };
  const displayName = parseOptionalString(user?.name, 'uploader display name');
  const accountHandle = parseOptionalString(
    gif.userName ?? gif.username ?? user?.username,
    'uploader username',
  );
  const creator = displayName || accountHandle;
  if (creator) result.creator = creator;
  assignOptionalNumber(result, 'width', gif.width);
  assignOptionalNumber(result, 'height', gif.height);
  assignOptionalNumber(result, 'duration', gif.duration);
  if (typeof gif.hls === 'boolean') result.hls = gif.hls;
  return result;
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw invalidResponse(`Redgifs ${fieldName} has an invalid type.`);
  }
  return value.trim() || undefined;
}

function optionalUrl(key: 'hd' | 'sd' | 'silent', value: unknown): Partial<RedgifsGif['urls']> {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') throw invalidResponse(`Redgifs ${key} URL has an invalid type.`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('Non-HTTPS URL');
  } catch {
    throw invalidResponse(`Redgifs ${key} URL is invalid.`);
  }
  return { [key]: value };
}

function assignOptionalNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: unknown,
): void {
  if (typeof value === 'number' && Number.isFinite(value)) target[key] = value as T[K];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function invalidResponse(message: string): AppError {
  return new AppError('INVALID_PROVIDER_RESPONSE', message);
}
