import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listAccounts } from "@/db/accounts";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function AccountsListPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const rows = await listAccounts(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.accounts.title}</h1>
      {rows.length === 0 ? (
        <p>{messages.accounts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((account) => (
            <li key={account.id}>
              <Link className="underline" href={`/app/accounts/${account.id}`}>
                {messages.accounts.linkLabel(account.name, account.currency)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
