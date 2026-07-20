import { browser } from 'wxt/browser';
import { normalizeError } from '@/src/core/domain/errors';
import {
  isDismissDetectedItemsMessage,
  isScanActivePageMessage,
  type DismissDetectedItemsResponse,
  type ScanActivePageResponse,
} from '@/src/core/domain/messages';
import { createProviderRegistry } from '@/src/providers/catalog';
import { surfaces } from '@/src/surfaces/catalog';
import { scanActivePage } from '@/src/surfaces/reddit/scanActivePage';

export default defineContentScript({
  matches: ['*://*.reddit.com/*'],
  runAt: 'document_idle',
  main() {
    const registry = createProviderRegistry();
    const dismissedItemIds = new Set<string>();
    let dismissalPageUrl = window.location.href;
    // The returned promise keeps the WebExtension message channel open for the response.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    browser.runtime.onMessage.addListener((message: unknown) => {
      resetDismissalsAfterNavigation();
      if (isScanActivePageMessage(message)) {
        try {
          const value = scanActivePage(
            document,
            window.location,
            registry,
            surfaces,
            message.detectionMode,
          );
          value.items = value.items.filter((item) => !dismissedItemIds.has(item.itemId));
          return Promise.resolve<ScanActivePageResponse>({ ok: true, value });
        } catch (error) {
          return Promise.resolve<ScanActivePageResponse>({
            ok: false,
            error: normalizeError(error),
          });
        }
      }
      if (isDismissDetectedItemsMessage(message)) {
        for (const itemId of message.itemIds) dismissedItemIds.add(itemId);
        return Promise.resolve<DismissDetectedItemsResponse>({
          ok: true,
          value: { dismissedCount: message.itemIds.length },
        });
      }
      return undefined;
    });

    function resetDismissalsAfterNavigation(): void {
      if (dismissalPageUrl === window.location.href) return;
      dismissalPageUrl = window.location.href;
      dismissedItemIds.clear();
    }
  },
});
