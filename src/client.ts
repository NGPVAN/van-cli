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

function withDefaultDatabaseMode(apiKey: string): string {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    return trimmedApiKey;
  }

  const parts = trimmedApiKey.split('|');
  if (parts.length === 1) {
    return `${trimmedApiKey}|1`;
  }

  if (parts.length === 2 && parts[1].trim() === '') {
    return `${parts[0]}|1`;
  }

  return trimmedApiKey;
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

function buildQueryString(params: VanParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

interface FetchLikeResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

type FetchLike = (url: string, init: Record<string, unknown>) => Promise<FetchLikeResponse>;

export class VanApiClient implements VanApiClientLike {
  apiKey: string;
  appName: string;
  baseURL: string;
  databaseMode: number;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  dryRun: boolean;

  constructor(options: VanApiClientOptions | string = {}, appName?: string) {
    const normalizedOptions: VanApiClientOptions = typeof options === 'string'
      ? { apiKey: options, appName }
      : options;

    this.apiKey = withDefaultDatabaseMode(normalizedOptions.apiKey ?? process.env.VAN_API_KEY ?? '');
    this.appName = normalizedOptions.appName ?? process.env.VAN_APP_NAME ?? 'default_user';
    this.baseURL = normalizedOptions.baseURL ?? DEFAULT_BASE_URL;
    this.timeoutMs = normalizedOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = normalizedOptions.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = normalizedOptions.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.dryRun = normalizedOptions.dryRun ?? false;

    if (!this.apiKey) {
      throw new Error('VAN_API_KEY environment variable or apiKey option is required');
    }

    this.databaseMode = normalizeApiKeyMode(this.apiKey);
  }

  private async request<T>(method: string, endpoint: string, params?: VanParams, body?: VanPayload): Promise<T> {
    const url = `${this.baseURL}${endpoint}${params ? buildQueryString(params) : ''}`;
    const headers: Record<string, string> = {
      'Authorization': basicAuthHeader(this.appName, this.apiKey),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `van-cli/${version}`,
    };

    const init: Record<string, unknown> = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      init.signal = controller.signal;

      let response: FetchLikeResponse;
      try {
        const fetchFn = (globalThis as { fetch: FetchLike }).fetch;
        response = await fetchFn(url, init);
      } catch (error) {
        clearTimeout(timeout);
        throw new Error('Network error: No response received from VAN API');
      }
      clearTimeout(timeout);

      const text = await response.text();
      const data = text ? safeJsonParse(text) : null;

      if (response.ok) {
        return data as T;
      }

      const retryAfterHeader = response.headers.get('retry-after') ?? undefined;
      const canRetry = isRetryableStatus(response.status) && attempt < this.maxRetries;
      if (!canRetry) {
        throw new VanApiError(response.status, data);
      }

      const delay = getRetryDelayMs(attempt, retryAfterHeader, this.retryBaseDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }

  private dryRunResult(method: string, endpoint: string, params?: VanParams, body?: VanPayload): unknown {
    const url = `${this.baseURL}${endpoint}`;
    const result: Record<string, unknown> = { method, url };
    if (params && Object.keys(params).length > 0) result.params = params;
    if (body && Object.keys(body).length > 0) result.body = body;
    return result;
  }

  async get(endpoint: string, params: VanParams = {}): Promise<unknown> {
    if (this.dryRun) return this.dryRunResult('GET', endpoint, params);
    return this.request('GET', endpoint, params);
  }

  async post(endpoint: string, data: VanPayload = {}): Promise<unknown> {
    if (this.dryRun) return this.dryRunResult('POST', endpoint, undefined, data);
    return this.request('POST', endpoint, undefined, data);
  }

  async put(endpoint: string, data: VanPayload = {}): Promise<unknown> {
    if (this.dryRun) return this.dryRunResult('PUT', endpoint, undefined, data);
    return this.request('PUT', endpoint, undefined, data);
  }

  async delete(endpoint: string): Promise<unknown> {
    if (this.dryRun) return this.dryRunResult('DELETE', endpoint);
    return this.request('DELETE', endpoint);
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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default VanApiClient;
