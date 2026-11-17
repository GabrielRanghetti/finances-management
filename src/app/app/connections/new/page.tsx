import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConnectionForm } from "./connection-form";
import { listEntities } from "@/db/entities";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewConnectionPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const entities = await listEntities(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet max-w-2xl p-6 min-[60rem]:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.connections.create}
        </h1>
        <div className="mt-6">
          <ConnectionForm
            entities={entities.map((entity) => ({
              id: entity.id,
              name: entity.name,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
