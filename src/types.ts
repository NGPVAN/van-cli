export type VanParams = Record<string, unknown>;
export type VanPayload = Record<string, unknown>;

export interface VanApiErrorDetails {
  [key: string]: unknown;
}

export interface VanApiClientOptions {
  apiKey?: string;
  appName?: string;
  baseURL?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  dryRun?: boolean;
}

export interface VanApiClientLike {
  get: (endpoint: string, params?: VanParams) => Promise<unknown>;
  post: (endpoint: string, data?: VanPayload) => Promise<unknown>;
  put: (endpoint: string, data?: VanPayload) => Promise<unknown>;
  delete: (endpoint: string) => Promise<unknown>;
  getPaginated: (endpoint: string, params?: VanParams) => Promise<unknown>;
  getAllPaginated: (endpoint: string, params?: VanParams, maxResults?: number) => Promise<unknown[]>;
}
