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

function formatSyncDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day}/${month}/${year}`;
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
  const entityName = new Map(
    entities.map((entity) => [entity.id, entity.name]),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.connections.title}
        </h1>
        <Link className="btn btn--ink" href="/app/connections/new">
          {messages.connections.create}
        </Link>
      </div>

      <section className="sheet p-5 min-[60rem]:p-8">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-2 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {messages.connections.empty}
            </h2>
            <p className="lbl max-w-xl">
              {messages.screens.connectionsEmptyBody}
            </p>
            <div className="mt-4">
              <Link className="btn btn--ink" href="/app/connections/new">
                {messages.connections.create}
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{messages.connections.provider}</th>
                  <th scope="col">{messages.connections.entity}</th>
                  <th scope="col">{messages.connections.status}</th>
                  <th scope="col" className="num">
                    {messages.connections.lastSync}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="font-medium"
                        href={`/app/connections/${row.id}`}
                      >
                        {row.provider}
                      </Link>
                    </td>
                    <td>{entityName.get(row.entityId) ?? row.entityId}</td>
                    <td>
                      <span
                        className={
                          row.status === "error" || row.status === "expired"
                            ? "neg font-medium"
                            : "text-foreground"
                        }
                      >
                        {statusLabel(row.status)}
                      </span>
                      {row.lastError ? (
                        <p className="neg mt-1 text-xs">{row.lastError}</p>
                      ) : null}
                    </td>
                    <td className="num fig">
                      {row.lastSyncAt
                        ? formatSyncDate(row.lastSyncAt)
                        : messages.emptyValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
