import { AppError } from '@/src/core/domain/errors';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { redgifsHttpError } from './errors';
import { parseTokenResponse } from './schema';

const TOKEN_ENDPOINT = 'https://api.redgifs.com/v2/auth/temporary';
const EXPIRY_SAFETY_WINDOW_MS = 30_000;
const FALLBACK_TTL_MS = 10 * 60_000;

interface CachedToken {
  value: string;
  expiresAt: number;
}

export class RedgifsTokenManager {
  private cached: CachedToken | undefined;
  private pending: Promise<string> | undefined;

  constructor(
    private readonly http: HttpClient,
    private readonly now: () => number = Date.now,
  ) {}

  async getToken(signal?: AbortSignal): Promise<string> {
    if (this.cached && this.cached.expiresAt - EXPIRY_SAFETY_WINDOW_MS > this.now()) {
      return this.cached.value;
    }
    if (this.pending) return this.pending;

    const request = this.fetchToken(signal);
    this.pending = request;
    try {
      return await request;
    } finally {
      if (this.pending === request) this.pending = undefined;
    }
  }

  invalidate(): void {
    this.cached = undefined;
  }

  private async fetchToken(signal?: AbortSignal): Promise<string> {
    const response = await this.http.get(TOKEN_ENDPOINT, signal ? { signal } : undefined);
    if (!response.ok) throw redgifsHttpError(response.status);
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new AppError('INVALID_PROVIDER_RESPONSE', 'Redgifs returned malformed token data.', {
        cause: error,
      });
    }
    const token = parseTokenResponse(body);
    this.cached = { value: token, expiresAt: readJwtExpiry(token) ?? this.now() + FALLBACK_TTL_MS };
    return token;
  }
}

function readJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}
