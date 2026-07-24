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
  busy: boolean;
  toast?: HTMLElement;
  toastTimer?: number;
}

const ERROR_TOAST_DURATION_MS = 8000;
const WARNING_TOAST_DURATION_MS = 6000;

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
    for (const action of this.actions.values()) {
      dismissToast(action);
      action.wrapper.remove();
    }
    this.actions.clear();
    document.getElementById('rmd-toast-region')?.remove();
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
      dismissToast(action);
      action.wrapper.remove();
      this.actions.delete(post);
    }
  }

  private ensureAction(context: PostContext, mount: HTMLElement, item: DetectedMediaItem): void {
    const existing = this.actions.get(context.postElement);
    if (existing) {
      existing.item = item;
      placeAction(mount, existing.wrapper);
      return;
    }

    const wrapper = document.createElement(mount.tagName === 'UL' ? 'li' : 'span');
    wrapper.className = `rmd-inline-action rmd-inline-action--${context.surfaceId}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rmd-inline-download';
    button.textContent = 'download';
    button.title = `Download this ${item.providerLabel} video`;
    wrapper.append(button);
    placeAction(mount, wrapper);

    const action: InlineAction = { item, wrapper, button, busy: false };
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
    dismissToast(action);
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
        const errorMessage = formatDownloadError(error);
        action.button.textContent = 'retry';
        action.button.title = errorMessage;
        showToast(action, errorMessage, 'error');
        return;
      }
      action.button.textContent = 'downloaded';
      action.button.title = response.value.warning ?? 'Download started.';
      if (response.value.warning) showToast(action, response.value.warning, 'warning');
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
      showToast(action, message, 'error');
    } finally {
      action.busy = false;
      if (action.button.textContent !== 'downloaded') action.button.disabled = false;
    }
  }
}

function placeAction(mount: HTMLElement, wrapper: HTMLElement): void {
  const combinedLink = mount.querySelector<HTMLElement>(
    'a.noCtrlF[data-text="[l+c]"], a.noCtrlF[data-text="[l=c]"]',
  );
  if (combinedLink) {
    let reference = combinedLink;
    while (reference.parentElement && reference.parentElement !== mount) {
      reference = reference.parentElement;
    }
    if (reference.parentElement === mount) {
      if (reference.nextElementSibling !== wrapper) reference.after(wrapper);
      return;
    }
  }

  if (wrapper.parentElement !== mount || wrapper !== mount.lastElementChild) mount.append(wrapper);
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
    #rmd-toast-region { bottom: 1rem; display: grid; gap: 0.5rem; max-width: min(26rem, calc(100vw - 2rem)); pointer-events: none; position: fixed; right: 1rem; width: max-content; z-index: 2147483647; }
    .rmd-toast { align-items: start; background: #fff; border: 1px solid #8c8c8c; border-left: 4px solid #b85c00; border-radius: 4px; box-shadow: 0 3px 12px rgb(0 0 0 / 28%); color: #1a1a1b; display: grid; font: 13px/1.4 Arial, sans-serif; gap: 0.75rem; grid-template-columns: minmax(0, 1fr) auto; padding: 0.7rem 0.8rem; pointer-events: auto; }
    .rmd-toast--error { border-left-color: #d93900; }
    .rmd-toast-message { overflow-wrap: anywhere; }
    .rmd-toast-close { appearance: none; background: transparent; border: 0; color: inherit; cursor: pointer; font: 700 18px/1 Arial, sans-serif; margin: -0.15rem -0.2rem 0 0; padding: 0.1rem 0.2rem; }
    .rmd-toast-close:focus-visible { outline: 2px solid #005ea8; outline-offset: 2px; }
    @media (prefers-color-scheme: dark) { .rmd-toast { background: #272729; border-color: #6f7072; color: #f2f2f2; } }
  `;
  document.documentElement.append(style);
}

function showToast(action: InlineAction, message: string, tone: 'error' | 'warning'): void {
  dismissToast(action);
  const region = getToastRegion();
  const toast = document.createElement('div');
  toast.className = `rmd-toast rmd-toast--${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.className = 'rmd-toast-message';
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rmd-toast-close';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.textContent = '×';
  close.addEventListener('click', () => dismissToast(action));
  toast.append(text, close);
  region.append(toast);
  action.toast = toast;
  action.toastTimer = window.setTimeout(
    () => dismissToast(action),
    tone === 'error' ? ERROR_TOAST_DURATION_MS : WARNING_TOAST_DURATION_MS,
  );
}

function dismissToast(action: InlineAction): void {
  if (action.toastTimer !== undefined) window.clearTimeout(action.toastTimer);
  action.toast?.remove();
  delete action.toast;
  delete action.toastTimer;
}

function getToastRegion(): HTMLElement {
  const existing = document.getElementById('rmd-toast-region');
  if (existing) return existing;
  const region = document.createElement('div');
  region.id = 'rmd-toast-region';
  region.setAttribute('aria-label', 'Download notifications');
  document.documentElement.append(region);
  return region;
}

function formatDownloadError(error: SerializableError): string {
  const details = error.details ? ` Detail: ${error.details}` : '';
  return `${error.message}${details} [${error.code}]`;
}
