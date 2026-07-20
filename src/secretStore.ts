import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const SERVICE = 'van-cli';

export interface StoredSecrets {
  refreshToken: string;
  vanBearerToken: string;
}

interface SecretBackend {
  set(key: string, secrets: StoredSecrets): Promise<boolean>;
  get(key: string): Promise<StoredSecrets | null>;
  remove(key: string): Promise<void>;
}

function execWithStdin(cmd: string, args: string[], input: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
    child.stdin.write(input);
    child.stdin.end();
  });
}

// security's `-i` interactive parser tokenizes like a shell: double-quoted strings with
// backslash escapes for embedded quotes/backslashes. It reads one command per line, so a
// raw newline in an argument would terminate the command early and let the rest of the
// line run as a second command — reject that case rather than trying to encode it.
function quoteForSecurity(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error('Value cannot contain a newline.');
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// macOS: the built-in Keychain, via the `security` CLI. No extra dependency needed.
const macBackend: SecretBackend = {
  async set(key, secrets) {
    const payload = JSON.stringify(secrets);
    try {
      // Feed the command to `security -i` (interactive mode, reads commands from stdin) so
      // the secret travels over stdin instead of argv — argv is visible to other local
      // users/processes via `ps`, stdin isn't. -U updates the entry in place if one already
      // exists for this account.
      const command =
        `add-generic-password -a ${quoteForSecurity(key)} -s ${quoteForSecurity(SERVICE)} ` +
        `-w ${quoteForSecurity(payload)} -U\n`;
      const code = await execWithStdin('security', ['-i'], command);
      if (code === 0) return true;
    } catch {
      // fall through to the argv-based call below
    }
    try {
      // Fallback for older `security` builds without a working -i mode.
      await execFileAsync('security', [
        'add-generic-password', '-a', key, '-s', SERVICE, '-w', payload, '-U',
      ]);
      return true;
    } catch {
      return false;
    }
  },
  async get(key) {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password', '-a', key, '-s', SERVICE, '-w',
      ]);
      return JSON.parse(stdout.trim());
    } catch {
      return null;
    }
  },
  async remove(key) {
    try {
      await execFileAsync('security', ['delete-generic-password', '-a', key, '-s', SERVICE]);
    } catch {}
  },
};

// Linux: the freedesktop Secret Service, via `secret-tool` (libsecret-tools). Not every
// distro has this installed (especially headless servers), so callers must be prepared
// for this backend to be unavailable and fall back to on-disk storage.
const linuxBackend: SecretBackend = {
  async set(key, secrets) {
    try {
      const code = await execWithStdin('secret-tool', [
        'store', '--label', `van-cli: ${key}`, 'service', SERVICE, 'account', key,
      ], JSON.stringify(secrets));
      return code === 0;
    } catch {
      return false;
    }
  },
  async get(key) {
    try {
      const { stdout } = await execFileAsync('secret-tool', ['lookup', 'service', SERVICE, 'account', key]);
      return stdout.trim() ? JSON.parse(stdout.trim()) : null;
    } catch {
      return null;
    }
  },
  async remove(key) {
    try {
      await execFileAsync('secret-tool', ['clear', 'service', SERVICE, 'account', key]);
    } catch {}
  },
};

// Windows has no simple way to round-trip a secret through Credential Manager without a
// native dependency, so this approximates it with DPAPI: ciphertext lives on disk, but it
// can only be decrypted by the same Windows user account on the same machine — copying
// the file elsewhere doesn't expose the tokens. The script text is fixed (not user data);
// only the payload goes over stdin, so tokens never appear as a process argument.
const WINDOWS_SECRETS_PATH = path.join(os.homedir(), '.van', 'secrets.json');

const DPAPI_PROTECT_SCRIPT =
  'Add-Type -AssemblyName System.Security; ' +
  '$plain = [Console]::In.ReadToEnd(); ' +
  '$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain); ' +
  '$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); ' +
  '[Console]::Out.Write([Convert]::ToBase64String($protected))';

const DPAPI_UNPROTECT_SCRIPT =
  'Add-Type -AssemblyName System.Security; ' +
  '$b64 = [Console]::In.ReadToEnd(); ' +
  '$bytes = [Convert]::FromBase64String($b64); ' +
  '$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); ' +
  '[Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($plain))';

function runPowerShell(script: string, stdinInput: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `powershell exited with code ${code}`));
    });
    child.stdin.write(stdinInput);
    child.stdin.end();
  });
}

function loadWindowsSecretsFile(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(WINDOWS_SECRETS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveWindowsSecretsFile(data: Record<string, string>): void {
  const dir = path.dirname(WINDOWS_SECRETS_PATH);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmpPath = `${WINDOWS_SECRETS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, WINDOWS_SECRETS_PATH);
}

const windowsBackend: SecretBackend = {
  async set(key, secrets) {
    try {
      const ciphertext = await runPowerShell(DPAPI_PROTECT_SCRIPT, JSON.stringify(secrets));
      const data = loadWindowsSecretsFile();
      data[key] = ciphertext.trim();
      saveWindowsSecretsFile(data);
      return true;
    } catch {
      return false;
    }
  },
  async get(key) {
    const ciphertext = loadWindowsSecretsFile()[key];
    if (!ciphertext) return null;
    try {
      return JSON.parse(await runPowerShell(DPAPI_UNPROTECT_SCRIPT, ciphertext));
    } catch {
      return null;
    }
  },
  async remove(key) {
    const data = loadWindowsSecretsFile();
    if (key in data) {
      delete data[key];
      saveWindowsSecretsFile(data);
    }
  },
};

let linuxBackendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return true;
  }
  if (process.platform !== 'linux') {
    return false;
  }
  if (linuxBackendAvailable === null) {
    try {
      await execFileAsync('which', ['secret-tool']);
      linuxBackendAvailable = true;
    } catch {
      linuxBackendAvailable = false;
    }
  }
  return linuxBackendAvailable;
}

function selectBackend(): SecretBackend | null {
  switch (process.platform) {
    case 'darwin': return macBackend;
    case 'linux': return linuxBackend;
    case 'win32': return windowsBackend;
    default: return null;
  }
}

// Returns false when no OS secret store is available — the caller is expected to fall
// back to storing the secrets itself (e.g. in a 0600 file) in that case.
export async function saveSecrets(key: string, secrets: StoredSecrets): Promise<boolean> {
  const backend = selectBackend();
  if (!backend || !(await isBackendAvailable())) return false;
  return backend.set(key, secrets);
}

// Returns null if the OS secret store is unavailable or has no entry for this key.
export async function loadSecrets(key: string): Promise<StoredSecrets | null> {
  const backend = selectBackend();
  if (!backend || !(await isBackendAvailable())) return null;
  return backend.get(key);
}

// Best-effort: never throws, since removing a credential should never block logout.
export async function deleteSecrets(key: string): Promise<void> {
  const backend = selectBackend();
  if (!backend) return;
  try {
    await backend.remove(key);
  } catch {}
}
