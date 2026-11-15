/** Net worth is the sum of account balances (liabilities are negative). */
export function netWorthCents(accountBalances: readonly number[]): number {
  return accountBalances.reduce((sum, balance) => sum + balance, 0);
}
