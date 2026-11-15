"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  archiveAccount,
  createAccount,
  updateAccount,
} from "@/db/accounts";
import { getEntity } from "@/db/entities";
import { accountTypes, type AccountType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

function parseAccountInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const entityId = String(formData.get("entityId") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const closingDayRaw = String(formData.get("closingDay") ?? "").trim();

  if (
    !name ||
    !currency ||
    !entityId ||
    !accountTypes.includes(type as AccountType)
  ) {
    return { error: messages.accounts.errorGeneric };
  }

  let closingDay: number | null = null;
  if (type === "credit_card") {
    const parsed = Number(closingDayRaw);
    if (
      !closingDayRaw ||
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > 31
    ) {
      return { error: messages.accounts.errorClosingDay };
    }
    closingDay = parsed;
  }

  return {
    input: {
      name,
      type: type as AccountType,
      currency,
      entityId,
      institution: institution || null,
      closingDay,
    },
  };
}

export async function createAccountAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = parseAccountInput(formData);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }

  const entity = await getEntity(session.user.id, parsed.input!.entityId!);
  if (!entity) {
    return { error: messages.accounts.errorGeneric };
  }

  await createAccount(session.user.id, parsed.input!);
  redirect("/app/accounts");
}

export async function updateAccountAction(
  accountId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = parseAccountInput(formData);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }

  const entity = await getEntity(session.user.id, parsed.input!.entityId!);
  if (!entity) {
    return { error: messages.accounts.errorGeneric };
  }

  const updated = await updateAccount(
    session.user.id,
    accountId,
    parsed.input!,
  );
  if (!updated) {
    return { error: messages.accounts.errorNotFound };
  }
  redirect(`/app/accounts/${accountId}`);
}

export async function archiveAccountAction(accountId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  await archiveAccount(session.user.id, accountId);
  redirect("/app/accounts");
}
