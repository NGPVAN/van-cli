export interface AuthConfig {
  domain: string;
  clientId: string;
  audience: string;
}

// The CLI is a public OAuth client (PKCE, no client secret), so once it has these
// values it talks to the identity provider directly instead of proxying every auth
// request through VAN. None of these values are secret.
export async function fetchAuthConfig(loginUrl: string): Promise<AuthConfig> {
  let res: Response;
  try {
    res = await fetch(`${loginUrl}/vanCli/api/v1/authConfig`);
  } catch (err: any) {
    throw new Error(`Failed to reach login server at ${loginUrl}: ${err.cause?.message ?? err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to get auth configuration from server (${res.status})`);
  }

  return res.json() as Promise<AuthConfig>;
}
