import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { archiveAccountAction } from "../actions";
import { getAccountWithEntity } from "@/db/accounts";
import { listAccountAmounts } from "@/db/transactions";
import type { AccountType } from "@/db/schema";
import { accountBalanceCents, formatCentsToBrl } from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const account = await getAccountWithEntity(session.user.id, id);

  if (!account) {
    notFound();
  }

  const amounts = (await listAccountAmounts(session.user.id, account.id)) ?? [];
  const balanceCents = accountBalanceCents(amounts);
  const archive = archiveAccountAction.bind(null, account.id);
  const typeLabel =
    messages.accounts.types[account.type as AccountType] ?? account.type;

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
    </main>
  );
}
