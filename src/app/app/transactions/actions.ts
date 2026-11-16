"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccount } from "@/db/accounts";
import {
  cancelInstallmentGroup,
  createInstallmentPurchase,
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTransaction,
  getTransferPair,
  updateInstallmentGroup,
  updateTransaction,
  updateTransfer,
} from "@/db/transactions";
import { installmentBaseDescription } from "@/domain/installments";
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

  const installmentRaw = String(formData.get("installmentCount") ?? "1").trim();
  const installmentCount = Number(installmentRaw || "1");
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 60
  ) {
    return { error: messages.transactions.errorInstallments };
  }

  if (installmentCount > 1) {
    const account = await getAccount(session.user.id, accountId);
    if (!account || account.type !== "credit_card") {
      return { error: messages.transactions.errorCreditCard };
    }
    const created = await createInstallmentPurchase(session.user.id, {
      accountId,
      date: common.date!,
      amountCents: common.amountCents!,
      description: common.description!,
      installmentCount,
      categoryId: common.categoryId,
      notes: common.notes,
    });
    if (!created) {
      return { error: messages.transactions.errorGeneric };
    }
    redirect("/app/transactions");
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

export async function updateIncomeAction(
  transactionId: string,
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

  const updated = await updateTransaction(session.user.id, transactionId, {
    accountId,
    date: common.date!,
    amountCents: common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!updated) {
    return { error: messages.transactions.errorNotFound };
  }
  redirect("/app/transactions");
}

export async function updateExpenseAction(
  transactionId: string,
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

  const updated = await updateTransaction(session.user.id, transactionId, {
    accountId,
    date: common.date!,
    amountCents: -common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!updated) {
    return { error: messages.transactions.errorNotFound };
  }
  redirect("/app/transactions");
}

export async function updateTransferAction(
  transferId: string,
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

  const updated = await updateTransfer(session.user.id, transferId, {
    fromAccountId,
    toAccountId,
    date: common.date!,
    amountCents: common.amountCents!,
    description: common.description!,
    categoryId: common.categoryId,
    notes: common.notes,
  });
  if (!updated) {
    return { error: messages.transactions.errorNotFound };
  }
  redirect("/app/transactions");
}

export async function deleteTransactionAction(transactionId: string) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const existing = await getTransaction(session.user.id, transactionId);
  if (!existing) {
    redirect("/app/transactions");
  }
  if (existing.transferId) {
    const pair = await getTransferPair(session.user.id, transactionId);
    if (!pair) {
      redirect("/app/transactions");
    }
  }

  await deleteTransaction(session.user.id, transactionId);
  redirect("/app/transactions");
}

export async function updateInstallmentGroupAction(
  installmentGroupId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!description) {
    return { error: messages.transactions.errorGeneric };
  }

  const updated = await updateInstallmentGroup(
    session.user.id,
    installmentGroupId,
    {
      description: installmentBaseDescription(description),
      categoryId: categoryId || null,
    },
  );
  if (!updated) {
    return { error: messages.transactions.errorNotFound };
  }
  redirect("/app/transactions");
}

export async function cancelInstallmentGroupAction(
  installmentGroupId: string,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  await cancelInstallmentGroup(session.user.id, installmentGroupId);
  redirect("/app/transactions");
}
