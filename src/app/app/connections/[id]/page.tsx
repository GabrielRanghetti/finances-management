import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SyncPanel } from "./sync-panel";
import { getConnection, listConnectionAccountMaps } from "@/db/connections";
import { getEntity } from "@/db/entities";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ synced?: string }>;
};

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

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const connection = await getConnection(session.user.id, id);
  if (!connection) {
    notFound();
  }

  const entity = await getEntity(session.user.id, connection.entityId);
  const maps = await listConnectionAccountMaps(session.user.id, connection.id);
  const synced = query.synced ? Number(query.synced) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <article className="sheet p-6 min-[60rem]:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {connection.provider} · {entity?.name ?? messages.emptyValue}
          </h1>
          <div className="flex flex-wrap gap-3">
            <Link
              className={`btn ${maps.length === 0 ? "btn--ink" : "btn--card"}`}
              href={`/app/connections/${connection.id}/map`}
            >
              {messages.connections.mapAccounts}
            </Link>
            <Link className="btn btn--card" href="/app/connections">
              {messages.connections.cancel}
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2 min-[60rem]:grid-cols-3">
          <div>
            <dt className="lbl">{messages.connections.status}</dt>
            <dd
              className={`mt-0.5 font-medium ${
                connection.status === "error" || connection.status === "expired"
                  ? "neg"
                  : "text-foreground"
              }`}
            >
              {statusLabel(connection.status)}
            </dd>
          </div>
          <div>
            <dt className="lbl">{messages.connections.lastSync}</dt>
            <dd className="fig mt-0.5 font-medium text-foreground">
              {connection.lastSyncAt
                ? formatSyncDate(connection.lastSyncAt)
                : messages.emptyValue}
            </dd>
          </div>
          {connection.lastError ? (
            <div>
              <dt className="lbl">{messages.connections.lastError}</dt>
              <dd className="neg mt-0.5 font-medium">{connection.lastError}</dd>
            </div>
          ) : null}
        </dl>

        {synced !== null && Number.isFinite(synced) ? (
          <p className="lbl mt-4">{messages.connections.synced(synced)}</p>
        ) : null}

        {maps.length > 0 ? (
          <div className="mt-8 border-t border-border pt-6">
            <SyncPanel connectionId={connection.id} />
          </div>
        ) : null}
      </article>
    </main>
  );
}
