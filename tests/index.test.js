const { VanApi, configure, getDefaultInstance } = require('../dist/index');

describe('SDK exports', () => {
  it('configure returns a usable instance', () => {
    const api = configure({ apiKey: 'abc|1', appName: 'test' });
    expect(api).toBeInstanceOf(VanApi);
    expect(typeof api.people.find).toBe('function');
    expect(typeof api.savedLists.list).toBe('function');
  });

  it('builds default instance from env vars', () => {
    process.env.VAN_API_KEY = 'env-key|1';
    process.env.VAN_APP_NAME = 'env-app';

    const api = getDefaultInstance();
    expect(api).toBeInstanceOf(VanApi);
  });
});
