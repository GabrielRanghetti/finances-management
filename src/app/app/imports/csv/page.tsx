import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CsvImportForm } from "./csv-import-form";
import { listAccounts } from "@/db/accounts";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function CsvImportPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const accounts = await listAccounts(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.imports.csvTitle}
        </h1>
        <Link className="btn btn--card" href="/app/imports">
          {messages.imports.cancel}
        </Link>
      </div>
      <CsvImportForm
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
        }))}
      />
    </main>
  );
}
