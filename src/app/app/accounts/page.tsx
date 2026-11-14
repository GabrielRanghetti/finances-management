import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listAccounts } from "@/db/accounts";
import { auth } from "@/lib/auth";

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
      <h1 className="text-2xl font-semibold">Contas</h1>
      {rows.length === 0 ? (
        <p>Nenhuma conta.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((account) => (
            <li key={account.id}>
              <Link className="underline" href={`/app/accounts/${account.id}`}>
                {account.name} ({account.currency})
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
