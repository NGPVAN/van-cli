import * as crypto from 'crypto';
import * as http from 'http';
import { exec, execFile } from 'child_process';
import { CALLBACK_PORT } from './config';
import { DEFAULT_LOGIN_URL } from './client';

export interface PkceAuthUrlResponse {
  authorizationUrl: string;
  tokenEndpoint: string;
  clientId: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

const CALLBACK_PATH = '/callback';
const LISTEN_HOST = '127.0.0.1';
const LOCALHOST_BASE = 'http://localhost';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const GRANT_TYPE_AUTH_CODE = 'authorization_code';
const REDIRECT_URI = `http://${LISTEN_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

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
  // Validate the URL is HTTPS before passing to the shell — guards against a compromised server response.
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Authorization URL must use HTTPS.');
  }

  if (process.platform === 'win32') {
    // On Windows, use exec with the URL double-quoted so cmd.exe treats & in query strings as literal.
    // execFile passes args unquoted, causing & to be parsed as a command separator.
    exec(`start "" "${url}"`);
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
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const params = new URLSearchParams({ codeChallenge, redirectUri: REDIRECT_URI, state });
  let configRes: Response;
  try {
    configRes = await fetch(
      `${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/authUrl?${params}`
    );
  } catch (err: any) {
    throw new Error(`Failed to reach login server at ${DEFAULT_LOGIN_URL}: ${err.cause?.message ?? err.message}`);
  }

  if (!configRes.ok) {
    throw new Error(`Failed to get authorization URL from server (${configRes.status})`);
  }

  const { authorizationUrl, tokenEndpoint, clientId } =
    (await configRes.json()) as PkceAuthUrlResponse;

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
