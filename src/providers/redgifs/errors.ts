import { AppError } from '@/src/core/domain/errors';

export function redgifsHttpError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError('AUTH_ERROR', 'Redgifs did not authorize the metadata request.');
  }
  if (status === 404 || status === 410) {
    return new AppError('MEDIA_NOT_FOUND', 'This Redgifs video is unavailable or was removed.');
  }
  return new AppError('NETWORK_ERROR', `Redgifs returned an HTTP ${status} response.`);
}
