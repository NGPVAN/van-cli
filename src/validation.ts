import { VanValidationError } from './errors';

// Shared input validators for SDK command modules. Each accepts either the raw CLI string or
// an already-typed value (e.g. from --json or SDK callers) and throws VanValidationError on failure.

function toInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const num = Number(value.trim());
    return Number.isSafeInteger(num) ? num : null;
  }
  return null;
}

export function validatePositiveInt(value: unknown, label: string): number {
  const num = toInteger(value);
  if (num === null || num <= 0) {
    throw new VanValidationError(`${label} must be a positive integer, got: "${value}"`);
  }
  return num;
}

export function validateNonNegativeInt(value: unknown, label: string): number {
  const num = toInteger(value);
  if (num === null || num < 0) {
    throw new VanValidationError(`${label} must be a non-negative integer, got: "${value}"`);
  }
  return num;
}

export function validateIntRange(value: unknown, label: string, min: number, max?: number): number {
  const num = toInteger(value);
  if (num === null || num < min || (max !== undefined && num > max)) {
    const range = max === undefined ? `>= ${min}` : `between ${min} and ${max}`;
    throw new VanValidationError(`${label} must be an integer ${range}, got: "${value}"`);
  }
  return num;
}

export function validateBoolean(value: unknown, label: string): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new VanValidationError(`${label} must be "true" or "false", got: "${value}"`);
}

/**
 * Parse a comma-separated id list ("1, 2,3") or an array of ids into positive integers.
 * Rejects empty entries; optionally rejects duplicates and caps the number of ids.
 */
export function validateIdList(
  value: unknown,
  label: string,
  options: { max?: number; allowDuplicates?: boolean } = {}
): number[] {
  const entries = Array.isArray(value) ? value : String(value ?? '').split(',');
  const ids = entries.map((entry) => {
    const trimmed = typeof entry === 'string' ? entry.trim() : entry;
    if (trimmed === '' || trimmed === undefined || trimmed === null) {
      throw new VanValidationError(`${label} must not contain empty entries, got: "${value}"`);
    }
    return validatePositiveInt(trimmed, label);
  });

  if (!options.allowDuplicates) {
    const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
    if (duplicate !== undefined) {
      throw new VanValidationError(`${label} must not contain duplicate ids, got duplicate: ${duplicate}`);
    }
  }

  if (options.max !== undefined && ids.length > options.max) {
    throw new VanValidationError(`${label} accepts at most ${options.max} ids, got ${ids.length}`);
  }

  return ids;
}

export function validateWebhookUrl(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VanValidationError(`${label} is required`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new VanValidationError(`${label} must be a valid absolute URL, got: "${value}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new VanValidationError(`${label} must use HTTPS`);
  }
  const hostname = parsed.hostname.toLowerCase();
  const privatePatterns = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'];
  const privateRanges = ['10.', '192.168.', '169.254.'];
  if (
    privatePatterns.includes(hostname) ||
    privateRanges.some(prefix => hostname.startsWith(prefix)) ||
    hostname.startsWith('172.') && (() => {
      const second = parseInt(hostname.split('.')[1], 10);
      return second >= 16 && second <= 31;
    })()
  ) {
    throw new VanValidationError(`${label} must not point to a private/internal address`);
  }
  return value;
}
