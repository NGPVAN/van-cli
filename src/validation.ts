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
  if (isPrivateHostname(parsed.hostname.toLowerCase())) {
    throw new VanValidationError(`${label} must not point to a private/internal address`);
  }
  return value;
}

// The URL parser has already normalized IPv4 shorthand (e.g. 2130706433 -> 127.0.0.1) and
// bracketed IPv6 hosts, so plain pattern checks on the hostname are enough here.
function isPrivateHostname(hostname: string): boolean {
  const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(hostname);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1);
    return ipv6 === '::' || ipv6 === '::1' || ipv6.startsWith('::ffff:') || /^f[cd]/.test(ipv6) || /^fe[89ab]/.test(ipv6);
  }
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}
