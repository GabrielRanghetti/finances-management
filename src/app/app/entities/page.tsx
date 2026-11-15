import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listEntities } from "@/db/entities";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function EntitiesListPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const rows = await listEntities(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{messages.entities.title}</h1>
        <Link className="underline" href="/app/entities/new">
          {messages.entities.create}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p>{messages.entities.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((entity) => (
            <li key={entity.id}>
              <Link className="underline" href={`/app/entities/${entity.id}/edit`}>
                {messages.entities.linkLabel(
                  entity.name,
                  entity.type === "pj"
                    ? messages.entities.typePj
                    : messages.entities.typePf,
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
