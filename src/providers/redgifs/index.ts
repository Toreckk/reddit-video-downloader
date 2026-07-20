import type {
  MediaProvider,
  MediaReference,
  ResolvedMedia,
  ResolveContext,
} from '@/src/core/domain/media';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { matchRedgifsUrl } from './match';
import { RedgifsResolver } from './resolver';
import { RedgifsTokenManager } from './tokenManager';

export const REDGIFS_REQUIRED_ORIGINS = [
  'https://api.redgifs.com/*',
  'https://*.redgifs.com/*',
] as const;

export class RedgifsProvider implements MediaProvider {
  readonly id = 'redgifs';
  readonly label = 'Redgifs';
  readonly requiredOrigins = [...REDGIFS_REQUIRED_ORIGINS];
  private readonly resolver: RedgifsResolver;

  constructor(http: HttpClient) {
    this.resolver = new RedgifsResolver(http, new RedgifsTokenManager(http));
  }

  match(url: URL): MediaReference | null {
    return matchRedgifsUrl(url);
  }

  resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia> {
    return this.resolver.resolve(reference, context);
  }
}
