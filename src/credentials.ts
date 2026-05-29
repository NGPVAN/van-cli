import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Account {
  refreshToken: string;
  vanBearerToken: string;
  vanBearerTokenExpiry: string;
  userId: number;
  userName: string;
  tenantUri: string;
  committeeName: string;
  name?: string;
}

export interface CredentialsFile {
  activeAccount: string | null;
  accounts: Record<string, Account>;
}

const VAN_BEARER_TOKEN_TTL_HOURS = 4;
const CREDENTIALS_PATH = path.join(os.homedir(), '.van', 'credentials.json');
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export function accountKey(account: Pick<Account, 'userName' | 'committeeName'>): string {
  return `${account.userName}/${account.committeeName}`;
}

export function loadCredentialsFile(): CredentialsFile {
  const credPath = CREDENTIALS_PATH;

  if (process.platform !== 'win32') {
    try {
      const stat = fs.statSync(credPath);
      if (stat.mode & 0o044) {
        process.stderr.write(
          `Warning: ${credPath} is readable by others. Run: chmod 600 ${credPath}\n`
        );
      }
    } catch {
      // file doesn't exist yet
    }
  }

  try {
    const text = fs.readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      return { activeAccount: null, accounts: {} };
    }

    // Migrate old single-account format
    if (!('accounts' in parsed) && 'userName' in parsed) {
      const old = parsed as Account;
      const key = accountKey(old);
      return { activeAccount: key, accounts: { [key]: old } };
    }

    const file = parsed as CredentialsFile;
    return {
      activeAccount: file.activeAccount ?? null,
      accounts: file.accounts ?? {},
    };
  } catch {
    return { activeAccount: null, accounts: {} };
  }
}

export function saveCredentialsFile(file: CredentialsFile): void {
  const credPath = CREDENTIALS_PATH;
  const dir = path.dirname(credPath);
  fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  const tmpPath = `${credPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), { mode: FILE_MODE });
  fs.renameSync(tmpPath, credPath);
}

export function getActiveAccount(): Account | null {
  const file = loadCredentialsFile();
  if (!file.activeAccount) return null;
  return file.accounts[file.activeAccount] ?? null;
}

export function addAccount(account: Account): void {
  const file = loadCredentialsFile();
  const key = accountKey(account);
  file.accounts[key] = account;
  file.activeAccount = key;
  saveCredentialsFile(file);
}

export function updateAccountTokens(
  key: string,
  tokens: Pick<Account, 'vanBearerToken' | 'vanBearerTokenExpiry' | 'refreshToken'>
): void {
  const file = loadCredentialsFile();
  if (!file.accounts[key]) return;
  file.accounts[key] = { ...file.accounts[key], ...tokens };
  saveCredentialsFile(file);
}

export function setActiveAccount(key: string): boolean {
  const file = loadCredentialsFile();
  if (!file.accounts[key]) return false;
  file.activeAccount = key;
  saveCredentialsFile(file);
  return true;
}

export function removeAccount(key: string): boolean {
  const file = loadCredentialsFile();
  if (!file.accounts[key]) return false;
  delete file.accounts[key];
  if (file.activeAccount === key) {
    file.activeAccount = null;
  }
  saveCredentialsFile(file);
  return true;
}

export function findAccountByName(name: string): { key: string; account: Account } | null {
  const file = loadCredentialsFile();
  const lower = name.toLowerCase();
  for (const [key, account] of Object.entries(file.accounts)) {
    if (account.name?.toLowerCase() === lower) {
      return { key, account };
    }
  }
  return null;
}

export function listAccounts(): Array<{ key: string; account: Account; isActive: boolean }> {
  const file = loadCredentialsFile();
  return Object.entries(file.accounts).map(([key, account]) => ({
    key,
    account,
    isActive: key === file.activeAccount,
  }));
}

export function isBearerTokenExpired(account: Account): boolean {
  return new Date() >= new Date(account.vanBearerTokenExpiry);
}

export function bearerTokenExpiry(): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + VAN_BEARER_TOKEN_TTL_HOURS);
  return expiry.toISOString();
}

export function formatAccountStatus(account: Account): string {
  return `${account.userName} / ${account.committeeName}`;
}
