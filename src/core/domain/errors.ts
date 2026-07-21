export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'UNSUPPORTED_PAGE'
  | 'CONTENT_SCRIPT_UNAVAILABLE'
  | 'PROVIDER_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'MEDIA_NOT_FOUND'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'NO_DOWNLOADABLE_VARIANT'
  | 'MEDIA_PROCESSING_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export interface SerializableError {
  code: ErrorCode;
  message: string;
  details?: string;
}

export function normalizeError(error: unknown): SerializableError {
  if (error instanceof AppError) {
    const normalized: SerializableError = { code: error.code, message: error.message };
    const details = errorDetails(error.cause, error.message);
    if (details) normalized.details = details;
    return normalized;
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message || 'An unexpected error occurred.' };
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' };
}

function errorDetails(error: unknown, outerMessage: string): string | undefined {
  let details: string | undefined;
  if (error instanceof Error) details = error.message;
  else if (typeof error === 'string') details = error;
  if (!details || details === outerMessage) return undefined;
  return details.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
}
