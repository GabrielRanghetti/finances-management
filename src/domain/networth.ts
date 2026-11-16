import {
  isValuedAccountType,
  valuedBalanceOnDate,
  type ValuationPoint,
} from "./valuations";

export type NetWorthAccount = {
  type: string;
  /** Sum of ledger transactions (used for non-valued account types). */
  transactionBalanceCents: number;
  acquisitionCostCents?: number | null;
  valuations?: readonly ValuationPoint[];
};

/** Balance of one account on asOfDate. */
export function accountBalanceOnDate(
  account: NetWorthAccount,
  asOfDate: string,
): number {
  if (isValuedAccountType(account.type)) {
    return valuedBalanceOnDate(
      asOfDate,
      account.acquisitionCostCents,
      account.valuations ?? [],
    );
  }
  return account.transactionBalanceCents;
}

/** Net worth on asOfDate: assets minus liabilities (loans/cards are negative). */
export function netWorthCents(
  accounts: readonly NetWorthAccount[],
  asOfDate: string,
): number {
  return accounts.reduce(
    (sum, account) => sum + accountBalanceOnDate(account, asOfDate),
    0,
  );
}
