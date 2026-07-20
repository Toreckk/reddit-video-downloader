import type { DetectedMediaItem } from '@/src/core/domain/media';

export type ItemState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'started'; message: string }
  | { kind: 'error'; message: string };

export interface MediaListItemView {
  element: HTMLLIElement;
  update(state: ItemState): void;
}

export function createMediaListItem(
  item: DetectedMediaItem,
  onDownload: () => void,
): MediaListItemView {
  const element = document.createElement('li');
  element.className = 'media-item';

  const providerMark = document.createElement('div');
  providerMark.className = 'provider-mark';
  providerMark.textContent = item.providerLabel.slice(0, 1).toUpperCase();
  providerMark.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'media-content';
  const title = document.createElement('div');
  title.className = 'media-title';
  title.textContent = item.post.title || `${item.providerLabel} video`;

  const metadata = document.createElement('div');
  metadata.className = 'media-metadata';
  metadata.textContent = createMetadata(item);

  const status = document.createElement('div');
  status.className = 'item-status';
  status.setAttribute('aria-live', 'polite');

  const button = document.createElement('button');
  button.className = 'download-button';
  button.type = 'button';
  button.textContent = 'Download';
  button.addEventListener('click', onDownload);

  content.append(title, metadata, status);
  element.append(providerMark, content, button);

  return {
    element,
    update(state) {
      element.dataset.state = state.kind;
      status.className = `item-status ${state.kind === 'error' ? 'error' : ''}`;
      if (state.kind === 'idle') {
        button.disabled = false;
        button.textContent = 'Download';
        status.textContent = '';
      } else if (state.kind === 'resolving') {
        button.disabled = true;
        button.textContent = 'Resolving…';
        status.textContent = 'Finding the best available MP4…';
      } else if (state.kind === 'started') {
        button.disabled = false;
        button.textContent = 'Download again';
        status.textContent = state.message;
      } else {
        button.disabled = false;
        button.textContent = 'Retry';
        status.textContent = state.message;
      }
    },
  };
}

function createMetadata(item: DetectedMediaItem): string {
  const metadata: string[] = [];
  if (item.post.creator) metadata.push(`u/${item.post.creator.replace(/^u\//i, '')}`);
  if (item.post.subreddit) metadata.push(`r/${item.post.subreddit.replace(/^r\//i, '')}`);
  metadata.push(item.providerLabel);
  return metadata.join(' · ');
}
