import { browser } from 'wxt/browser';
import type { SerializableError } from '@/src/core/domain/errors';
import type { DetectedMediaItem } from '@/src/core/domain/media';
import type {
  DismissDetectedItemsMessage,
  DismissDetectedItemsResponse,
  ResolveAndDownloadMessage,
  ResolveAndDownloadResponse,
  ScanActivePageMessage,
  ScanActivePageResponse,
} from '@/src/core/domain/messages';
import { SettingsRepository } from '@/src/core/infrastructure/settingsRepository';
import {
  containsRequiredHostPermissions,
  reloadOpenRedditTabs,
  requestRequiredHostPermissions,
} from '@/src/core/infrastructure/hostPermissions';
import { MediaListView } from './mediaList';

export class PopupController {
  private readonly mediaList: MediaListView;
  private readonly activeItems = new Set<string>();
  private readonly settings = new SettingsRepository();
  private activeTabId?: number;

  constructor(
    private readonly status: HTMLElement,
    list: HTMLUListElement,
    private readonly refreshButton: HTMLButtonElement,
    private readonly optionsButton: HTMLButtonElement,
    private readonly searchInput: HTMLInputElement,
    private readonly clearButton: HTMLButtonElement,
    private readonly enableAccessButton: HTMLButtonElement,
  ) {
    this.mediaList = new MediaListView(list);
  }

  init(): void {
    this.enableAccessButton.addEventListener('click', () => {
      // Calling request immediately preserves Firefox's user-action privilege.
      const permissionRequest = requestRequiredHostPermissions();
      this.enableAccessButton.disabled = true;
      void this.finishPermissionRequest(permissionRequest);
    });
    this.refreshButton.addEventListener('click', () => void this.scan());
    this.optionsButton.addEventListener('click', () => void browser.runtime.openOptionsPage());
    this.searchInput.addEventListener('input', () => this.applySearch());
    this.clearButton.addEventListener('click', () => void this.clearShown());
    void this.scan();
  }

  async scan(): Promise<void> {
    this.setPageState('scanning', 'Finding supported videos…');
    this.mediaList.clear();
    this.refreshButton.disabled = true;
    this.searchInput.disabled = true;
    this.clearButton.disabled = true;
    try {
      if (!(await containsRequiredHostPermissions())) {
        this.enableAccessButton.hidden = false;
        this.setPageState(
          'permission',
          'One-time site access is required before Reddit buttons and provider downloads can work.',
        );
        return;
      }
      this.enableAccessButton.hidden = true;
      const settings = await this.settings.get();
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('No active browser tab was found.');
      this.activeTabId = tab.id;
      const message: ScanActivePageMessage = {
        version: 1,
        type: 'scan-active-page',
        requestId: crypto.randomUUID(),
        detectionMode: settings.detectionMode,
      };
      const response: ScanActivePageResponse = await browser.tabs.sendMessage(tab.id, message);
      if (!response?.ok) {
        this.setPageState('error', response?.error.message ?? 'The page could not be scanned.');
        return;
      }
      if (response.value.items.length === 0) {
        this.setPageState(
          'empty',
          settings.detectionMode === 'opened'
            ? 'No opened supported embeds were found. Expand a video in Reddit, then Refresh.'
            : 'No supported videos are loaded on this page.',
        );
        return;
      }

      this.mediaList.render(response.value.items, (item) => void this.download(item));
      this.searchInput.disabled = false;
      this.applySearch();
      requestAnimationFrame(() => this.mediaList.focusFirstDownload());
    } catch (error) {
      this.setPageState('error', scanErrorMessage(error));
    } finally {
      this.refreshButton.disabled = false;
    }
  }

  private async finishPermissionRequest(permissionRequest: Promise<boolean>): Promise<void> {
    try {
      const granted = await permissionRequest;
      if (!granted) {
        this.setPageState(
          'error',
          'Site access was not granted. Click Enable access to try again.',
        );
        return;
      }
      this.setPageState('ready', 'Access enabled. Reloading Reddit…');
      await reloadOpenRedditTabs();
      window.close();
    } catch (error) {
      this.setPageState(
        'error',
        error instanceof Error ? error.message : 'Firefox could not update the site permissions.',
      );
    } finally {
      this.enableAccessButton.disabled = false;
    }
  }

  private applySearch(): void {
    const visible = this.mediaList.filter(this.searchInput.value);
    this.clearButton.disabled = visible.length === 0;
    if (this.mediaList.size === 0) return;
    if (visible.length === 0) {
      this.setPageState('ready', 'No videos match your search.');
      return;
    }
    const totalSuffix = visible.length === this.mediaList.size ? '' : ` of ${this.mediaList.size}`;
    this.setPageState(
      'ready',
      `${visible.length}${totalSuffix} supported video${visible.length === 1 ? '' : 's'}`,
    );
  }

  private async clearShown(): Promise<void> {
    if (this.activeTabId === undefined) return;
    const visibleItems = this.mediaList.filter(this.searchInput.value);
    if (visibleItems.length === 0) return;
    this.clearButton.disabled = true;
    const message: DismissDetectedItemsMessage = {
      version: 1,
      type: 'dismiss-detected-items',
      requestId: crypto.randomUUID(),
      itemIds: visibleItems.map((item) => item.itemId),
    };
    try {
      const response: DismissDetectedItemsResponse = await browser.tabs.sendMessage(
        this.activeTabId,
        message,
      );
      if (!response.ok) throw new Error(response.error.message);
      this.mediaList.remove(message.itemIds);
      if (this.mediaList.size === 0) {
        this.setPageState('empty', 'Cleared from this tab. Reload Reddit to restore the list.');
        this.searchInput.disabled = true;
        return;
      }
      this.applySearch();
    } catch (error) {
      this.setPageState(
        'error',
        error instanceof Error ? error.message : 'The shown videos could not be cleared.',
      );
      this.clearButton.disabled = false;
    }
  }

  private async download(item: DetectedMediaItem): Promise<void> {
    if (this.activeItems.has(item.itemId)) return;
    this.activeItems.add(item.itemId);
    this.mediaList.update(item.itemId, { kind: 'resolving' });
    try {
      const message: ResolveAndDownloadMessage = {
        version: 1,
        type: 'resolve-and-download',
        requestId: crypto.randomUUID(),
        reference: item.reference,
        post: item.post,
      };
      const response: ResolveAndDownloadResponse = await browser.runtime.sendMessage(message);
      if (!response?.ok) {
        this.mediaList.update(item.itemId, {
          kind: 'error',
          message: response
            ? formatDownloadError(response.error)
            : 'The download could not be started (NO_RESPONSE).',
        });
        return;
      }
      this.mediaList.update(item.itemId, {
        kind: 'started',
        message: response.value.warning ?? 'Download started.',
      });
    } catch (error) {
      this.mediaList.update(item.itemId, {
        kind: 'error',
        message: error instanceof Error ? error.message : 'The download could not be started.',
      });
    } finally {
      this.activeItems.delete(item.itemId);
    }
  }

  private setPageState(state: string, message: string): void {
    document.body.dataset.state = state;
    this.status.textContent = message;
  }
}

function formatDownloadError(error: SerializableError): string {
  const details = error.details ? ` Firefox detail: ${error.details}` : '';
  return `${error.message}${details} [${error.code}]`;
}

function scanErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/receiving end|could not establish connection|message port closed/i.test(message)) {
    return 'Open or reload a Reddit tab, then click Refresh.';
  }
  return message || 'The active page could not be scanned.';
}
