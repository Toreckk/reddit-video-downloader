import { describe, expect, it } from 'vitest';
import { AppError, normalizeError } from '@/src/core/domain/errors';

describe('normalizeError', () => {
  it('preserves a concise underlying browser error for diagnostics', () => {
    const error = new AppError('DOWNLOAD_FAILED', 'Firefox could not start the download.', {
      cause: new Error('Invalid filename'),
    });

    expect(normalizeError(error)).toEqual({
      code: 'DOWNLOAD_FAILED',
      message: 'Firefox could not start the download.',
      details: 'Invalid filename',
    });
  });

  it('omits duplicate details', () => {
    const error = new AppError('NETWORK_ERROR', 'Could not reach the media provider.', {
      cause: new Error('Could not reach the media provider.'),
    });

    expect(normalizeError(error)).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the media provider.',
    });
  });
});
