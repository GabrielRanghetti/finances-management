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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet flex flex-col gap-6 p-6 min-[60rem]:p-8">
        <h1 className="text-[1.44rem] font-semibold tracking-tight text-foreground">
          {messages.accounts.create}
        </h1>
        <AccountForm action={createAccountAction} entities={entities} />
      </section>
    </main>
  );
}
