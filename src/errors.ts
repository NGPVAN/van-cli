import type { VanApiErrorDetails } from './types';

export class VanApiError extends Error {
  status: number;
  data: unknown;
  details: VanApiErrorDetails | unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message ?? `VAN API Error: ${status}`);
    this.name = 'VanApiError';
    this.status = status;
    this.data = data;
    this.details = (data as { errors?: VanApiErrorDetails })?.errors ?? data;
  }
}
