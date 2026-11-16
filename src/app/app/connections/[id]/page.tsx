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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {connection.provider} · {entity?.name ?? messages.emptyValue}
        </h1>
        <Link className="text-sm underline" href="/app/connections">
          {messages.connections.cancel}
        </Link>
      </div>

      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">{messages.connections.status}</dt>
          <dd>{statusLabel(connection.status)}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.connections.lastSync}</dt>
          <dd>
            {connection.lastSyncAt
              ? connection.lastSyncAt.toISOString()
              : messages.emptyValue}
          </dd>
        </div>
        {connection.lastError ? (
          <div>
            <dt className="font-medium">{messages.connections.lastError}</dt>
            <dd className="text-red-700">{connection.lastError}</dd>
          </div>
        ) : null}
      </dl>

      {synced !== null && Number.isFinite(synced) ? (
        <p className="text-sm">{messages.connections.synced(synced)}</p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href={`/app/connections/${connection.id}/map`}>
          {messages.connections.mapAccounts}
        </Link>
      </div>

      {maps.length > 0 ? <SyncPanel connectionId={connection.id} /> : null}
    </main>
  );
}
