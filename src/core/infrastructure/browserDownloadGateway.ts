import { browser } from 'wxt/browser';
import { AppError } from '@/src/core/domain/errors';

export interface DownloadRequest {
  filename: string;
  saveAs: boolean;
  source: { kind: 'url'; url: string } | { kind: 'blob'; blob: Blob };
}

export interface DownloadGateway {
  start(request: DownloadRequest): Promise<number>;
}

export class BrowserDownloadGateway implements DownloadGateway {
  async start(request: DownloadRequest): Promise<number> {
    let objectUrl: string | undefined;
    let sourceUrl: string;
    if (request.source.kind === 'blob') {
      objectUrl = URL.createObjectURL(request.source.blob);
      sourceUrl = objectUrl;
    } else {
      sourceUrl = request.source.url;
    }
    try {
      const downloadId = await browser.downloads.download({
        url: sourceUrl,
        filename: request.filename,
        saveAs: request.saveAs,
        conflictAction: 'uniquify',
      });
      if (objectUrl) revokeAfterDownload(downloadId, objectUrl);
      return downloadId;
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      throw new AppError('DOWNLOAD_FAILED', 'Firefox could not start the download.', {
        cause: error,
      });
    }
  }
}

function revokeAfterDownload(downloadId: number, objectUrl: string): void {
  function cleanup(): void {
    browser.downloads.onChanged.removeListener(onChanged);
    URL.revokeObjectURL(objectUrl);
  }
  function onChanged(
    delta: Parameters<Parameters<typeof browser.downloads.onChanged.addListener>[0]>[0],
  ): void {
    if (delta.id !== downloadId || !delta.state) return;
    if (delta.state.current === 'complete' || delta.state.current === 'interrupted') cleanup();
  }
  browser.downloads.onChanged.addListener(onChanged);
}
