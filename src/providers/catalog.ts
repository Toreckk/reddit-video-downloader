import { ProviderRegistry } from '@/src/core/application/providerRegistry';
import {
  ExtensionHttpClient,
  type HttpClient,
} from '@/src/core/infrastructure/extensionHttpClient';
import { RedgifsProvider } from './redgifs';

export function createProviderRegistry(
  http: HttpClient = new ExtensionHttpClient(),
): ProviderRegistry {
  return new ProviderRegistry([new RedgifsProvider(http)]);
}
