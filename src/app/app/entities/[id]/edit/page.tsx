import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { updateEntityAction } from "../../actions";
import { EntityForm } from "../../entity-form";
import { getEntity } from "@/db/entities";
import type { EntityType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditEntityPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const entity = await getEntity(session.user.id, id);

  if (!entity) {
    notFound();
  }

  const action = updateEntityAction.bind(null, entity.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet max-w-2xl p-6 min-[60rem]:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.entities.edit}
        </h1>
        <div className="mt-6">
          <EntityForm
            action={action}
            defaults={{
              name: entity.name,
              type: entity.type as EntityType,
              documentNumber: entity.documentNumber,
            }}
          />
        </div>
      </section>
    </main>
  );
}
