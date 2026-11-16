import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OfxImportForm } from "./ofx-import-form";
import { listAccounts } from "@/db/accounts";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function OfxImportPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const accounts = await listAccounts(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{messages.imports.ofxTitle}</h1>
        <Link className="text-sm underline" href="/app/imports">
          {messages.imports.cancel}
        </Link>
      </div>
      <OfxImportForm
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
        }))}
      />
    </main>
  );
}
