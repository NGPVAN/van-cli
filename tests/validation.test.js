const {
  validatePositiveInt,
  validateNonNegativeInt,
  validateIntRange,
  validateBoolean,
  validateIdList,
  validateWebhookUrl,
  validatePaging,
} = require('../dist/validation');
const { VanValidationError } = require('../dist/errors');

describe('shared validators', () => {
  test('validatePositiveInt accepts positive integers as numbers or trimmed strings', () => {
    expect(validatePositiveInt(1, 'id')).toBe(1);
    expect(validatePositiveInt('42', 'id')).toBe(42);
    expect(validatePositiveInt(' 7 ', 'id')).toBe(7);
  });

  test.each([0, -1, '0', '-1', '1.5', 1.5, 'abc', '', '1e2', '0x10', '12abc', undefined, null, NaN])(
    'validatePositiveInt rejects %p',
    (value) => {
      expect(() => validatePositiveInt(value, 'id')).toThrow(VanValidationError);
      expect(() => validatePositiveInt(value, 'id')).toThrow(/id must be a positive integer/);
    }
  );

  test('validateNonNegativeInt accepts zero and positive integers', () => {
    expect(validateNonNegativeInt(0, 'n')).toBe(0);
    expect(validateNonNegativeInt('0', 'n')).toBe(0);
    expect(validateNonNegativeInt('15', 'n')).toBe(15);
  });

  test.each([-1, '-1', '2.5', 'x', ''])('validateNonNegativeInt rejects %p', (value) => {
    expect(() => validateNonNegativeInt(value, 'n')).toThrow(/n must be a non-negative integer/);
  });

  test('validateIntRange enforces min and optional max', () => {
    expect(validateIntRange('1', 'top', 1, 100)).toBe(1);
    expect(validateIntRange('100', 'top', 1, 100)).toBe(100);
    expect(() => validateIntRange('0', 'top', 1, 100)).toThrow(/top must be an integer between 1 and 100/);
    expect(() => validateIntRange('101', 'top', 1, 100)).toThrow(/between 1 and 100/);
    expect(validateIntRange('100000', 'top', 1)).toBe(100000);
    expect(() => validateIntRange('0', 'top', 1)).toThrow(/top must be an integer >= 1/);
  });

  test('validateBoolean accepts booleans and "true"/"false" strings only', () => {
    expect(validateBoolean(true, 'b')).toBe(true);
    expect(validateBoolean('true', 'b')).toBe(true);
    expect(validateBoolean(false, 'b')).toBe(false);
    expect(validateBoolean('false', 'b')).toBe(false);
    expect(() => validateBoolean('yes', 'b')).toThrow(/b must be "true" or "false"/);
    expect(() => validateBoolean(1, 'b')).toThrow(VanValidationError);
  });

  describe('validateIdList', () => {
    test('parses comma-separated ids and trims whitespace', () => {
      expect(validateIdList('12,34,56', 'ids')).toEqual([12, 34, 56]);
      expect(validateIdList(' 12 , 34,56 ', 'ids')).toEqual([12, 34, 56]);
      expect(validateIdList('9', 'ids')).toEqual([9]);
    });

    test('accepts arrays (e.g. from --json)', () => {
      expect(validateIdList([1, '2', ' 3 '], 'ids')).toEqual([1, 2, 3]);
    });

    test.each(['1,,2', '1,', ',1', '', ' ', '1, ,2'])('rejects empty entries in %p', (value) => {
      expect(() => validateIdList(value, 'ids')).toThrow(/ids must not contain empty entries/);
    });

    test.each(['1,0', '1,-2', '1,abc', '1,2.5'])('rejects non-positive-integer entries in %p', (value) => {
      expect(() => validateIdList(value, 'ids')).toThrow(/ids must be a positive integer/);
    });

    test('rejects duplicates unless allowed', () => {
      expect(() => validateIdList('1,2,1', 'ids')).toThrow(/duplicate ids, got duplicate: 1/);
      expect(() => validateIdList('1, 01', 'ids')).toThrow(/duplicate/);
      expect(validateIdList('1,2,1', 'ids', { allowDuplicates: true })).toEqual([1, 2, 1]);
    });

    test('enforces max count', () => {
      expect(validateIdList('1,2,3,4,5', 'ids', { max: 5 })).toHaveLength(5);
      expect(() => validateIdList('1,2,3,4,5,6', 'ids', { max: 5 })).toThrow(/ids accepts at most 5 ids, got 6/);
    });
  });

  describe('validateWebhookUrl', () => {
    test('accepts absolute https URLs', () => {
      expect(validateWebhookUrl('https://hooks.example.com/van?x=1', 'webhookUrl')).toBe('https://hooks.example.com/van?x=1');
    });

    test.each([undefined, null, '', '   '])('rejects missing/empty value %p', (value) => {
      expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/webhookUrl is required/);
    });

    test.each(['/relative/path', 'example.com/hook', 'not a url'])('rejects non-absolute URL %p', (value) => {
      expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/webhookUrl must be a valid absolute URL/);
    });

    test.each(['http://example.com/hook', 'ftp://example.com/hook'])('rejects non-https scheme %p', (value) => {
      expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/webhookUrl must use HTTPS/);
    });

    test.each([
      'https://localhost/hook', 'https://127.0.0.1/hook', 'https://[::1]/hook', 'https://10.0.0.5/hook',
      'https://192.168.1.1/hook', 'https://172.16.0.1/hook', 'https://169.254.169.254/hook',
      'https://127.0.0.2/hook', 'https://2130706433/hook', 'https://0.0.0.0/hook', 'https://api.localhost/hook',
      'https://[::ffff:127.0.0.1]/hook', 'https://[::ffff:10.1.2.3]/hook', 'https://[::ffff:192.168.0.1]/hook',
      'https://[fd00::1]/hook', 'https://[fe80::1]/hook',
      'https://localhost./hook', 'https://api.localhost./hook', 'https://127.0.0.1./hook',
      // IPv4: CGNAT, IETF protocol assignments, TEST-NETs, benchmarking, multicast/reserved
      'https://100.64.0.1/hook', 'https://100.127.255.254/hook', 'https://192.0.0.8/hook', 'https://192.0.2.1/hook',
      'https://198.18.0.1/hook', 'https://198.19.255.1/hook', 'https://198.51.100.1/hook', 'https://203.0.113.1/hook',
      'https://224.0.0.1/hook', 'https://239.255.255.250/hook', 'https://240.0.0.1/hook', 'https://255.255.255.255/hook',
      // IPv6: IPv4-compatible, NAT64 (well-known + local-use), 6to4, site-local, multicast, unspecified
      'https://[::127.0.0.1]/hook', 'https://[::a00:1]/hook', 'https://[64:ff9b::127.0.0.1]/hook',
      'https://[64:ff9b::a9fe:a9fe]/hook', 'https://[64:ff9b:1::1]/hook', 'https://[2002:7f00:1::1]/hook',
      'https://[fec0::1]/hook', 'https://[ff02::1]/hook', 'https://[::]/hook',
    ])('rejects private/internal address %p', (value) => {
      expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/private\/internal address/);
    });

    test.each([
      'https://10.example.com/hook', 'https://172.16.example.com/hook', 'https://[2001:db8::1]/hook', 'https://[::ffff:8.8.8.8]/hook',
      'https://example.com./hook', 'https://100.63.255.255/hook', 'https://100.128.0.1/hook', 'https://198.20.0.1/hook',
      'https://223.255.255.255/hook', 'https://[64:ff9b::8.8.8.8]/hook', 'https://[2002:808:808::1]/hook', 'https://[2606:4700::1111]/hook',
    ])('accepts public address %p', (value) => {
      expect(validateWebhookUrl(value, 'webhookUrl')).toBe(value);
    });

    test('trims surrounding whitespace from the returned URL', () => {
      expect(validateWebhookUrl('  https://hooks.example.com/van \n', 'webhookUrl')).toBe('https://hooks.example.com/van');
    });

    test.each(['https://user:pw@hooks.example.com/van', 'https://user@hooks.example.com/van', 'https://:pw@hooks.example.com/van'])(
      'rejects userinfo %p without echoing it', (value) => {
        expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/must not include a username or password/);
        expect(() => validateWebhookUrl(value, 'webhookUrl')).not.toThrow(/pw|user@/);
      });

    test('does not echo the value when the URL is invalid', () => {
      expect(() => validateWebhookUrl('secret-token not a url', 'webhookUrl')).not.toThrow(/secret-token/);
    });
  });

  describe('validatePaging', () => {
    test('defaults to $top 50 / $skip 0 and coerces strings', () => {
      expect(validatePaging({})).toEqual({ $top: 50, $skip: 0 });
      expect(validatePaging({ top: '100', skip: '20' }, 100)).toEqual({ $top: 100, $skip: 20 });
    });

    test('enforces bounds', () => {
      expect(() => validatePaging({ top: '101' }, 100)).toThrow(/top must be an integer between 1 and 100/);
      expect(() => validatePaging({ top: 0 })).toThrow(/top must be an integer >= 1/);
      expect(() => validatePaging({ skip: -1 })).toThrow(/skip must be a non-negative integer/);
      expect(validatePaging({ top: 5000 })).toEqual({ $top: 5000, $skip: 0 });
    });
  });
});
