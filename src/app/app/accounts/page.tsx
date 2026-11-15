import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listAccountsWithEntities } from "@/db/accounts";
import type { EntityType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ entity?: string; archived?: string }>;
};

function parseEntityFilter(value: string | undefined): EntityType | "both" {
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
  const entityFilter = parseEntityFilter(params.entity);
  const includeArchived = params.archived === "1";
  const rows = await listAccountsWithEntities(session.user.id, {
    entityType: entityFilter,
    includeArchived,
  });

  function hrefFor(next: { entity?: string; archived?: boolean }) {
    const entity = next.entity ?? entityFilter;
    const archived = next.archived ?? includeArchived;
    const query = new URLSearchParams();
    if (entity !== "both") {
      query.set("entity", entity);
    }
    if (archived) {
      query.set("archived", "1");
    }
    const qs = query.toString();
    return qs ? `/app/accounts?${qs}` : "/app/accounts";
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{messages.accounts.title}</h1>
        <Link className="underline" href="/app/accounts/new">
          {messages.accounts.create}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span>{messages.accounts.filterEntity}:</span>
        <Link
          className={entityFilter === "both" ? "font-semibold underline" : "underline"}
          href={hrefFor({ entity: "both" })}
        >
          {messages.accounts.filterBoth}
        </Link>
        <Link
          className={entityFilter === "pf" ? "font-semibold underline" : "underline"}
          href={hrefFor({ entity: "pf" })}
        >
          {messages.entities.typePf}
        </Link>
        <Link
          className={entityFilter === "pj" ? "font-semibold underline" : "underline"}
          href={hrefFor({ entity: "pj" })}
        >
          {messages.entities.typePj}
        </Link>
        <Link
          className="ml-auto underline"
          href={hrefFor({ archived: !includeArchived })}
        >
          {messages.accounts.showArchived}
          {includeArchived ? " ✓" : ""}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p>{messages.accounts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((account) => (
            <li key={account.id} className="flex flex-wrap items-baseline gap-2">
              <Link className="underline" href={`/app/accounts/${account.id}`}>
                {messages.accounts.linkLabel(account.name, account.currency)}
              </Link>
              <span className="text-sm text-zinc-600">
                {messages.accounts.types[account.type as keyof typeof messages.accounts.types] ??
                  account.type}
                {account.entity
                  ? ` · ${account.entity.name}`
                  : ""}
                {account.archived ? ` · ${messages.accounts.archived}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
