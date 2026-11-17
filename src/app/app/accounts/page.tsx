import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listAccountsWithEntities } from "@/db/accounts";
import type { EntityType } from "@/db/schema";
import { listAccountAmounts } from "@/db/transactions";
import { listValuations } from "@/db/valuations";
import { todayInSaoPaulo } from "@/domain/date";
import {
  accountBalanceCents,
  formatBalanceCentsToBrl,
} from "@/domain/money";
import { accountBalanceOnDate } from "@/domain/networth";
import { isValuedAccountType } from "@/domain/valuations";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ scope?: string; entity?: string; archived?: string }>;
};

function parseEntityFilter(
  scope: string | undefined,
  entity: string | undefined,
): EntityType | "both" {
  const value = scope ?? entity;
  if (value === "pf" || value === "pj") {
    return value;
  }
  return "both";
}

export default async function AccountsListPage({ searchParams }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const entityFilter = parseEntityFilter(params.scope, params.entity);
  const includeArchived = params.archived === "1";
  const rows = await listAccountsWithEntities(session.user.id, {
    entityType: entityFilter,
    includeArchived,
  });

  const today = todayInSaoPaulo();
  const accountsWithBalances = [];
  for (const account of rows) {
    const amounts =
      (await listAccountAmounts(session.user.id, account.id)) ?? [];
    const valuationRows = isValuedAccountType(account.type)
      ? await listValuations(session.user.id, account.id)
      : [];
    const balanceCents = accountBalanceOnDate(
      {
        type: account.type,
        transactionBalanceCents: accountBalanceCents(amounts),
        acquisitionCostCents: account.acquisitionCostCents,
        valuations: valuationRows,
      },
      today,
    );
    accountsWithBalances.push({ account, balanceCents });
  }

  function hrefForArchived(nextArchived: boolean) {
    const query = new URLSearchParams();
    if (
      params.scope === "pf" ||
      params.scope === "pj" ||
      params.scope === "all"
    ) {
      query.set("scope", params.scope);
    } else if (entityFilter !== "both") {
      query.set("scope", entityFilter);
    }
    if (nextArchived) {
      query.set("archived", "1");
    }
    const qs = query.toString();
    return qs ? `/app/accounts?${qs}` : "/app/accounts";
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.accounts.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="btn btn--card"
            href={hrefForArchived(!includeArchived)}
          >
            {includeArchived
              ? messages.accounts.showArchivedOn
              : messages.accounts.showArchived}
          </Link>
          <Link className="btn btn--ink" href="/app/accounts/new">
            {messages.accounts.create}
          </Link>
        </div>
      </div>

      <section className="sheet p-5 min-[60rem]:p-8">
        {accountsWithBalances.length === 0 ? (
          <div className="flex flex-col gap-2 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {messages.accounts.empty}
            </h2>
            <p className="lbl max-w-xl">{messages.screens.accountsEmptyBody}</p>
            <div className="mt-4">
              <Link className="btn btn--ink" href="/app/accounts/new">
                {messages.accounts.create}
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[36rem]">
              <thead>
                <tr>
                  <th scope="col">{messages.transactions.account}</th>
                  <th scope="col">{messages.accounts.type}</th>
                  <th scope="col">{messages.accounts.entity}</th>
                  <th scope="col">{messages.accounts.institution}</th>
                  <th scope="col" className="num">
                    {messages.accounts.balance}
                  </th>
                </tr>
              </thead>
              <tbody>
                {accountsWithBalances.map(({ account, balanceCents }) => (
                  <tr key={account.id}>
                    <td>
                      <Link
                        className="font-medium text-foreground underline decoration-border underline-offset-[3px] hover:decoration-ring"
                        href={`/app/accounts/${account.id}`}
                      >
                        {messages.accounts.linkLabel(
                          account.name,
                          account.currency,
                        )}
                      </Link>
                      {account.archived ? (
                        <span className="lbl ml-2">
                          ({messages.accounts.archived})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {messages.accounts.types[
                        account.type as keyof typeof messages.accounts.types
                      ] ?? account.type}
                    </td>
                    <td>{account.entity?.name ?? messages.emptyValue}</td>
                    <td>{account.institution || messages.emptyValue}</td>
                    <td
                      className={`num fig ${
                        balanceCents < 0 ? "neg" : "text-foreground"
                      }`}
                    >
                      {formatBalanceCentsToBrl(balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
