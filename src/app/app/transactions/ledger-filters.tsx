"use client";

import { messages } from "@/messages/pt-BR";

type Option = { id: string; name: string };

type Props = {
  month: string;
  scope: string;
  q: string;
  accountId: string;
  categoryId: string;
  accounts: Option[];
  categories: Option[];
};

export function LedgerFilters({
  month,
  scope,
  q,
  accountId,
  categoryId,
  accounts,
  categories,
}: Props) {
  return (
    <form
      method="get"
      action="/app/transactions"
      className="flex w-full flex-wrap items-center gap-3 min-[60rem]:w-auto"
    >
      <input type="hidden" name="month" value={month} />
      {scope !== "all" ? (
        <input type="hidden" name="scope" value={scope} />
      ) : null}

      <input
        className="inp w-full min-[60rem]:w-[220px]"
        type="search"
        name="q"
        aria-label={messages.transactions.searchAria}
        placeholder={messages.transactions.searchPlaceholder}
        defaultValue={q}
      />

      <select
        className="inp w-full min-[60rem]:w-[170px]"
        name="accountId"
        aria-label={messages.transactions.account}
        defaultValue={accountId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="">{messages.transactions.allAccounts}</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

      <select
        className="inp w-full min-[60rem]:w-[190px]"
        name="categoryId"
        aria-label={messages.transactions.category}
        defaultValue={categoryId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="">{messages.transactions.allCategories}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </form>
  );
}
