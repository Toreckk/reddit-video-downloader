export type ProviderId = string;
export type DetectionMode = 'opened' | 'all';

export interface MediaReference {
  providerId: ProviderId;
  canonicalId: string;
  sourceUrl: string;
}

export type MediaContainer = 'mp4' | 'webm' | 'unknown';
export type MediaQuality = 'hd' | 'sd' | 'original' | 'unknown';

export type MediaAsset =
  | { kind: 'direct'; url: string }
  | { kind: 'separate-mp4-tracks'; videoUrl: string; audioUrl: string };

export interface MediaVariant {
  id: string;
  asset: MediaAsset;
  container: MediaContainer;
  quality?: MediaQuality;
  width?: number;
  height?: number;
  hasAudio: boolean | 'unknown';
  isSilentVariant: boolean;
}

export interface ResolvedMedia {
  reference: MediaReference;
  title?: string;
  creator?: string;
  durationSeconds?: number;
  variants: MediaVariant[];
  metadata: Record<string, unknown>;
}

export interface ResolveContext {
  signal?: AbortSignal;
}

export interface MediaProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly requiredOrigins: string[];
  match(url: URL): MediaReference | null;
  resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia>;
}

export interface PostMetadata {
  postId: string;
  title?: string;
  creator?: string;
  subreddit?: string;
  thumbnailUrl?: string;
}

export interface DetectedMediaItem {
  itemId: string;
  reference: MediaReference;
  providerLabel: string;
  post: PostMetadata;
  documentOrder: number;
  isVisible: boolean;
}

export function isMediaReference(value: unknown): value is MediaReference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.providerId === 'string' &&
    typeof candidate.canonicalId === 'string' &&
    typeof candidate.sourceUrl === 'string'
  );
}

export function isPostMetadata(value: unknown): value is PostMetadata {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.postId === 'string' &&
    optionalString(candidate.title) &&
    optionalString(candidate.creator) &&
    optionalString(candidate.subreddit) &&
    optionalString(candidate.thumbnailUrl)
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
