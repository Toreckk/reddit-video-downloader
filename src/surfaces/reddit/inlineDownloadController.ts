import { browser } from 'wxt/browser';
import type { ProviderRegistry } from '@/src/core/application/providerRegistry';
import type { SerializableError } from '@/src/core/domain/errors';
import type { DetectedMediaItem } from '@/src/core/domain/media';
import type {
  ResolveAndDownloadMessage,
  ResolveAndDownloadResponse,
} from '@/src/core/domain/messages';
import { detectMediaItems } from './scanActivePage';
import type { PostContext, SiteSurfaceAdapter } from './types';

interface InlineAction {
  item: DetectedMediaItem;
  wrapper: HTMLElement;
  button: HTMLButtonElement;
  status: HTMLElement;
  busy: boolean;
}

export class InlineDownloadController {
  private readonly actions = new Map<HTMLElement, InlineAction>();
  private observer?: MutationObserver;
  private syncQueued = false;

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly adapters: readonly SiteSurfaceAdapter[],
  ) {}

  start(): void {
    installStyles();
    this.sync();
    this.observer = new MutationObserver(() => this.queueSync());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    for (const action of this.actions.values()) action.wrapper.remove();
    this.actions.clear();
  }

  private queueSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    requestAnimationFrame(() => {
      this.syncQueued = false;
      this.sync();
    });
  }

  private sync(): void {
    const matchingAdapters = this.adapters.filter((adapter) => adapter.matchesPage(location));
    const contexts = matchingAdapters.flatMap((adapter) => adapter.discover(document));
    const items = detectMediaItems(contexts, this.registry, 'all');
    const firstItemByPost = new Map<string, DetectedMediaItem>();
    for (const item of items) {
      if (!firstItemByPost.has(item.post.postId)) firstItemByPost.set(item.post.postId, item);
    }

    const activePosts = new Set<HTMLElement>();
    for (const context of contexts) {
      const item = firstItemByPost.get(context.postId);
      if (!item) continue;
      const mount = findActionMount(context);
      if (!mount) continue;
      activePosts.add(context.postElement);
      this.ensureAction(context, mount, item);
    }

    for (const [post, action] of this.actions) {
      if (post.isConnected && activePosts.has(post)) continue;
      action.wrapper.remove();
      this.actions.delete(post);
    }
  }

  private ensureAction(context: PostContext, mount: HTMLElement, item: DetectedMediaItem): void {
    const existing = this.actions.get(context.postElement);
    if (existing) {
      existing.item = item;
      if (!existing.wrapper.isConnected) mount.append(existing.wrapper);
      return;
    }

    const wrapper = document.createElement(mount.tagName === 'UL' ? 'li' : 'span');
    wrapper.className = `rmd-inline-action rmd-inline-action--${context.surfaceId}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rmd-inline-download';
    button.textContent = 'download';
    button.title = `Download this ${item.providerLabel} video`;
    const status = document.createElement('span');
    status.className = 'rmd-inline-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    wrapper.append(button, status);
    mount.append(wrapper);

    const action: InlineAction = { item, wrapper, button, status, busy: false };
    this.actions.set(context.postElement, action);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.download(action);
    });
  }

  private async download(action: InlineAction): Promise<void> {
    if (action.busy) return;
    action.busy = true;
    action.button.disabled = true;
    action.button.textContent = 'preparing…';
    action.status.textContent = '';
    const message: ResolveAndDownloadMessage = {
      version: 1,
      type: 'resolve-and-download',
      requestId: crypto.randomUUID(),
      reference: action.item.reference,
      post: action.item.post,
    };

    try {
      const response: ResolveAndDownloadResponse = await browser.runtime.sendMessage(message);
      if (!response?.ok) {
        const error = response?.error ?? {
          code: 'UNKNOWN_ERROR' as const,
          message: 'The extension did not respond.',
        };
        action.button.textContent = 'retry';
        action.button.title = formatDownloadError(error);
        action.status.textContent = formatDownloadError(error);
        return;
      }
      action.button.textContent = 'downloaded';
      action.button.title = response.value.warning ?? 'Download started.';
      action.status.textContent = response.value.warning ?? '';
      window.setTimeout(() => {
        if (!action.wrapper.isConnected) return;
        action.button.textContent = 'download';
        action.button.title = `Download this ${action.item.providerLabel} video`;
        action.button.disabled = false;
      }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The download could not be started.';
      action.button.textContent = 'retry';
      action.button.title = message;
      action.status.textContent = message;
    } finally {
      action.busy = false;
      if (action.button.textContent !== 'downloaded') action.button.disabled = false;
    }
  }
}

function findActionMount(context: PostContext): HTMLElement | null {
  const post = context.postElement;
  if (context.surfaceId === 'reddit-old') {
    if (post.matches('.search-result.search-result-link')) {
      return (
        post.querySelector<HTMLElement>('.search-result-meta') ??
        post.querySelector<HTMLElement>('a.search-link')?.parentElement ??
        post
      );
    }
    return (
      post.querySelector<HTMLElement>('ul.flat-list.buttons, .flat-list.buttons, ul.buttons') ??
      post.querySelector<HTMLElement>('.entry')
    );
  }

  const direct = post.querySelector<HTMLElement>(
    '[data-testid="post-actions"], [slot="actionRow"]',
  );
  if (direct) return direct;
  const share = post.querySelector<HTMLElement>(
    'shreddit-post-share-button, [data-post-click-location="share"], button[aria-label*="Share" i]',
  );
  if (share?.parentElement) return share.parentElement;
  const overflow = post.querySelector<HTMLElement>('shreddit-post-overflow-menu');
  return overflow?.parentElement ?? post;
}

function installStyles(): void {
  if (document.getElementById('rmd-inline-styles')) return;
  const style = document.createElement('style');
  style.id = 'rmd-inline-styles';
  style.textContent = `
    .rmd-inline-action { display: inline-flex; align-items: center; gap: 0.4rem; margin-left: 0.4rem; }
    .rmd-inline-action--reddit-current { padding: 0.25rem 0; }
    .rmd-inline-download { background: #005ea8; border: 1px solid #8bcfff; border-radius: 3px; color: #fff !important; cursor: pointer; font: inherit; font-weight: 600; line-height: 1.35; padding: 1px 5px; }
    .rmd-inline-download:hover:not(:disabled) { background: #00477f; border-color: #fff; text-decoration: none; }
    .rmd-inline-download:focus-visible { outline: 2px solid #ffbf47; outline-offset: 2px; }
    .rmd-inline-download:disabled { background: #465d6f; cursor: wait; opacity: 0.8; }
    .rmd-inline-status { color: #d93900; font-size: 0.9em; max-width: 32rem; }
    .rmd-inline-status:empty { display: none; }
  `;
  document.documentElement.append(style);
}

function formatDownloadError(error: SerializableError): string {
  const details = error.details ? ` Detail: ${error.details}` : '';
  return `${error.message}${details} [${error.code}]`;
}
