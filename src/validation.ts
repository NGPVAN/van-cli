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

/**
 * Validate a webhook URL that VAN will POST to: absolute, HTTPS, no userinfo, and not a
 * literal private/internal address. Returns the trimmed URL.
 *
 * Only the hostname as written is checked. Names that merely resolve to private IPs
 * (e.g. 127.0.0.1.nip.io, localtest.me) pass, since VAN, not the CLI, makes the request and
 * resolving here would be racy and use a different resolver; VAN-side egress filtering is
 * the real control. Error messages never echo the value, which may embed credentials.
 */
export function validateWebhookUrl(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VanValidationError(`${label} is required`);
  }
  const url = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new VanValidationError(`${label} must be a valid absolute URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new VanValidationError(`${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new VanValidationError(`${label} must not include a username or password`);
  }
  if (isPrivateHostname(parsed.hostname.toLowerCase())) {
    throw new VanValidationError(`${label} must not point to a private/internal address`);
  }
  return url;
}

// Non-public IPv4 ranges: this network, private, CGNAT, loopback, link-local, IETF protocol
// assignments, documentation (TEST-NET-1/2/3), benchmarking, and multicast/reserved (224+).
function isPrivateIPv4([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
}

// Expands an IPv6 address (without brackets) into its 8 hextets, or null if it isn't one.
function parseIPv6(address: string): number[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':').map(h => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const words = [...head, ...new Array(fill).fill(0), ...tail];
  return words.length === 8 && words.every(Number.isInteger) ? words : null;
}

function isPrivateIPv6(w: number[]): boolean {
  const embeddedIPv4 = (hi: number, lo: number) => isPrivateIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  const zeros = (from: number, to: number) => w.slice(from, to).every(x => x === 0);

  // ::/96 IPv4-compatible (also covers :: and ::1) and ::ffff:0:0/96 IPv4-mapped.
  if (zeros(0, 5) && (w[5] === 0 || w[5] === 0xffff)) return embeddedIPv4(w[6], w[7]);
  // NAT64: well-known prefix 64:ff9b::/96 embeds an IPv4 address; 64:ff9b:1::/48 is local-use.
  if (w[0] === 0x64 && w[1] === 0xff9b) {
    if (zeros(2, 6)) return embeddedIPv4(w[6], w[7]);
    if (w[2] === 1) return true;
  }
  // 6to4 (2002::/16) embeds an IPv4 address in the next 32 bits.
  if (w[0] === 0x2002) return embeddedIPv4(w[1], w[2]);
  // Unique local fc00::/7, link-local fe80::/10, site-local fec0::/10, multicast ff00::/8.
  return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 ||
    (w[0] & 0xffc0) === 0xfec0 || (w[0] & 0xff00) === 0xff00;
}

// The URL parser has already normalized IPv4 shorthand (e.g. 2130706433 -> 127.0.0.1) and
// bracketed IPv6 hosts (e.g. [::ffff:127.0.0.1] -> [::ffff:7f00:1]) before this runs.
function isPrivateHostname(rawHostname: string): boolean {
  // A trailing DNS root dot ("localhost.") names the same host.
  const hostname = rawHostname.endsWith('.') ? rawHostname.slice(0, -1) : rawHostname;
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (ipv4) return isPrivateIPv4(ipv4.slice(1).map(Number));
  if (hostname.startsWith('[')) {
    const words = parseIPv6(hostname.slice(1, -1));
    // Anything the parser emits should expand cleanly; treat a surprise as unsafe.
    return words === null || isPrivateIPv6(words);
  }
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

/**
 * Validate optional top/skip paging options into VAN's $top/$skip query params.
 * @param maxTop - Upper bound for top, if the endpoint has one
 */
export function validatePaging(
  options: { top?: unknown; skip?: unknown },
  maxTop?: number
): { $top: number; $skip: number } {
  return {
    $top: options.top === undefined ? 50 : validateIntRange(options.top, 'top', 1, maxTop),
    $skip: options.skip === undefined ? 0 : validateNonNegativeInt(options.skip, 'skip'),
  };
}
