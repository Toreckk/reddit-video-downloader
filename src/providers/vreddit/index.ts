import type {
  MediaProvider,
  MediaReference,
  ResolvedMedia,
  ResolveContext,
} from '@/src/core/domain/media';
import type { HttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { matchVRedditUrl } from './match';
import { VRedditResolver } from './resolver';

export const VREDDIT_REQUIRED_ORIGINS = ['https://v.redd.it/*'] as const;

export class VRedditProvider implements MediaProvider {
  readonly id = 'vreddit';
  readonly label = 'Reddit';
  readonly requiredOrigins = [...VREDDIT_REQUIRED_ORIGINS];
  private readonly resolver: VRedditResolver;

  constructor(http: HttpClient) {
    this.resolver = new VRedditResolver(http);
  }

  match(url: URL): MediaReference | null {
    return matchVRedditUrl(url);
  }

  resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia> {
    return this.resolver.resolve(reference, context);
  }
}
