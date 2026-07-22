import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { saveSecrets, loadSecrets, deleteSecrets, type StoredSecrets } from './secretStore';

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

// What's actually persisted to credentials.json. Tokens are omitted here whenever the
// OS secret store accepts them (see secretStore.ts) — they're present only as a fallback
// for platforms/environments where no OS store is available.
type StoredAccount = Omit<Account, 'refreshToken' | 'vanBearerToken'> & Partial<StoredSecrets>;

export interface CredentialsFile {
  activeAccount: string | null;
  accounts: Record<string, StoredAccount>;
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
    } catch {}
  }

  try {
    const text = fs.readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      return { activeAccount: null, accounts: {} };
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

// Fills in refreshToken/vanBearerToken from the OS secret store when they weren't stored
// on disk. If the store has since lost the entry (e.g. keychain tampered with by hand),
// callers get empty strings and any API call will fail loudly with an auth error rather
// than silently using a stale token.
async function hydrateAccount(key: string, stored: StoredAccount): Promise<Account> {
  if (stored.refreshToken !== undefined && stored.vanBearerToken !== undefined) {
    return stored as Account;
  }
  const secrets = await loadSecrets(key);
  return {
    ...stored,
    refreshToken: secrets?.refreshToken ?? '',
    vanBearerToken: secrets?.vanBearerToken ?? '',
  };
}

export async function getActiveAccount(): Promise<Account | null> {
  const file = loadCredentialsFile();
  if (!file.activeAccount) return null;
  const stored = file.accounts[file.activeAccount];
  if (!stored) return null;
  return hydrateAccount(file.activeAccount, stored);
}

// Unlike getActiveAccount(), doesn't depend on the persisted "active" pointer — resolves
// to the only stored account whenever there's exactly one, even if activeAccount is unset
// (e.g. it was never set, or was cleared because the account it pointed to got removed).
export async function getSoleAccount(): Promise<Account | null> {
  const file = loadCredentialsFile();
  const entries = Object.entries(file.accounts);
  if (entries.length !== 1) return null;
  const [key, stored] = entries[0];
  return hydrateAccount(key, stored);
}

// Sync, no secret-store lookup — safe to call unconditionally at CLI startup (e.g. for
// the --help banner) without adding OS keychain/DPAPI latency to every invocation.
export function getActiveAccountMetadata(): Pick<Account, 'userName' | 'committeeName' | 'name'> | null {
  const file = loadCredentialsFile();
  if (!file.activeAccount) return null;
  const stored = file.accounts[file.activeAccount];
  if (!stored) return null;
  return { userName: stored.userName, committeeName: stored.committeeName, name: stored.name };
}

// Sync, no secret-store lookup — lets callers check how many accounts are stored (and
// which is active) without paying an OS keychain/DPAPI round-trip per account.
export function listAccountMetadata(): Array<Pick<Account, 'userName' | 'committeeName' | 'name'> & { key: string; isActive: boolean }> {
  const file = loadCredentialsFile();
  return Object.entries(file.accounts).map(([key, stored]) => ({
    key,
    userName: stored.userName,
    committeeName: stored.committeeName,
    name: stored.name,
    isActive: key === file.activeAccount,
  }));
}

// Sync, no secret-store lookup — same idea as getActiveAccountMetadata() but resolves a
// specific named account instead of the persisted "active" one.
export function findAccountMetadataByName(name: string): Pick<Account, 'userName' | 'committeeName' | 'name'> | null {
  const file = loadCredentialsFile();
  const lower = name.toLowerCase();
  for (const stored of Object.values(file.accounts)) {
    if (stored.name?.toLowerCase() === lower) {
      return { userName: stored.userName, committeeName: stored.committeeName, name: stored.name };
    }
  }
  return null;
}

export async function addAccount(account: Account): Promise<void> {
  const file = loadCredentialsFile();
  const key = accountKey(account);
  const { refreshToken, vanBearerToken, ...metadata } = account;

  const storedSecurely = await saveSecrets(key, { refreshToken, vanBearerToken });
  if (!storedSecurely) {
    console.error(
      'Note: no OS secret store is available, so login tokens will be stored in ~/.van/credentials.json (permissions restricted to your user).'
    );
  }

  file.accounts[key] = storedSecurely ? metadata : { ...metadata, refreshToken, vanBearerToken };
  file.activeAccount = key;
  saveCredentialsFile(file);
}

export async function updateAccountTokens(
  key: string,
  tokens: Pick<Account, 'vanBearerToken' | 'vanBearerTokenExpiry' | 'refreshToken'>
): Promise<void> {
  const file = loadCredentialsFile();
  const existing = file.accounts[key];
  if (!existing) return;

  const { refreshToken, vanBearerToken, ...existingMetadata } = existing;
  const storedSecurely = await saveSecrets(key, {
    refreshToken: tokens.refreshToken,
    vanBearerToken: tokens.vanBearerToken,
  });

  file.accounts[key] = storedSecurely
    ? { ...existingMetadata, vanBearerTokenExpiry: tokens.vanBearerTokenExpiry }
    : { ...existingMetadata, ...tokens };

  saveCredentialsFile(file);
}

export function setActiveAccount(key: string): boolean {
  const file = loadCredentialsFile();
  if (!file.accounts[key]) return false;
  file.activeAccount = key;
  saveCredentialsFile(file);
  return true;
}

export async function removeAccount(key: string): Promise<boolean> {
  const file = loadCredentialsFile();
  if (!file.accounts[key]) return false;
  delete file.accounts[key];
  if (file.activeAccount === key) {
    file.activeAccount = null;
  }
  saveCredentialsFile(file);
  await deleteSecrets(key);
  return true;
}

export async function findAccountByName(name: string): Promise<{ key: string; account: Account } | null> {
  const file = loadCredentialsFile();
  const lower = name.toLowerCase();
  for (const [key, stored] of Object.entries(file.accounts)) {
    if (stored.name?.toLowerCase() === lower) {
      return { key, account: await hydrateAccount(key, stored) };
    }
  }
  return null;
}

export async function listAccounts(): Promise<Array<{ key: string; account: Account; isActive: boolean }>> {
  const file = loadCredentialsFile();
  return Promise.all(
    Object.entries(file.accounts).map(async ([key, stored]) => ({
      key,
      account: await hydrateAccount(key, stored),
      isActive: key === file.activeAccount,
    }))
  );
}

export function isBearerTokenExpired(account: Account): boolean {
  return new Date() >= new Date(account.vanBearerTokenExpiry);
}

export function bearerTokenExpiry(): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + VAN_BEARER_TOKEN_TTL_HOURS);
  return expiry.toISOString();
}

export function formatAccountStatus(account: Pick<Account, 'userName' | 'committeeName'>): string {
  return `${account.userName} / ${account.committeeName}`;
}
