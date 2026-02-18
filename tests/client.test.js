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
  });

  it('retries 429s and maps api errors', async () => {
    const client = new VanApiClient({ apiKey: 'abc|1', retryBaseDelayMs: 1 });

    mockHttp.get
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '0' }, data: {} } })
      .mockResolvedValueOnce({ data: { ok: true } });

    await expect(client.get('/people')).resolves.toEqual({ ok: true });

    const interceptor = mockHttp.interceptors.response.use.mock.calls[0][1];
    expect(() => interceptor({ response: { status: 403, data: { errors: [{ text: 'Forbidden' }] } } })).toThrow(VanApiError);
  });
});
