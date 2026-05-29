import { removeAccount, listAccounts, findAccountByName } from '../credentials';
import { prompt } from '../prompt';

export async function runLogout(accountName?: string): Promise<void> {
  const accounts = listAccounts();

  if (accounts.length === 0) {
    console.log('Not currently logged in.');
    return;
  }

  let selected: typeof accounts[0];

  if (accountName) {
    const found = findAccountByName(accountName);
    if (!found) {
      throw new Error(`No account found with name "${accountName}". Run "van auth status" to see stored accounts.`);
    }
    selected = accounts.find(a => a.key === found.key)!;
  } else if (accounts.length === 1) {
    selected = accounts[0];
  } else {
    console.log('\nSelect an account to log out:\n');
    accounts.forEach(({ account, isActive }, i) => {
      const nameLabel = account.name ? ` [${account.name}]` : '';
      const activeLabel = isActive ? ' (active)' : '';
      console.log(`  ${i + 1}. ${account.userName} / ${account.committeeName}${nameLabel}${activeLabel}`);
    });
    console.log();

    while (true) {
      const answer = await prompt(`Enter number [1-${accounts.length}]: `);
      const n = parseInt(answer, 10);
      if (!isNaN(n) && n >= 1 && n <= accounts.length) {
        selected = accounts[n - 1];
        break;
      }
      console.log(`Please enter a number between 1 and ${accounts.length}.`);
    }
  }

  removeAccount(selected.key);
  console.log(`Logged out: ${selected.account.userName} / ${selected.account.committeeName}`);

  if (accounts.length > 1) {
    console.log('Run "van auth switch" to select an active account.');
  }
}
