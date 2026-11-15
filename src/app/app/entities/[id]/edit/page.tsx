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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.entities.edit}</h1>
      <EntityForm
        action={action}
        defaults={{
          name: entity.name,
          type: entity.type as EntityType,
          documentNumber: entity.documentNumber,
        }}
      />
    </main>
  );
}
