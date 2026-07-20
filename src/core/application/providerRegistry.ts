import { AppError } from '@/src/core/domain/errors';
import type { MediaProvider, MediaReference } from '@/src/core/domain/media';

export class ProviderRegistry {
  private readonly byId: ReadonlyMap<string, MediaProvider>;

  constructor(private readonly providers: readonly MediaProvider[]) {
    this.byId = new Map(providers.map((provider) => [provider.id, provider]));
  }

  match(url: URL): { provider: MediaProvider; reference: MediaReference } | null {
    for (const provider of this.providers) {
      const reference = provider.match(url);
      if (reference) return { provider, reference };
    }
    return null;
  }

  get(providerId: string): MediaProvider {
    const provider = this.byId.get(providerId);
    if (!provider) {
      throw new AppError('PROVIDER_NOT_FOUND', `The ${providerId} provider is not available.`);
    }
    return provider;
  }

  list(): readonly MediaProvider[] {
    return this.providers;
  }
}
