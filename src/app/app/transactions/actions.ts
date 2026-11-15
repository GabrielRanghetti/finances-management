"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createTransaction, createTransfer } from "@/db/transactions";
import { parseBrlToCents } from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

function parseCommon(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!date || !description || !amountRaw) {
    return { error: messages.transactions.errorGeneric };
  }

  let amountCents: number;
  try {
    amountCents = parseBrlToCents(amountRaw);
  } catch {
    return { error: messages.transactions.errorAmount };
  }

  if (amountCents <= 0) {
    return { error: messages.transactions.errorAmount };
  }

  return {
    date,
    description,
    notes: notes || null,
    categoryId: categoryId || null,
    amountCents,
  };
}

export async function createIncomeAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const common = parseCommon(formData);
  if ("error" in common && common.error) {
    return { error: common.error };
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.transactions.errorGeneric };
  }

  const created = await createTransaction(session.user.id, {
    accountId,
    date: common.date!,
    amountCents: common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!created) {
    return { error: messages.transactions.errorGeneric };
  }
  redirect("/app/transactions");
}

export async function createExpenseAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const common = parseCommon(formData);
  if ("error" in common && common.error) {
    return { error: common.error };
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.transactions.errorGeneric };
  }

  const created = await createTransaction(session.user.id, {
    accountId,
    date: common.date!,
    amountCents: -common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!created) {
    return { error: messages.transactions.errorGeneric };
  }
  redirect("/app/transactions");
}

export async function createTransferAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const common = parseCommon(formData);
  if ("error" in common && common.error) {
    return { error: common.error };
  }

  const fromAccountId = String(formData.get("fromAccountId") ?? "").trim();
  const toAccountId = String(formData.get("toAccountId") ?? "").trim();
  if (!fromAccountId || !toAccountId) {
    return { error: messages.transactions.errorGeneric };
  }
  if (fromAccountId === toAccountId) {
    return { error: messages.transactions.errorAccounts };
  }

  const created = await createTransfer(session.user.id, {
    fromAccountId,
    toAccountId,
    date: common.date!,
    amountCents: common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!created) {
    return { error: messages.transactions.errorGeneric };
  }
  redirect("/app/transactions");
}
