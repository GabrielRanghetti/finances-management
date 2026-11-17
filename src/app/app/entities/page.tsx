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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.entities.title}
        </h1>
        <Link className="btn btn--ink" href="/app/entities/new">
          {messages.entities.create}
        </Link>
      </div>

      <section className="sheet p-5 min-[60rem]:p-8">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-2 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {messages.entities.empty}
            </h2>
            <p className="lbl max-w-xl">{messages.screens.entitiesEmptyBody}</p>
            <div className="mt-4">
              <Link className="btn btn--ink" href="/app/entities/new">
                {messages.entities.create}
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{messages.entities.name}</th>
                  <th scope="col">{messages.entities.type}</th>
                  <th scope="col">{messages.entities.documentNumber}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entity) => (
                  <tr key={entity.id}>
                    <td>
                      <Link
                        className="font-medium"
                        href={`/app/entities/${entity.id}/edit`}
                      >
                        {entity.name}
                      </Link>
                    </td>
                    <td>
                      {entity.type === "pj"
                        ? messages.entities.typePj
                        : messages.entities.typePf}
                    </td>
                    <td className="fig">
                      {entity.documentNumber || messages.emptyValue}
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
