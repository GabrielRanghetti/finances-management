import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listConnections } from "@/db/connections";
import { listEntities } from "@/db/entities";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "error") {
    return messages.connections.statusError;
  }
  if (status === "expired") {
    return messages.connections.statusExpired;
  }
  return messages.connections.statusActive;
}

export default async function ConnectionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const [rows, entities] = await Promise.all([
    listConnections(session.user.id),
    listEntities(session.user.id),
  ]);
  const entityName = new Map(entities.map((entity) => [entity.id, entity.name]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{messages.connections.title}</h1>
        <Link className="text-sm underline" href="/app/connections/new">
          {messages.connections.create}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600">{messages.connections.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link className="font-medium underline" href={`/app/connections/${row.id}`}>
                  {row.provider} · {entityName.get(row.entityId) ?? row.entityId}
                </Link>
                <span>{statusLabel(row.status)}</span>
              </div>
              {row.lastError ? (
                <p className="mt-2 text-red-700">{row.lastError}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
