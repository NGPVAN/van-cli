const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  parseIni,
  serializeIni,
  loadConfig,
  saveConfig,
  getProfile,
  listProfiles,
  addProfile,
  removeProfile,
  setDefaultProfile,
  maskApiKey,
  getConfigPath,
} = require('../dist/config');

describe('config INI parser', () => {
  it('parses a basic config with default and named profiles', () => {
    const input = `
[default]
api_key = my-api-key|1
app_name = my_app

[profile staging]
api_key = staging-key|0
app_name = my_app

[profile production]
api_key = prod-key|1
app_name = prod_app
`;
    const config = parseIni(input);
    expect(config.default).toEqual({ api_key: 'my-api-key|1', app_name: 'my_app' });
    expect(config.staging).toEqual({ api_key: 'staging-key|0', app_name: 'my_app' });
    expect(config.production).toEqual({ api_key: 'prod-key|1', app_name: 'prod_app' });
  });

  it('ignores comments and blank lines', () => {
    const input = `
# This is a comment
[default]
api_key = test-key|1

# Another comment
`;
    const config = parseIni(input);
    expect(config.default).toEqual({ api_key: 'test-key|1' });
  });

  it('handles values with equals signs', () => {
    const input = `[default]\napi_key = key=with=equals`;
    const config = parseIni(input);
    expect(config.default.api_key).toBe('key=with=equals');
  });

  it('returns empty object for empty input', () => {
    expect(parseIni('')).toEqual({});
  });

  it('trims whitespace from keys and values', () => {
    const input = `[default]\n  api_key  =  some-key  `;
    const config = parseIni(input);
    expect(config.default.api_key).toBe('some-key');
  });
});

describe('config INI serializer', () => {
  it('serializes default section first', () => {
    const config = {
      staging: { api_key: 'staging-key|0' },
      default: { api_key: 'default-key|1', app_name: 'my_app' },
    };
    const output = serializeIni(config);
    const lines = output.split('\n');
    expect(lines[0]).toBe('[default]');
    expect(lines[1]).toBe('api_key = default-key|1');
    expect(lines[2]).toBe('app_name = my_app');
    expect(output).toContain('[profile staging]');
  });

  it('roundtrips through parse and serialize', () => {
    const original = {
      default: { api_key: 'key1|1', app_name: 'app1' },
      staging: { api_key: 'key2|0', app_name: 'app2' },
    };
    const serialized = serializeIni(original);
    const parsed = parseIni(serialized);
    expect(parsed).toEqual(original);
  });
});

describe('config file operations', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'van-config-test-'));
    originalEnv = process.env.VAN_CONFIG_PATH;
    process.env.VAN_CONFIG_PATH = path.join(tmpDir, 'config');
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VAN_CONFIG_PATH;
    } else {
      process.env.VAN_CONFIG_PATH = originalEnv;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadConfig returns empty object when file does not exist', () => {
    expect(loadConfig()).toEqual({});
  });

  it('saveConfig creates directories and file', () => {
    const config = { default: { api_key: 'test-key|1' } };
    saveConfig(config);
    expect(fs.existsSync(process.env.VAN_CONFIG_PATH)).toBe(true);
    const loaded = loadConfig();
    expect(loaded.default.api_key).toBe('test-key|1');
  });

  it('addProfile adds a new profile', () => {
    addProfile('staging', 'staging-key|0', 'my_app');
    const config = loadConfig();
    expect(config.staging).toEqual({ api_key: 'staging-key|0', app_name: 'my_app' });
  });

  it('addProfile updates an existing profile', () => {
    addProfile('staging', 'old-key|0');
    addProfile('staging', 'new-key|1', 'updated_app');
    const config = loadConfig();
    expect(config.staging).toEqual({ api_key: 'new-key|1', app_name: 'updated_app' });
  });

  it('removeProfile removes existing profile', () => {
    addProfile('staging', 'key|0');
    expect(removeProfile('staging')).toBe(true);
    const config = loadConfig();
    expect(config.staging).toBeUndefined();
  });

  it('removeProfile returns false for nonexistent profile', () => {
    expect(removeProfile('nonexistent')).toBe(false);
  });

  it('setDefaultProfile copies profile to default', () => {
    addProfile('production', 'prod-key|1', 'prod_app');
    expect(setDefaultProfile('production')).toBe(true);
    const config = loadConfig();
    expect(config.default).toEqual({ api_key: 'prod-key|1', app_name: 'prod_app' });
  });

  it('setDefaultProfile returns false for nonexistent profile', () => {
    expect(setDefaultProfile('nonexistent')).toBe(false);
  });

  it('getProfile returns profile data', () => {
    addProfile('default', 'default-key|1', 'default_app');
    addProfile('staging', 'staging-key|0');
    expect(getProfile()).toEqual({ api_key: 'default-key|1', app_name: 'default_app' });
    expect(getProfile('staging')).toEqual({ api_key: 'staging-key|0' });
  });

  it('getProfile returns undefined for missing profile', () => {
    expect(getProfile('nonexistent')).toBeUndefined();
  });

  it('listProfiles returns all profile names', () => {
    addProfile('default', 'key1|1');
    addProfile('staging', 'key2|0');
    addProfile('production', 'key3|1');
    const names = listProfiles();
    expect(names).toContain('default');
    expect(names).toContain('staging');
    expect(names).toContain('production');
  });
});

describe('maskApiKey', () => {
  it('masks all but last 4 characters', () => {
    expect(maskApiKey('my-secret-key|1')).toBe('***********ey|1');
  });

  it('returns short keys as-is', () => {
    expect(maskApiKey('abcd')).toBe('abcd');
    expect(maskApiKey('abc')).toBe('abc');
  });
});

describe('getConfigPath', () => {
  let originalConfigPath;
  let originalCwd;
  let tmpDir;

  beforeEach(() => {
    originalConfigPath = process.env.VAN_CONFIG_PATH;
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'van-config-path-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalConfigPath === undefined) {
      delete process.env.VAN_CONFIG_PATH;
    } else {
      process.env.VAN_CONFIG_PATH = originalConfigPath;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses VAN_CONFIG_PATH env when set', () => {
    process.env.VAN_CONFIG_PATH = '/custom/path/config';
    expect(getConfigPath()).toBe('/custom/path/config');
  });

  it('uses ./.van/config when present in the current directory', () => {
    const localConfigDir = path.join(tmpDir, '.van');
    const localConfigPath = path.join(localConfigDir, 'config');
    fs.mkdirSync(localConfigDir, { recursive: true });
    fs.writeFileSync(localConfigPath, '[default]\napi_key = local-key\n');

    delete process.env.VAN_CONFIG_PATH;
    expect(fs.realpathSync(getConfigPath())).toBe(fs.realpathSync(localConfigPath));
  });

  it('defaults to ~/.van/config when no local config exists', () => {
    delete process.env.VAN_CONFIG_PATH;
    expect(getConfigPath()).toBe(path.join(os.homedir(), '.van', 'config'));
  });
});
