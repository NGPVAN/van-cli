import chalk from 'chalk';
import { listAccounts, setActiveAccount, findAccountByName } from '../credentials';
import { prompt } from '../prompt';

export async function runSwitch(accountName?: string): Promise<void> {
  if (accountName) {
    const found = await findAccountByName(accountName);
    if (!found) {
      throw new Error(`No account found with name "${accountName}". Run "van auth status" to see stored accounts.`);
    }
    setActiveAccount(found.key);
    console.log(`Default account set to: ${found.account.userName} / ${found.account.committeeName}`);
    return;
  }

  const accounts = await listAccounts();

  if (accounts.length === 0) {
    throw new Error('No accounts stored. Run "van auth login" first.');
  }

  if (accounts.length === 1) {
    const { account } = accounts[0];
    console.log(`Only one account stored, so it's already the default: ${account.userName} / ${account.committeeName}`);
    return;
  }

  console.log('\nStored accounts:\n');
  accounts.forEach(({ account, isActive }, i) => {
    const marker = isActive ? ` ${chalk.green('✓')} (default)` : '';
    const nameLabel = account.name ? chalk.cyan(` [${account.name}]`) : '';
    console.log(`  ${i + 1}. ${account.userName} / ${account.committeeName}${nameLabel}${marker}`);
  });
  console.log();

  let selected: typeof accounts[0];
  while (true) {
    const answer = await prompt(`Enter number [1-${accounts.length}]: `);
    const n = parseInt(answer, 10);
    if (!isNaN(n) && n >= 1 && n <= accounts.length) {
      selected = accounts[n - 1];
      break;
    }
    console.log(`Please enter a number between 1 and ${accounts.length}.`);
  }

  if (selected.isActive) {
    console.log(`\n${selected.account.userName} / ${selected.account.committeeName} is already the default account.`);
    return;
  }

  setActiveAccount(selected.key);
  console.log(`\nDefault account set to: ${selected.account.userName} / ${selected.account.committeeName}`);
}
