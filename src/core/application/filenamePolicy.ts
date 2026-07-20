import type { MediaReference, PostMetadata } from '@/src/core/domain/media';
import { sanitizeFilenamePart, truncateUtf16 } from '@/src/shared/sanitize';

const MAX_STEM_LENGTH = 176;

export interface FilenameContext {
  reference: MediaReference;
  post: PostMetadata;
  sourceCreator?: string;
  template: string;
}

type TemplateFieldName = 'sourceCreator' | 'creator' | 'title' | 'provider' | 'id';
const TEMPLATE_EXPRESSION =
  /\{(sourceCreator|creator|title|provider|id)(?:\|(sourceCreator|creator|title|provider|id))*\}/g;

export function createDownloadFilename(context: FilenameContext): string {
  const creator = normalizeCreator(context.post.creator);
  const sourceCreator = normalizeCreator(context.sourceCreator);
  const title = sanitizeFilenamePart(context.post.title ?? '');
  const provider = sanitizeFilenamePart(context.reference.providerId) || 'media';
  const id = sanitizeFilenamePart(context.reference.canonicalId) || 'unknown';

  const fallbackTitle = `${provider}-${id}`;
  const values: Record<TemplateFieldName, string> = {
    sourceCreator,
    creator,
    title,
    provider,
    id,
  };
  let stem = context.template.replace(TEMPLATE_EXPRESSION, (expression) => {
    const fields = expression.slice(1, -1).split('|') as TemplateFieldName[];
    const value = fields.map((field) => values[field]).find(Boolean);
    if (value) return value;
    return fields.includes('title') ? fallbackTitle : 'unknown';
  });
  stem = sanitizeFilenamePart(stem);

  if (!context.post.title && !context.post.creator && !sourceCreator) stem = fallbackTitle;
  if (!stem) stem = fallbackTitle;
  return `${truncateUtf16(stem, MAX_STEM_LENGTH)}.mp4`;
}

export function normalizeCreator(creator?: string): string {
  if (!creator || creator.trim().toLowerCase() === '[deleted]') return '';
  return sanitizeFilenamePart(creator.trim().replace(/^u\//i, ''));
}
