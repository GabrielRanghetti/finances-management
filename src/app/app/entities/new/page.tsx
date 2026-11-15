import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createEntityAction } from "../actions";
import { EntityForm } from "../entity-form";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewEntityPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.entities.create}</h1>
      <EntityForm action={createEntityAction} />
    </main>
  );
}
