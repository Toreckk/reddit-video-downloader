import { AppError } from '@/src/core/domain/errors';

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface HttpClient {
  get(
    url: string,
    options?: { headers?: Record<string, string>; signal?: AbortSignal },
  ): Promise<HttpResponse>;
}

export class ExtensionHttpClient implements HttpClient {
  async get(
    url: string,
    options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
  ): Promise<HttpResponse> {
    try {
      const init: RequestInit = {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      };
      if (options.headers) init.headers = options.headers;
      if (options.signal) init.signal = options.signal;
      const response = await fetch(url, init);
      return response;
    } catch (error) {
      throw new AppError('NETWORK_ERROR', 'Could not reach the media provider.', { cause: error });
    }
  }
}
