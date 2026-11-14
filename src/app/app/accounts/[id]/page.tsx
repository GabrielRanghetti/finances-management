import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAccount } from "@/db/accounts";
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
  const account = await getAccount(session.user.id, id);

  if (!account) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{account.name}</h1>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">{messages.accounts.type}</dt>
          <dd>{account.type}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.currency}</dt>
          <dd>{account.currency}</dd>
        </div>
      </dl>
    </main>
  );
}
