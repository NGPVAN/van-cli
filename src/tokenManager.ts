import { DEFAULT_LOGIN_URL } from './client';
import {
  getActiveAccount,
  isBearerTokenExpired,
  updateAccountTokens,
  accountKey,
  bearerTokenExpiry,
} from './credentials';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function getBearerToken(): Promise<string> {
  const account = getActiveAccount();
  if (!account) {
    throw new AuthError('Not logged in. Run: van auth login');
  }

  if (!isBearerTokenExpired(account)) {
    return account.vanBearerToken;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/refreshToken`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: account.refreshToken,
          userId: account.userId,
          tenantUri: account.tenantUri,
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      throw new AuthError('Session expired. Run: van auth login');
    }

    const data = (await res.json()) as { bearerToken: string; refreshToken: string };
    updateAccountTokens(accountKey(account), {
      vanBearerToken: data.bearerToken,
      vanBearerTokenExpiry: bearerTokenExpiry(),
      refreshToken: data.refreshToken,
    });
    return data.bearerToken;
  } finally {
    clearTimeout(timer);
  }
}
