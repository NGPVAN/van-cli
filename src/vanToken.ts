export interface VanTenant {
  committeeName: string;
  stateId: string;
  tenantUri: string;
}

export interface VanUser {
  userId: number;
  userName: string;
  tenants: VanTenant[];
}

export interface VanTokenResponse {
  users: VanUser[];
  bearerToken?: string;
}

export interface VanTokenFilter {
  userId?: number;
  tenantUri?: string;
}

// Mints a VAN bearer token from an identity provider access token. This requires VAN's
// user/tenant database, so unlike the rest of the auth flow it can't be done client-side.
export async function fetchVanToken(
  loginUrl: string,
  accessToken: string,
  filter: VanTokenFilter = {}
): Promise<VanTokenResponse> {
  const res = await fetch(`${loginUrl}/vanCli/api/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filter),
  });

  if (!res.ok) {
    throw new Error('Authentication failed. Please try again or contact support.');
  }

  return res.json() as Promise<VanTokenResponse>;
}
