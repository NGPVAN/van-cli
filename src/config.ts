import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProfileData {
  api_key?: string;
  app_name?: string;
  [key: string]: string | undefined;
}

export interface ConfigData {
  [sectionName: string]: ProfileData;
}

export function getConfigPath(): string {
  if (process.env.VAN_CONFIG_PATH) {
    return process.env.VAN_CONFIG_PATH;
  }

  const localConfigPath = path.join(process.cwd(), '.van', 'config');
  if (fs.existsSync(localConfigPath)) {
    return localConfigPath;
  }

  return path.join(os.homedir(), '.van', 'config');
}

export function parseIni(text: string): ConfigData {
  const config: ConfigData = {};
  let currentSection: string | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const raw = sectionMatch[1].trim();
      if (raw === 'default') {
        currentSection = 'default';
      } else if (raw.startsWith('profile ')) {
        currentSection = raw.slice('profile '.length).trim();
      } else {
        currentSection = raw;
      }
      if (!config[currentSection]) config[currentSection] = {};
      continue;
    }

    if (currentSection) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        config[currentSection][key] = value;
      }
    }
  }

  return config;
}

export function serializeIni(config: ConfigData): string {
  const lines: string[] = [];

  // Write [default] first if it exists
  if (config.default) {
    lines.push('[default]');
    for (const [key, value] of Object.entries(config.default)) {
      if (value !== undefined) lines.push(`${key} = ${value}`);
    }
  }

  for (const [section, data] of Object.entries(config)) {
    if (section === 'default') continue;
    if (lines.length > 0) lines.push('');
    lines.push(`[profile ${section}]`);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) lines.push(`${key} = ${value}`);
    }
  }

  lines.push(''); // trailing newline
  return lines.join('\n');
}

export function loadConfig(): ConfigData {
  const configPath = getConfigPath();
  try {
    const text = fs.readFileSync(configPath, 'utf-8');
    return parseIni(text);
  } catch (err: any) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export function saveConfig(config: ConfigData): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath, serializeIni(config), { mode: 0o600 });
}

export function getProfile(name?: string): ProfileData | undefined {
  const config = loadConfig();
  return config[name || 'default'];
}

export function listProfiles(): string[] {
  const config = loadConfig();
  return Object.keys(config);
}

export function addProfile(name: string, apiKey: string, appName?: string): void {
  const config = loadConfig();
  config[name] = { api_key: apiKey };
  if (appName) config[name].app_name = appName;
  saveConfig(config);
}

export function removeProfile(name: string): boolean {
  const config = loadConfig();
  if (!config[name]) return false;
  delete config[name];
  saveConfig(config);
  return true;
}

export function setDefaultProfile(name: string): boolean {
  const config = loadConfig();
  const source = config[name];
  if (!source) return false;
  config.default = { ...source };
  saveConfig(config);
  return true;
}

export function maskApiKey(key: string): string {
  if (key.length <= 4) return key;
  return '*'.repeat(key.length - 4) + key.slice(-4);
}

export function checkConfigPermissions(): string | null {
  const configPath = getConfigPath();
  try {
    const stat = fs.statSync(configPath);
    const mode = stat.mode & 0o777;
    if (mode & 0o044) {
      return `Warning: Config file ${configPath} has overly permissive permissions (${mode.toString(8)}). Consider running: chmod 600 ${configPath}`;
    }
  } catch {
    // file doesn't exist yet, that's fine
  }
  return null;
}
