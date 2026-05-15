const { VanApi, configure, getDefaultInstance } = require('../dist/index');

describe('SDK exports', () => {
  const originalKey = process.env.VAN_API_KEY;
  const originalApp = process.env.VAN_APP_NAME;

  afterEach(() => {
    process.env.VAN_API_KEY = originalKey;
    process.env.VAN_APP_NAME = originalApp;
    jest.resetModules();
  });

  it('configure returns a usable instance', () => {
    const api = configure({ apiKey: 'abc|1', appName: 'test' });
    expect(api).toBeInstanceOf(VanApi);
    expect(typeof api.people.list).toBe('function');
    expect(typeof api.savedLists.list).toBe('function');
  });

  it('builds default instance from env vars', () => {
    process.env.VAN_API_KEY = 'env-key|1';
    process.env.VAN_APP_NAME = 'env-app';

    const api = getDefaultInstance();
    expect(api).toBeInstanceOf(VanApi);
  });

  it('throws when default instance requested without VAN_API_KEY', () => {
    process.env.VAN_API_KEY = '';
    process.env.VAN_APP_NAME = '';

    const { getDefaultInstance: freshGetDefault } = require('../dist/index');
    expect(() => freshGetDefault()).toThrow(/VAN_API_KEY/);
  });
});
