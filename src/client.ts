import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { version } from '../package.json';
import { VanApiError } from './errors';
import type { VanApiClientLike, VanApiClientOptions, VanParams, VanPayload } from './types';

const DEFAULT_BASE_URL = 'https://api.securevan.com/v4';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status?: number): boolean {
  if (!status) {
    return false;
  }

  return status === 429 || (status >= 500 && status <= 599);
}

function getRetryDelayMs(attempt: number, retryAfterHeader?: string, baseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS): number {
  if (retryAfterHeader) {
    const parsed = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }

  return Math.min(baseDelayMs * (2 ** attempt), 10_000);
}

function normalizeApiKeyMode(apiKey: string): number {
  const parts = apiKey.split('|');
  if (parts.length !== 2) {
    return 1;
  }

  const mode = Number.parseInt(parts[1], 10);
  if (mode === 0 || mode === 1) {
    return mode;
  }

  return 1;
}

export class VanApiClient implements VanApiClientLike {
  apiKey: string;
  appName: string;
  baseURL: string;
  databaseMode: number;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  http: AxiosInstance;

  constructor(options: VanApiClientOptions | string = {}, appName?: string) {
    const normalizedOptions: VanApiClientOptions = typeof options === 'string'
      ? { apiKey: options, appName }
      : options;

    this.apiKey = normalizedOptions.apiKey ?? process.env.VAN_API_KEY ?? '';
    this.appName = normalizedOptions.appName ?? process.env.VAN_APP_NAME ?? 'default_user';
    this.baseURL = normalizedOptions.baseURL ?? DEFAULT_BASE_URL;
    this.timeoutMs = normalizedOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = normalizedOptions.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = normalizedOptions.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;

    if (!this.apiKey) {
      throw new Error('VAN_API_KEY environment variable or apiKey option is required');
    }

    this.databaseMode = normalizeApiKeyMode(this.apiKey);

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeoutMs,
      auth: {
        username: this.appName,
        password: this.apiKey,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `van-cli/${version}`,
      },
    });

    this.http.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          throw new VanApiError(error.response.status, error.response.data);
        }

        if (error.request) {
          throw new Error('Network error: No response received from VAN API');
        }

        throw error;
      },
    );
  }

  private async withRetry<T>(fn: () => Promise<AxiosResponse<T>>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const response = await fn();
        return response.data;
      } catch (error) {
        const err = error as AxiosError;
        const status = err.response?.status;
        const retryAfterHeader = err.response?.headers?.['retry-after'] as string | undefined;
        const canRetry = isRetryableStatus(status) && attempt < this.maxRetries;

        if (!canRetry) {
          throw error;
        }

        const delay = getRetryDelayMs(attempt, retryAfterHeader, this.retryBaseDelayMs);
        await sleep(delay);
        attempt += 1;
      }
    }
  }

  async get(endpoint: string, params: VanParams = {}): Promise<unknown> {
    return this.withRetry(() => this.http.get(endpoint, { params }));
  }

  async post(endpoint: string, data: VanPayload = {}): Promise<unknown> {
    return this.withRetry(() => this.http.post(endpoint, data));
  }

  async put(endpoint: string, data: VanPayload = {}): Promise<unknown> {
    return this.withRetry(() => this.http.put(endpoint, data));
  }

  async delete(endpoint: string): Promise<unknown> {
    return this.withRetry(() => this.http.delete(endpoint));
  }

  async getPaginated(endpoint: string, params: VanParams = {}): Promise<unknown> {
    const normalizedParams: VanParams = {
      $top: (params.top as number) ?? (params.$top as number) ?? 50,
      $skip: (params.skip as number) ?? (params.$skip as number) ?? 0,
      ...params,
    };

    delete normalizedParams.top;
    delete normalizedParams.skip;

    return this.get(endpoint, normalizedParams);
  }

  async getAllPaginated(endpoint: string, params: VanParams = {}, maxResults = 10_000): Promise<unknown[]> {
    const results: unknown[] = [];
    let skip = 0;
    const requestedTop = (params.top as number) ?? (params.$top as number) ?? 50;
    const pageSize = Math.min(requestedTop, 100);

    while (results.length < maxResults) {
      const response = await this.getPaginated(endpoint, {
        ...params,
        $top: pageSize,
        $skip: skip,
      }) as { items?: unknown[] } | unknown[];

      const items = Array.isArray(response)
        ? response
        : response.items ?? [];

      if (items.length === 0) {
        break;
      }

      results.push(...items);

      if (items.length < pageSize) {
        break;
      }

      skip += pageSize;
    }

    return results.slice(0, maxResults);
  }
}

export default VanApiClient;
