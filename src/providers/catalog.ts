import { ProviderRegistry } from '@/src/core/application/providerRegistry';
import {
  ExtensionHttpClient,
  type HttpClient,
} from '@/src/core/infrastructure/extensionHttpClient';
import { RedgifsProvider } from './redgifs';
import { VRedditProvider } from './vreddit';

export function createProviderRegistry(
  http: HttpClient = new ExtensionHttpClient(),
): ProviderRegistry {
  return new ProviderRegistry([new RedgifsProvider(http), new VRedditProvider(http)]);
}
