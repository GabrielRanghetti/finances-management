import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MapAccountsForm } from "./map-form";
import {
  getConnection,
  listConnectionAccountMaps,
} from "@/db/connections";
import { listAccounts } from "@/db/accounts";
import { loadPluggyAccountsForMapping } from "../../actions";
import { accountTypes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MapConnectionAccountsPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const connection = await getConnection(session.user.id, id);
  if (!connection) {
    notFound();
  }

  const [accounts, maps, loaded] = await Promise.all([
    listAccounts(session.user.id, { includeArchived: true }),
    listConnectionAccountMaps(session.user.id, connection.id),
    loadPluggyAccountsForMapping(connection.id),
  ]);

  const entityAccounts = accounts.filter(
    (account) => account.entityId === connection.entityId,
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet p-6 min-[60rem]:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {messages.connections.mapAccounts}
          </h1>
          <Link
            className="btn btn--card"
            href={`/app/connections/${connection.id}`}
          >
            {messages.connections.cancel}
          </Link>
        </div>

        {"error" in loaded && loaded.error ? (
          <div role="alert" className="mt-6 border-t border-border pt-6">
            <p className="neg text-sm font-medium">{loaded.error}</p>
            <p className="lbl mt-1">{messages.overview.errorUnchanged}</p>
          </div>
        ) : (
          <div className="mt-6 border-t border-border pt-6">
            <MapAccountsForm
              connectionId={connection.id}
              pluggyAccounts={
                "pluggyAccounts" in loaded ? loaded.pluggyAccounts! : []
              }
              appAccounts={entityAccounts.map((account) => ({
                id: account.id,
                name: account.name,
              }))}
              existingMaps={Object.fromEntries(
                maps.map((map) => [map.pluggyAccountId, map.accountId]),
              )}
              accountTypes={[...accountTypes]}
            />
          </div>
        )}
      </section>
    </main>
  );
}
