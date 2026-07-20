import type { DetectedMediaItem, DetectionMode, MediaReference, PostMetadata } from './media';
import type { Result } from '@/src/shared/result';

export interface ScanActivePageMessage {
  version: 1;
  type: 'scan-active-page';
  requestId: string;
  detectionMode: DetectionMode;
}

export interface ResolveAndDownloadMessage {
  version: 1;
  type: 'resolve-and-download';
  requestId: string;
  reference: MediaReference;
  post: PostMetadata;
}

export interface GetSettingsMessage {
  version: 1;
  type: 'get-settings';
}

export interface DismissDetectedItemsMessage {
  version: 1;
  type: 'dismiss-detected-items';
  requestId: string;
  itemIds: string[];
}

export type ExtensionMessage =
  | ScanActivePageMessage
  | ResolveAndDownloadMessage
  | GetSettingsMessage
  | DismissDetectedItemsMessage;

export type ScanActivePageResponse = Result<{ items: DetectedMediaItem[]; surfaceId: string }>;

export interface DownloadStarted {
  downloadId: number;
  filename: string;
  warning?: string;
}

export type ResolveAndDownloadResponse = Result<DownloadStarted>;
export type DismissDetectedItemsResponse = Result<{ dismissedCount: number }>;

export function isScanActivePageMessage(value: unknown): value is ScanActivePageMessage {
  if (!isMessageRecord(value)) return false;
  return (
    value.version === 1 &&
    value.type === 'scan-active-page' &&
    typeof value.requestId === 'string' &&
    (value.detectionMode === 'opened' || value.detectionMode === 'all')
  );
}

export function isResolveAndDownloadMessage(value: unknown): value is ResolveAndDownloadMessage {
  if (!isMessageRecord(value)) return false;
  return value.version === 1 && value.type === 'resolve-and-download';
}

export function isDismissDetectedItemsMessage(
  value: unknown,
): value is DismissDetectedItemsMessage {
  if (!isMessageRecord(value)) return false;
  return (
    value.version === 1 &&
    value.type === 'dismiss-detected-items' &&
    typeof value.requestId === 'string' &&
    Array.isArray(value.itemIds) &&
    value.itemIds.every((itemId) => typeof itemId === 'string')
  );
}

function isMessageRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
