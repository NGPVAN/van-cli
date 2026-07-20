import * as crypto from 'crypto';
import * as http from 'http';
import { execFile } from 'child_process';
import { CALLBACK_PORT } from './config';
import { DEFAULT_LOGIN_URL } from './client';
import { fetchAuthConfig } from './authConfig';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface DeviceTokenErrorResponse {
  error: string;
  error_description?: string;
}

const CALLBACK_PATH = '/callback';
const LISTEN_HOST = '127.0.0.1';
const LOCALHOST_BASE = 'http://localhost';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const GRANT_TYPE_AUTH_CODE = 'authorization_code';
const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
const GRANT_TYPE_DEVICE_CODE = 'urn:ietf:params:oauth:grant-type:device_code';
const DEVICE_CODE_DEFAULT_POLL_INTERVAL_SECONDS = 5;
const DEVICE_CODE_SLOW_DOWN_INCREMENT_MS = 5000;
const LOGIN_SCOPE = 'openid profile email offline_access ngpvan.cli.bearer';
const REDIRECT_URI = `http://${LISTEN_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function callbackHtml(error: string | null): string {
  return `<html><body style="font-family:sans-serif;padding:2rem">
  <h2>${error ? '&#x274C; Login failed' : '&#x2705; Login successful'}</h2>
  <p>${error ? `Error: ${escapeHtml(error)}` : 'You can close this tab and return to the terminal.'}</p>
</body></html>`;
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function openBrowser(url: string): void {
  // Validate the URL is HTTPS before handing it to the OS — guards against a compromised server response.
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Authorization URL must use HTTPS.');
  }

  if (process.platform === 'win32') {
    // rundll32 is a real executable (not a cmd.exe builtin like `start`), so this goes
    // straight to CreateProcess with an argument array — no shell ever parses the URL.
    execFile('rundll32', ['url.dll,FileProtocolHandler', url]);
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

async function waitForCallback(port: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '', LOCALHOST_BASE);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(callbackHtml(error));
      // Destroy the socket immediately so server.close() can fully release the
      // libuv handle. Without this, keep-alive connections keep the handle open
      // and trigger a libuv assertion when the process exits on Windows.
      res.socket?.destroy();

      setImmediate(() => {
        clearTimeout(timeout);
        server.close();
        if (error || !code || !state) {
          reject(new Error(error ?? 'Missing code or state in callback'));
          return;
        }
        resolve({ code, state });
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the conflicting process and try again.`));
      } else {
        reject(err);
      }
    });
    server.listen(port, LISTEN_HOST);

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out. Please try again.'));
    }, LOGIN_TIMEOUT_MS);
  });
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  tokenEndpoint: string,
  clientId: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: GRANT_TYPE_AUTH_CODE,
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export interface PkceFlowResult {
  accessToken: string;
  refreshToken: string;
}

export async function runPkceFlow(): Promise<PkceFlowResult> {
  const { domain, clientId, audience } = await fetchAuthConfig(DEFAULT_LOGIN_URL);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  const tokenEndpoint = `${domain}/oauth/token`;

  const authorizationUrl =
    `${domain}/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&scope=${encodeURIComponent(LOGIN_SCOPE)}` +
    `&audience=${encodeURIComponent(audience)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    '&code_challenge_method=S256' +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(state)}`;

  // Start listening before opening the browser to avoid missing the callback.
  const callbackPromise = waitForCallback(CALLBACK_PORT);

  console.log('\nOpening browser for login...');
  console.log(`If the browser does not open, navigate to:\n  ${authorizationUrl}\n`);
  openBrowser(authorizationUrl);

  const { code, state: returnedState } = await callbackPromise;

  if (returnedState !== state) {
    throw new Error('State mismatch — possible CSRF attack. Login aborted.');
  }

  const tokens = await exchangeCodeForTokens(
    code, codeVerifier, REDIRECT_URI, tokenEndpoint, clientId
  );

  if (!tokens.refresh_token) {
    throw new Error('Authentication failed. Please try again or contact support.');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

async function requestDeviceCode(domain: string, clientId: string, audience: string): Promise<DeviceCodeResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: LOGIN_SCOPE,
    audience,
  });

  const res = await fetch(`${domain}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Device code request failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

// Polls per RFC 8628 §3.5: keep retrying on authorization_pending, back off on slow_down,
// and stop on any other error (expired_token, access_denied, or an unexpected response).
async function pollForDeviceToken(
  domain: string,
  clientId: string,
  device: DeviceCodeResponse
): Promise<TokenResponse> {
  const deadline = Date.now() + device.expires_in * 1000;
  let intervalMs = (device.interval ?? DEVICE_CODE_DEFAULT_POLL_INTERVAL_SECONDS) * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    const params = new URLSearchParams({
      grant_type: GRANT_TYPE_DEVICE_CODE,
      device_code: device.device_code,
      client_id: clientId,
    });

    const res = await fetch(`${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (res.ok) {
      return res.json() as Promise<TokenResponse>;
    }

    const body = (await res.json().catch(() => ({}))) as Partial<DeviceTokenErrorResponse>;

    if (body.error === 'slow_down') {
      intervalMs += DEVICE_CODE_SLOW_DOWN_INCREMENT_MS;
      continue;
    }
    if (body.error === 'authorization_pending') {
      continue;
    }
    if (body.error === 'access_denied') {
      throw new Error('Login was denied.');
    }
    if (body.error === 'expired_token') {
      break;
    }

    throw new Error(`Token exchange failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown error'}`);
  }

  throw new Error('Login timed out. Please try again.');
}

// Device authorization flow (RFC 8628): no local server or browser redirect required, so
// this works over SSH/in containers where a loopback redirect can't reach the user's browser.
export async function runDeviceCodeFlow(): Promise<PkceFlowResult> {
  const { domain, clientId, audience } = await fetchAuthConfig(DEFAULT_LOGIN_URL);
  const device = await requestDeviceCode(domain, clientId, audience);

  console.log(`\nTo log in, open:\n  ${device.verification_uri}\n\nAnd enter this code: ${device.user_code}\n`);
  console.log('Waiting for login to complete...');

  const tokens = await pollForDeviceToken(domain, clientId, device);

  if (!tokens.refresh_token) {
    throw new Error('Authentication failed. Please try again or contact support.');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

// Refreshes the access token directly against the identity provider — no VAN backend
// involved. The resulting access token still needs to be exchanged for a VAN bearer
// token via fetchVanToken().
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const { domain, clientId } = await fetchAuthConfig(DEFAULT_LOGIN_URL);

  const params = new URLSearchParams({
    grant_type: GRANT_TYPE_REFRESH_TOKEN,
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }

  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.refresh_token) {
    throw new Error('Identity provider did not return a rotated refresh token.');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

// Revokes the refresh token with the identity provider on logout, so a copy of it (an
// old backup, a stolen credentials file) stops working immediately rather than staying
// valid until it would have naturally expired.
export async function revokeToken(refreshToken: string): Promise<void> {
  const { domain, clientId } = await fetchAuthConfig(DEFAULT_LOGIN_URL);

  const res = await fetch(`${domain}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, token: refreshToken }),
  });

  if (!res.ok) {
    throw new Error(`Token revocation failed (${res.status})`);
  }
}
