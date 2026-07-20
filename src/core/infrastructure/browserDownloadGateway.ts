import { browser } from 'wxt/browser';
import { AppError } from '@/src/core/domain/errors';

export interface DownloadRequest {
  url: string;
  filename: string;
  saveAs: boolean;
}

export interface DownloadGateway {
  start(request: DownloadRequest): Promise<number>;
}

export class BrowserDownloadGateway implements DownloadGateway {
  async start(request: DownloadRequest): Promise<number> {
    try {
      return await browser.downloads.download({
        url: request.url,
        filename: request.filename,
        saveAs: request.saveAs,
        conflictAction: 'uniquify',
      });
    } catch (error) {
      throw new AppError('DOWNLOAD_FAILED', 'Firefox could not start the download.', {
        cause: error,
      });
    }
  }
}
