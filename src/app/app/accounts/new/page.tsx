import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAccountAction } from "../actions";
import { AccountForm } from "../account-form";
import { listEntities } from "@/db/entities";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const entities = await listEntities(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.accounts.create}</h1>
      <AccountForm action={createAccountAction} entities={entities} />
    </main>
  );
}
