import { DEFAULT_LOGIN_URL } from '../client';
import { runPkceFlow, runDeviceCodeFlow } from '../auth';
import { fetchVanToken, type VanUser, type VanTenant } from '../vanToken';
import {
  addAccount,
  bearerTokenExpiry,
  accountKey,
  listAccounts,
  type Account,
} from '../credentials';
import { prompt } from '../prompt';

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

  const existing = new Set((await listAccounts()).map(a => a.key));

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

export async function runLogin(name?: string, committee?: string, deviceCode?: boolean): Promise<void> {
  console.log('Logging in to VAN...');

  const { accessToken, refreshToken } = deviceCode ? await runDeviceCodeFlow() : await runPkceFlow();

  const tokenData = await fetchVanToken(DEFAULT_LOGIN_URL, accessToken);
  const users = tokenData.users ?? [];

  const allCombos = users.flatMap(u => u.tenants.map(t => ({ u, t })));
  if (allCombos.length === 0) {
    throw new Error('Your ActionID account is not linked to any VAN users or committees.');
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

    const filtered = await fetchVanToken(DEFAULT_LOGIN_URL, accessToken, {
      userId: user.userId,
      tenantUri: tenant.tenantUri,
    });
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

  await addAccount(account);

  console.log(`\nLogged in as: ${selectedUser.userName} / ${selectedTenant.committeeName} [${resolvedName}]`);
  console.log('Run "van auth status" to see all stored accounts.');
}
