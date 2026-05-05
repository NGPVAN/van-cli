const { VanApiClient } = require('../dist/index');
const { VanApiError } = require('../dist/errors');

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  };
}

describe('VanApiClient', () => {
  let originalFetch;
  let mockFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('requires VAN_API_KEY', () => {
    const original = process.env.VAN_API_KEY;
    delete process.env.VAN_API_KEY;
    expect(() => new VanApiClient()).toThrow('VAN_API_KEY');
    process.env.VAN_API_KEY = original;
  });

  it('supports basic HTTP and pagination behavior', async () => {
    const client = new VanApiClient({ apiKey: 'abc|1', retryBaseDelayMs: 1 });

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(client.get('/people')).resolves.toEqual({ ok: true });

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    await expect(client.post('/people', { firstName: 'A' })).resolves.toEqual({ id: 1 });

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { updated: true }));
    await expect(client.put('/people/1', { lastName: 'B' })).resolves.toEqual({ updated: true });

    mockFetch.mockResolvedValueOnce(jsonResponse(200, null));
    await expect(client.delete('/people/1')).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));
    await client.getPaginated('/people', { top: 10, skip: 5 });
    const lastCallUrl = mockFetch.mock.calls.at(-1)[0];
    expect(lastCallUrl).toContain('/people?');
    expect(lastCallUrl).toContain('%24top=10');
    expect(lastCallUrl).toContain('%24skip=5');

    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 1 }, { id: 2 }] }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    const all = await client.getAllPaginated('/people', { top: 2 }, 10);
    expect(all).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('retries 429s and maps api errors', async () => {
    const client = new VanApiClient({ apiKey: 'abc|1', retryBaseDelayMs: 1 });

    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(client.get('/people')).resolves.toEqual({ ok: true });

    mockFetch.mockResolvedValueOnce(jsonResponse(403, { errors: [{ text: 'Forbidden' }] }));
    await expect(client.get('/people')).rejects.toBeInstanceOf(VanApiError);

    mockFetch.mockRejectedValueOnce(new Error('connection refused'));
    await expect(client.get('/people')).rejects.toThrow(/Network error/);
  });

  it('covers api key mode normalization and non-retry errors', async () => {
    const modeZero = new VanApiClient({ apiKey: 'abc|0' });
    expect(modeZero.databaseMode).toBe(0);
    expect(modeZero.apiKey).toBe('abc|0');

    const invalidMode = new VanApiClient({ apiKey: 'abc|9' });
    expect(invalidMode.databaseMode).toBe(1);
    expect(invalidMode.apiKey).toBe('abc|9');

    const noMode = new VanApiClient({ apiKey: 'abc' });
    expect(noMode.databaseMode).toBe(1);
    expect(noMode.apiKey).toBe('abc|1');

    const blankMode = new VanApiClient({ apiKey: 'abc|' });
    expect(blankMode.databaseMode).toBe(1);
    expect(blankMode.apiKey).toBe('abc|1');

    mockFetch.mockResolvedValueOnce(jsonResponse(400, { errors: [{ text: 'Bad request' }] }));
    await expect(noMode.get('/people')).rejects.toBeDefined();
  });
});
