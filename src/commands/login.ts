import { DEFAULT_LOGIN_URL } from '../client';
import { runPkceFlow } from '../auth';
import {
  addAccount,
  bearerTokenExpiry,
  accountKey,
  listAccounts,
  type Account,
} from '../credentials';
import { prompt } from '../prompt';

interface VanTenant {
  committeeId: number;
  committeeName: string;
  stateId: string;
  tenantUri: string;
}

interface VanUser {
  userId: number;
  userName: string;
  tenants: VanTenant[];
}

interface TokenResponse {
  users: VanUser[];
  bearerToken?: string;
}

async function selectUserAndCommittee(users: VanUser[], committee?: string): Promise<{ user: VanUser; tenant: VanTenant }> {
  const options: Array<{ user: VanUser; tenant: VanTenant }> = [];
  for (const user of users) {
    for (const tenant of user.tenants) {
      options.push({ user, tenant });
    }
  }

  if (options.length === 0) {
    throw new Error('No committees found for your account.');
  }

  if (options.length === 1) {
    return options[0];
  }

  if (committee) {
    const lower = committee.toLowerCase();
    const exact = options.filter(opt => opt.tenant.committeeName.toLowerCase() === lower);
    if (exact.length === 1) return exact[0];
    const matches = exact.length > 1 ? exact : options.filter(opt => opt.tenant.committeeName.toLowerCase().includes(lower));
    if (matches.length === 0) {
      throw new Error(`No committee found matching "${committee}".`);
    }
    if (matches.length > 1) {
      const names = matches.map(m => `  - ${m.tenant.committeeName}`).join('\n');
      throw new Error(`Multiple committees match "${committee}":\n${names}\nPlease be more specific.`);
    }
    return matches[0];
  }

  const existing = new Set(listAccounts().map(a => a.key));

  console.log('\nSelect a user/committee to add:\n');
  options.forEach((opt, i) => {
    const alreadyStored = existing.has(accountKey({ userName: opt.user.userName, committeeName: opt.tenant.committeeName }));
    const note = alreadyStored ? ' (already stored)' : '';
    console.log(`  ${i + 1}. ${opt.user.userName} / ${opt.tenant.committeeName} (${opt.tenant.stateId})${note}`);
  });
  console.log();

  while (true) {
    const answer = await prompt(`Enter number [1-${options.length}]: `);
    const n = parseInt(answer, 10);
    if (!isNaN(n) && n >= 1 && n <= options.length) {
      return options[n - 1];
    }
    console.log(`Please enter a number between 1 and ${options.length}.`);
  }
}

export async function runLogin(name?: string, committee?: string): Promise<void> {
  console.log('Logging in to VAN...');

  const { accessToken, refreshToken } = await runPkceFlow();

  const tokenRes = await fetch(
    `${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/token`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    }
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error('Authentication failed. Please try again or contact support.');
  }

  const tokenData = (await tokenRes.json()) as TokenResponse;
  const users = tokenData.users ?? [];

  const allCombos = users.flatMap(u => u.tenants.map(t => ({ u, t })));
  if (allCombos.length === 0) {
    console.error('Your ActionID account is not linked to any VAN users or committees.');
    process.exit(1);
  }

  let selectedUser: VanUser;
  let selectedTenant: VanTenant;
  let vanBearerToken: string;

  if (tokenData.bearerToken) {
    const only = allCombos[0];
    selectedUser = only.u;
    selectedTenant = only.t;
    vanBearerToken = tokenData.bearerToken;
  } else {
    const { user, tenant } = await selectUserAndCommittee(users, committee);
    selectedUser = user;
    selectedTenant = tenant;

    const filterRes = await fetch(
      `${DEFAULT_LOGIN_URL}/vanCli/api/v1/vanApi/token` +
      `?userId=${user.userId}&tenantUri=${encodeURIComponent(tenant.tenantUri)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!filterRes.ok) {
      throw new Error('Authentication failed. Please try again or contact support.');
    }

    const filtered = (await filterRes.json()) as TokenResponse;
    if (!filtered.bearerToken) {
      throw new Error('Authentication failed. Please try again or contact support.');
    }
    vanBearerToken = filtered.bearerToken;
  }

  const resolvedName = name ?? selectedTenant.committeeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const account: Account = {
    refreshToken,
    vanBearerToken,
    vanBearerTokenExpiry: bearerTokenExpiry(),
    userId: selectedUser.userId,
    userName: selectedUser.userName,
    tenantUri: selectedTenant.tenantUri,
    committeeName: selectedTenant.committeeName,
    name: resolvedName,
  };

  addAccount(account);

  console.log(`\nLogged in as: ${selectedUser.userName} / ${selectedTenant.committeeName} [${resolvedName}]`);
  console.log('Run "van auth status" to see all stored accounts.');
}
