const axios = require('axios');

jest.mock('axios', () => ({
  create: jest.fn(),
}));

const { VanApiClient } = require('../dist/index');
const { VanApiError } = require('../dist/errors');

describe('VanApiClient', () => {
  let mockHttp;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttp = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: { response: { use: jest.fn() } },
    };

    axios.create.mockReturnValue(mockHttp);
  });

  it('requires VAN_API_KEY', () => {
    const original = process.env.VAN_API_KEY;
    delete process.env.VAN_API_KEY;
    expect(() => new VanApiClient()).toThrow('VAN_API_KEY');
    process.env.VAN_API_KEY = original;
  });

  it('supports basic HTTP and pagination behavior', async () => {
    const client = new VanApiClient({ apiKey: 'abc|1', retryBaseDelayMs: 1 });

    mockHttp.get.mockResolvedValue({ data: { ok: true } });
    mockHttp.post.mockResolvedValue({ data: { id: 1 } });
    mockHttp.put.mockResolvedValue({ data: { updated: true } });
    mockHttp.delete.mockResolvedValue({ data: null });

    await expect(client.get('/people')).resolves.toEqual({ ok: true });
    await expect(client.post('/people', { firstName: 'A' })).resolves.toEqual({ id: 1 });
    await expect(client.put('/people/1', { lastName: 'B' })).resolves.toEqual({ updated: true });
    await expect(client.delete('/people/1')).resolves.toBeNull();

    await client.getPaginated('/people', { top: 10, skip: 5 });
    expect(mockHttp.get).toHaveBeenCalledWith('/people', { params: { $top: 10, $skip: 5 } });

    mockHttp.get.mockResolvedValueOnce({ data: { items: [{ id: 1 }, { id: 2 }] } })
      .mockResolvedValueOnce({ data: { items: [] } });
    const all = await client.getAllPaginated('/people', { top: 2 }, 10);
    expect(all).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('retries 429s and maps api errors', async () => {
    const client = new VanApiClient({ apiKey: 'abc|1', retryBaseDelayMs: 1 });

    mockHttp.get
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '0' }, data: {} } })
      .mockResolvedValueOnce({ data: { ok: true } });

    await expect(client.get('/people')).resolves.toEqual({ ok: true });

    const interceptor = mockHttp.interceptors.response.use.mock.calls[0][1];
    expect(() => interceptor({ response: { status: 403, data: { errors: [{ text: 'Forbidden' }] } } })).toThrow(VanApiError);
    expect(() => interceptor({ request: {} })).toThrow(/Network error/);
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

    mockHttp.get.mockRejectedValueOnce({ response: { status: 400, data: { errors: [{ text: 'Bad request' }] } } });
    await expect(noMode.get('/people')).rejects.toBeDefined();
  });
});
