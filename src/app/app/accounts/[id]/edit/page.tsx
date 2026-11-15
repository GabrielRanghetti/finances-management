import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { updateAccountAction } from "../../actions";
import { AccountForm } from "../../account-form";
import { getAccount } from "@/db/accounts";
import { listEntities } from "@/db/entities";
import type { AccountType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAccountPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const account = await getAccount(session.user.id, id);
  if (!account) {
    notFound();
  }

  const entities = await listEntities(session.user.id);
  const action = updateAccountAction.bind(null, account.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.accounts.edit}</h1>
      <AccountForm
        action={action}
        entities={entities}
        defaults={{
          name: account.name,
          type: account.type as AccountType,
          currency: account.currency,
          entityId: account.entityId,
          institution: account.institution,
        }}
      />
    </main>
  );
}
