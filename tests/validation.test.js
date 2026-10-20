const {
  validatePositiveInt,
  validateNonNegativeInt,
  validateIntRange,
  validateBoolean,
  validateIdList,
  validateWebhookUrl,
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
      'https://[::ffff:127.0.0.1]/hook', 'https://[fd00::1]/hook', 'https://[fe80::1]/hook',
    ])('rejects private/internal address %p', (value) => {
      expect(() => validateWebhookUrl(value, 'webhookUrl')).toThrow(/private\/internal address/);
    });

    test.each(['https://10.example.com/hook', 'https://172.16.example.com/hook', 'https://[2001:db8::1]/hook'])(
      'accepts public hostname %p', (value) => {
        expect(validateWebhookUrl(value, 'webhookUrl')).toBe(value);
      });
  });
});
