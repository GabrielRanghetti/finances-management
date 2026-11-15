import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { archiveAccountAction } from "../actions";
import { getAccountWithEntity } from "@/db/accounts";
import {
  listAccountAmounts,
  listTransactions,
} from "@/db/transactions";
import type { AccountType } from "@/db/schema";
import {
  statementPeriodContaining,
  statementTotalCents,
} from "@/domain/installments";
import { accountBalanceCents, formatCentsToBrl } from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ statementDate?: string }>;
};

export default async function AccountDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const account = await getAccountWithEntity(session.user.id, id);

  if (!account) {
    notFound();
  }

  const amounts = (await listAccountAmounts(session.user.id, account.id)) ?? [];
  const balanceCents = accountBalanceCents(amounts);
  const archive = archiveAccountAction.bind(null, account.id);
  const typeLabel =
    messages.accounts.types[account.type as AccountType] ?? account.type;

  const today = new Date().toISOString().slice(0, 10);
  const statementDate = query.statementDate || today;
  const statement =
    account.type === "credit_card" && account.closingDay
      ? statementPeriodContaining(account.closingDay, statementDate)
      : null;
  const statementRows = statement
    ? await listTransactions(session.user.id, {
        accountId: account.id,
        from: statement.from,
        to: statement.to,
      })
    : [];
  const statementTotal = statement
    ? statementTotalCents(statementRows.map((row) => row.amountCents))
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <Link className="underline" href={`/app/accounts/${account.id}/edit`}>
          {messages.accounts.edit}
        </Link>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">{messages.accounts.balance}</dt>
          <dd>{messages.money(formatCentsToBrl(balanceCents))}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.type}</dt>
          <dd>{typeLabel}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.currency}</dt>
          <dd>{account.currency}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.institution}</dt>
          <dd>{account.institution || messages.emptyValue}</dd>
        </div>
        {account.type === "credit_card" ? (
          <div>
            <dt className="font-medium">{messages.accounts.closingDay}</dt>
            <dd>{account.closingDay ?? messages.emptyValue}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium">{messages.accounts.entity}</dt>
          <dd>
            {account.entity
              ? messages.entities.linkLabel(
                  account.entity.name,
                  account.entity.type === "pj"
                    ? messages.entities.typePj
                    : messages.entities.typePf,
                )
              : messages.emptyValue}
          </dd>
        </div>
        {account.archived ? (
          <div>
            <dt className="font-medium">{messages.accounts.archived}</dt>
            <dd>{messages.accounts.archivedYes}</dd>
          </div>
        ) : null}
      </dl>
      {!account.archived ? (
        <form action={archive}>
          <button className="rounded border px-3 py-2 text-sm" type="submit">
            {messages.accounts.archive}
          </button>
        </form>
      ) : null}

      {statement ? (
        <section className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-xl font-semibold">{messages.accounts.statement}</h2>
          <form className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {messages.accounts.statementDate}
              <input
                className="rounded border px-2 py-1"
                type="date"
                name="statementDate"
                defaultValue={statementDate}
              />
            </label>
            <button className="rounded bg-black px-3 py-2 text-white" type="submit">
              {messages.transactions.filter}
            </button>
          </form>
          <p className="text-sm">
            {messages.accounts.statementPeriod(statement.from, statement.to)}
          </p>
          <p className="text-sm">
            {messages.accounts.statementTotal}:{" "}
            {messages.money(formatCentsToBrl(statementTotal))}
          </p>
          {statementRows.length === 0 ? (
            <p className="text-sm">{messages.accounts.statementEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {statementRows.map((row) => (
                <li key={row.id} className="flex flex-wrap gap-x-3 border-b py-2">
                  <span>{row.date}</span>
                  <span>{messages.money(formatCentsToBrl(row.amountCents))}</span>
                  <span>{row.description}</span>
                  <Link
                    className="underline"
                    href={`/app/transactions/${row.id}/edit`}
                  >
                    {messages.transactions.edit}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
