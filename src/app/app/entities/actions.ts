"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createEntity, updateEntity } from "@/db/entities";
import { entityTypes, type EntityType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

function parseEntityInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();

  if (!name || !entityTypes.includes(type as EntityType)) {
    return { error: messages.entities.errorGeneric };
  }

  return {
    input: {
      name,
      type: type as EntityType,
      documentNumber: documentNumber || null,
    },
  };
}

export async function createEntityAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = parseEntityInput(formData);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }

  await createEntity(session.user.id, parsed.input!);
  redirect("/app/entities");
}

export async function updateEntityAction(
  entityId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = parseEntityInput(formData);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }

  const updated = await updateEntity(session.user.id, entityId, parsed.input!);
  if (!updated) {
    return { error: messages.entities.errorNotFound };
  }
  redirect("/app/entities");
}
