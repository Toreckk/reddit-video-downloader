import { browser } from 'wxt/browser';
import { ResolveAndDownload } from '@/src/core/application/resolveAndDownload';
import { isMediaReference, isPostMetadata } from '@/src/core/domain/media';
import { normalizeError, AppError } from '@/src/core/domain/errors';
import type { ResolveAndDownloadResponse } from '@/src/core/domain/messages';
import { BrowserDownloadGateway } from '@/src/core/infrastructure/browserDownloadGateway';
import { ExtensionHttpClient } from '@/src/core/infrastructure/extensionHttpClient';
import { BrowserMediaAssetPreparer } from '@/src/core/infrastructure/mediaAssetPreparer';
import { SettingsRepository } from '@/src/core/infrastructure/settingsRepository';
import {
  containsRequiredHostPermissions,
  openPermissionSetup,
} from '@/src/core/infrastructure/hostPermissions';
import { createProviderRegistry } from '@/src/providers/catalog';

export default defineBackground(() => {
  const settings = new SettingsRepository();
  const http = new ExtensionHttpClient();
  const registry = createProviderRegistry(http);
  const coordinator = new ResolveAndDownload(
    registry,
    settings,
    new BrowserMediaAssetPreparer(http),
    new BrowserDownloadGateway(),
  );

  browser.runtime.onInstalled.addListener(() => {
    void showPermissionSetupWhenNeeded();
  });

  // Firefox supports promise-returning message listeners, despite the event type's void callback shape.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (!message || typeof message !== 'object') return undefined;
    const record = message as Record<string, unknown>;
    if (record.version !== 1 || record.type !== 'resolve-and-download') return undefined;

    let response: ResolveAndDownloadResponse;
    try {
      if (!isMediaReference(record.reference) || !isPostMetadata(record.post)) {
        throw new AppError('INVALID_MESSAGE', 'The download request was invalid.');
      }
      const provider = registry.get(record.reference.providerId);
      const providerAccess = await browser.permissions.contains({
        origins: provider.requiredOrigins,
      });
      if (!providerAccess) {
        throw new AppError(
          'PERMISSION_DENIED',
          'Media provider access is required. Open the extension and choose Enable access.',
        );
      }
      const value = await coordinator.execute({ reference: record.reference, post: record.post });
      response = { ok: true, value };
    } catch (error) {
      response = { ok: false, error: normalizeError(error) };
      const reference = isMediaReference(record.reference) ? record.reference : undefined;
      console.error('[Reddit Media Downloader] Download failed', {
        error,
        normalizedError: response.error,
        provider: reference?.providerId,
        mediaId: reference?.canonicalId,
      });
    }
    return response;
  });
});

async function showPermissionSetupWhenNeeded(): Promise<void> {
  if (!(await containsRequiredHostPermissions())) await openPermissionSetup();
}
