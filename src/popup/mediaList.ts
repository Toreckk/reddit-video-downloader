import type { DetectedMediaItem } from '@/src/core/domain/media';
import { createMediaListItem, type ItemState, type MediaListItemView } from './mediaListItem';

export class MediaListView {
  private readonly rows = new Map<string, { item: DetectedMediaItem; view: MediaListItemView }>();

  constructor(private readonly element: HTMLUListElement) {}

  render(items: readonly DetectedMediaItem[], onDownload: (item: DetectedMediaItem) => void): void {
    this.element.replaceChildren();
    this.rows.clear();
    for (const item of items) {
      const row = createMediaListItem(item, () => onDownload(item));
      this.rows.set(item.itemId, { item, view: row });
      this.element.append(row.element);
    }
  }

  update(itemId: string, state: ItemState): void {
    this.rows.get(itemId)?.view.update(state);
  }

  filter(query: string): DetectedMediaItem[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visible: DetectedMediaItem[] = [];
    for (const { item, view } of this.rows.values()) {
      const matches = !normalizedQuery || searchableText(item).includes(normalizedQuery);
      view.element.hidden = !matches;
      if (matches) visible.push(item);
    }
    return visible;
  }

  remove(itemIds: readonly string[]): void {
    for (const itemId of itemIds) {
      const row = this.rows.get(itemId);
      row?.view.element.remove();
      this.rows.delete(itemId);
    }
  }

  get size(): number {
    return this.rows.size;
  }

  focusFirstDownload(): void {
    this.element.querySelector<HTMLButtonElement>('.download-button')?.focus();
  }

  clear(): void {
    this.rows.clear();
    this.element.replaceChildren();
  }
}

function searchableText(item: DetectedMediaItem): string {
  return [
    item.post.title,
    item.post.creator,
    item.post.subreddit,
    item.providerLabel,
    item.reference.canonicalId,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase();
}
