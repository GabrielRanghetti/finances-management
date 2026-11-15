import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listAccounts } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import { listTransactions } from "@/db/transactions";
import {
  formatCentsToBrl,
  incomeExpenseTotals,
  totalsByCategory,
} from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    accountId?: string;
    categoryId?: string;
    entity?: string;
  }>;
};

function parseEntity(value: string | undefined): "pf" | "pj" | "both" {
  if (value === "pf" || value === "pj") {
    return value;
  }
  return "both";
}

export default async function TransactionsListPage({ searchParams }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const entityFilter = parseEntity(params.entity);
  const [rows, accounts, categories] = await Promise.all([
    listTransactions(session.user.id, {
      from: params.from,
      to: params.to,
      accountId: params.accountId,
      categoryId: params.categoryId,
      entityType: entityFilter,
    }),
    listAccounts(session.user.id, { includeArchived: true }),
    ensureDefaultCategories(session.user.id),
  ]);

  const accountName = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const periodTotals = incomeExpenseTotals(rows);
  const byCategory = totalsByCategory(rows);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{messages.transactions.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" href="/app/transactions/new/income">
            {messages.transactions.newIncome}
          </Link>
          <Link className="underline" href="/app/transactions/new/expense">
            {messages.transactions.newExpense}
          </Link>
          <Link className="underline" href="/app/transactions/new/transfer">
            {messages.transactions.newTransfer}
          </Link>
        </div>
      </div>

      <form className="grid gap-3 rounded border p-3 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-1">
          {messages.transactions.periodFrom}
          <input
            className="rounded border px-2 py-1"
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1">
          {messages.transactions.periodTo}
          <input
            className="rounded border px-2 py-1"
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1">
          {messages.transactions.account}
          <select
            className="rounded border px-2 py-1"
            name="accountId"
            defaultValue={params.accountId ?? ""}
          >
            <option value="">{messages.transactions.filterAll}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {messages.transactions.category}
          <select
            className="rounded border px-2 py-1"
            name="categoryId"
            defaultValue={params.categoryId ?? ""}
          >
            <option value="">{messages.transactions.filterAll}</option>
            {categories
              .filter((category) => category.parentId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {messages.transactions.entity}
          <select
            className="rounded border px-2 py-1"
            name="entity"
            defaultValue={entityFilter}
          >
            <option value="both">{messages.accounts.filterBoth}</option>
            <option value="pf">{messages.entities.typePf}</option>
            <option value="pj">{messages.entities.typePj}</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="rounded bg-black px-3 py-2 text-white" type="submit">
            {messages.transactions.filter}
          </button>
        </div>
      </form>

      <section className="grid gap-2 text-sm">
        <p>
          {messages.transactions.incomeTotal}:{" "}
          {messages.money(formatCentsToBrl(periodTotals.incomeCents))}
        </p>
        <p>
          {messages.transactions.expenseTotal}:{" "}
          {messages.money(formatCentsToBrl(periodTotals.expenseCents))}
        </p>
        <h2 className="mt-2 font-medium">{messages.transactions.totalsTitle}</h2>
        {byCategory.size === 0 ? (
          <p>{messages.transactions.empty}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...byCategory.entries()].map(([categoryId, total]) => (
              <li key={categoryId}>
                {categoryName.get(categoryId) ?? categoryId}:{" "}
                {messages.money(formatCentsToBrl(total))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length === 0 ? (
        <p>{messages.transactions.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap gap-x-3 gap-y-1 border-b py-2">
              <span>{row.date}</span>
              <span>{accountName.get(row.accountId) ?? row.accountId}</span>
              <span>
                {messages.money(formatCentsToBrl(row.amountCents))}
                {row.transferId
                  ? ` (${messages.transactions.transferTag})`
                  : ""}
              </span>
              <span>{row.description}</span>
              <span className="text-zinc-600">
                {row.categoryId
                  ? categoryName.get(row.categoryId) ?? ""
                  : ""}
              </span>
              <Link className="underline" href={`/app/transactions/${row.id}/edit`}>
                {messages.transactions.edit}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
