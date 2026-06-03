import { z } from 'zod';
import { createRequire } from 'module';
import * as http from 'http';
import * as crypto from 'crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const require = createRequire(import.meta.url);
const { DEFAULT_LOGIN_URL } = require('../../../src/client.js') as { DEFAULT_LOGIN_URL: string };
const creds = require('../../../src/credentials.js') as {
  addAccount: (a: any) => void;
  bearerTokenExpiry: () => string;
  accountKey: (a: any) => string;
  listAccounts: () => Array<{ key: string; account: any; isActive: boolean }>;
  getActiveAccount: () => any | null;
  setActiveAccount: (key: string) => boolean;
  formatAccountStatus: (a: any) => string;
};

// ── PKCE helpers ────────────────────────────────────────────────────────────

const CALLBACK_PORT = 7890;
const CALLBACK_PATH = '/callback';
const LISTEN_HOST = '127.0.0.1';
const REDIRECT_URI = `http://${LISTEN_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}
function generateCodeChallenge(verifier: string) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

function openBrowser(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Authorization URL must use HTTPS.');
  const { exec, execFile } = require('child_process') as typeof import('child_process');
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

function waitForCallback(): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      if (url.pathname !== CALLBACK_PATH) { res.writeHead(404); res.end(); return; }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      const html = error
        ? `<html><body style="font-family:sans-serif;padding:2rem"><h2>&#x274C; Login failed</h2><p>${error}</p></body></html>`
        : `<html><body style="font-family:sans-serif;padding:2rem"><h2>&#x2705; Login successful</h2><p>You can close this tab and return to Claude.</p></body></html>`;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      res.socket?.destroy();

      setImmediate(() => {
        clearTimeout(timeout);
        server.close();
        if (error || !code || !state) {
          reject(new Error(error ?? 'Missing code or state in callback'));
        } else {
          resolve({ code, state });
        }
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${CALLBACK_PORT} is already in use. Stop the conflicting process and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, LISTEN_HOST);

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 5 minutes. Please try van_auth_login again.'));
    }, LOGIN_TIMEOUT_MS);
  });
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  tokenEndpoint: string,
  clientId: string
): Promise<{ access_token: string; refresh_token: string }> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string }>;
}

// ── Pending committee state (survives between tool calls in this process) ───

interface CommitteeOption {
  user: { userId: number; userName: string };
  tenant: { committeeId: number; committeeName: string; stateId: string; tenantUri: string };
}

let pendingCommittees: {
  accessToken: string;
  refreshToken: string;
  options: CommitteeOption[];
} | null = null;

// ── Tool registration ────────────────────────────────────────────────────────

export function registerAuthTools(server: McpServer): void {

  server.tool(
    'van_auth_login',
    'Log in to VAN. Opens a browser for authentication, then returns a list of committees to choose from. ' +
    'If only one committee is available it is selected automatically. ' +
    'Call van_auth_select_committee afterwards when there are multiple options.',
    {},
    async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();

      // 1. Get the Auth0 authorization URL from the VAN backend
      const params = new URLSearchParams({ codeChallenge, redirectUri: REDIRECT_URI, state });
      let configRes: Response;
      try {
        configRes = await fetch(`${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/authUrl?${params}`);
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Network error reaching ${DEFAULT_LOGIN_URL}: ${err.cause?.message ?? err.message}` }] };
      }
      if (!configRes.ok) {
        return { content: [{ type: 'text', text: `Login server returned ${configRes.status}: ${await configRes.text()}` }] };
      }
      const { authorizationUrl, tokenEndpoint, clientId } =
        (await configRes.json()) as { authorizationUrl: string; tokenEndpoint: string; clientId: string };

      // 2. Open browser and wait for callback (blocks up to 5 min)
      const callbackPromise = waitForCallback();
      try {
        openBrowser(authorizationUrl);
      } catch {
        // Non-fatal — user can open URL manually, but we won't have it to show here
      }

      let code: string;
      let returnedState: string;
      try {
        ({ code, state: returnedState } = await callbackPromise);
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Login failed: ${err.message}` }] };
      }

      if (returnedState !== state) {
        return { content: [{ type: 'text', text: 'Login aborted: state mismatch (possible CSRF).' }] };
      }

      // 3. Exchange code for Auth0 tokens
      let accessToken: string;
      let refreshToken: string;
      try {
        const tokens = await exchangeCodeForTokens(code, codeVerifier, tokenEndpoint, clientId);
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token;
        if (!refreshToken) throw new Error('No refresh token returned.');
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Token exchange failed: ${err.message}` }] };
      }

      // 4. Fetch available users / committees from VAN
      let tokenRes: Response;
      try {
        tokenRes = await fetch(`${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: '{}',
        });
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Network error fetching committees from ${DEFAULT_LOGIN_URL}: ${err.cause?.message ?? err.message}` }] };
      }
      if (!tokenRes.ok) {
        return { content: [{ type: 'text', text: `Authentication failed (${tokenRes.status}): ${await tokenRes.text()}` }] };
      }
      const tokenData = (await tokenRes.json()) as { users?: any[]; bearerToken?: string };
      const users: any[] = tokenData.users ?? [];

      const options: CommitteeOption[] = users.flatMap((u: any) =>
        (u.tenants ?? []).map((t: any) => ({ user: u, tenant: t }))
      );

      if (options.length === 0) {
        return { content: [{ type: 'text', text: 'Your account is not linked to any VAN committees. Contact support.' }] };
      }

      // 5a. Only one option — auto-select
      if (options.length === 1 || tokenData.bearerToken) {
        const { user, tenant } = options[0];
        const vanBearerToken = tokenData.bearerToken ?? await fetchVanToken(accessToken, user.userId, tenant.tenantUri);
        saveAccount({ user, tenant, vanBearerToken, refreshToken });
        return { content: [{ type: 'text', text: `Logged in as ${user.userName} / ${tenant.committeeName}. You are ready to use VAN tools.` }] };
      }

      // 5b. Multiple options — store state and return list for user to choose
      pendingCommittees = { accessToken, refreshToken, options };

      const list = options.map((o, i) =>
        `${i + 1}. ${o.user.userName} / ${o.tenant.committeeName} (${o.tenant.stateId})`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Login successful. Please choose a committee by calling van_auth_select_committee with the number:\n\n${list}`,
        }],
      };
    }
  );

  server.tool(
    'van_auth_select_committee',
    'Select a committee from the list returned by van_auth_login. Pass the number shown next to the committee.',
    {
      number: z.number().int().min(1).describe('The committee number shown in the van_auth_login response'),
    },
    async ({ number }) => {
      if (!pendingCommittees) {
        return { content: [{ type: 'text', text: 'No pending login. Please call van_auth_login first.' }] };
      }

      const { accessToken, refreshToken, options } = pendingCommittees;

      if (number < 1 || number > options.length) {
        return { content: [{ type: 'text', text: `Invalid number. Choose between 1 and ${options.length}.` }] };
      }

      const { user, tenant } = options[number - 1];

      let vanBearerToken: string;
      try {
        vanBearerToken = await fetchVanToken(accessToken, user.userId, tenant.tenantUri);
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Failed to get VAN token: ${err.message}` }] };
      }

      saveAccount({ user, tenant, vanBearerToken, refreshToken });
      pendingCommittees = null;

      return { content: [{ type: 'text', text: `Logged in as ${user.userName} / ${tenant.committeeName}. You are ready to use VAN tools.` }] };
    }
  );

  server.tool(
    'van_auth_status',
    'Show the current VAN authentication status — which account is active and all stored accounts.',
    {},
    async () => {
      const accounts = creds.listAccounts();
      if (accounts.length === 0) {
        return { content: [{ type: 'text', text: 'Not logged in. Call van_auth_login to authenticate.' }] };
      }
      const lines = accounts.map(({ key, account, isActive }) => {
        const marker = isActive ? '* ' : '  ';
        return `${marker}${key}  (${account.userName} / ${account.committeeName})`;
      });
      return { content: [{ type: 'text', text: `Stored accounts (* = active):\n\n${lines.join('\n')}` }] };
    }
  );

  server.tool(
    'van_auth_switch',
    'Switch the active VAN committee to a different stored account without re-logging in.',
    {
      account: z.string().describe('Account name/key as shown in van_auth_status'),
    },
    async ({ account }) => {
      const ok = creds.setActiveAccount(account);
      if (!ok) {
        const keys = creds.listAccounts().map(a => a.key).join(', ');
        return { content: [{ type: 'text', text: `Account "${account}" not found. Available: ${keys}` }] };
      }
      return { content: [{ type: 'text', text: `Switched to account: ${account}` }] };
    }
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchVanToken(accessToken: string, userId: number, tenantUri: string): Promise<string> {
  const url = `${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/token?userId=${userId}&tenantUri=${encodeURIComponent(tenantUri)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`VAN token request failed (${res.status})`);
  const data = (await res.json()) as { bearerToken?: string };
  if (!data.bearerToken) throw new Error('No bearer token in response.');
  return data.bearerToken;
}

function saveAccount({ user, tenant, vanBearerToken, refreshToken }: {
  user: { userId: number; userName: string };
  tenant: { committeeName: string; tenantUri: string };
  vanBearerToken: string;
  refreshToken: string;
}) {
  const name = tenant.committeeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  creds.addAccount({
    refreshToken,
    vanBearerToken,
    vanBearerTokenExpiry: creds.bearerTokenExpiry(),
    userId: user.userId,
    userName: user.userName,
    tenantUri: tenant.tenantUri,
    committeeName: tenant.committeeName,
    name,
  });
}
