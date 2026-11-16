"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  archiveAccount,
  createAccount,
  updateAccount,
} from "@/db/accounts";
import { getEntity } from "@/db/entities";
import { createLoanWithTerms, recordLoanPayment } from "@/db/loans";
import { accountTypes, type AccountType } from "@/db/schema";
import {
  createValuation,
  deleteValuation,
  updateValuation,
} from "@/db/valuations";
import { loanSystems, type LoanSystem } from "@/domain/loans";
import { parseBrlToCents } from "@/domain/money";
import { isValuedAccountType } from "@/domain/valuations";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

function parseMonthlyRatePercent(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("invalid");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("invalid");
  }
  return value / 100;
}

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

  let acquisitionCostCents: number | null = null;
  let acquisitionDate: string | null = null;
  if (isValuedAccountType(type)) {
    const costRaw = String(formData.get("acquisitionCost") ?? "").trim();
    const dateRaw = String(formData.get("acquisitionDate") ?? "").trim();
    if (!costRaw || !dateRaw) {
      return { error: messages.accounts.errorGeneric };
    }
    try {
      acquisitionCostCents = parseBrlToCents(costRaw);
    } catch {
      return { error: messages.transactions.errorAmount };
    }
    if (acquisitionCostCents < 0) {
      return { error: messages.transactions.errorAmount };
    }
    acquisitionDate = dateRaw;
  }

  return {
    input: {
      name,
      type: type as AccountType,
      currency,
      entityId,
      institution: institution || null,
      closingDay,
      acquisitionCostCents,
      acquisitionDate,
    },
  };
}

function parseLoanTerms(formData: FormData) {
  const principalRaw = String(formData.get("principal") ?? "").trim();
  const rateRaw = String(formData.get("monthlyRate") ?? "").trim();
  const termRaw = String(formData.get("termMonths") ?? "").trim();
  const firstPaymentDate = String(formData.get("firstPaymentDate") ?? "").trim();
  const system = String(formData.get("loanSystem") ?? "").trim();

  if (!principalRaw || !rateRaw || !termRaw || !firstPaymentDate) {
    return { error: messages.accounts.errorLoanTerms };
  }
  if (!loanSystems.includes(system as LoanSystem)) {
    return { error: messages.accounts.errorLoanTerms };
  }

  let principalCents: number;
  try {
    principalCents = parseBrlToCents(principalRaw);
  } catch {
    return { error: messages.transactions.errorAmount };
  }
  if (principalCents <= 0) {
    return { error: messages.transactions.errorAmount };
  }

  let monthlyInterestRate: number;
  try {
    monthlyInterestRate = parseMonthlyRatePercent(rateRaw);
  } catch {
    return { error: messages.accounts.errorLoanRate };
  }

  const termMonths = Number(termRaw);
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    return { error: messages.accounts.errorLoanTerms };
  }

  return {
    terms: {
      principalCents,
      monthlyInterestRate,
      termMonths,
      firstPaymentDate,
      system: system as LoanSystem,
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

  if (parsed.input!.type === "loan") {
    const loan = parseLoanTerms(formData);
    if ("error" in loan && loan.error) {
      return { error: loan.error };
    }
    const account = await createAccount(session.user.id, parsed.input!);
    const created = await createLoanWithTerms(session.user.id, {
      accountId: account.id,
      ...loan.terms!,
    });
    if (!created) {
      return { error: messages.accounts.errorGeneric };
    }
    redirect(`/app/accounts/${account.id}`);
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

function parseValuationInput(formData: FormData, accountId: string) {
  const date = String(formData.get("date") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  if (!date || !valueRaw) {
    return { error: messages.accounts.errorValuation };
  }
  let valueCents: number;
  try {
    valueCents = parseBrlToCents(valueRaw);
  } catch {
    return { error: messages.transactions.errorAmount };
  }
  if (valueCents < 0) {
    return { error: messages.transactions.errorAmount };
  }
  return { input: { accountId, date, valueCents } };
}

export async function createValuationAction(
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

  const parsed = parseValuationInput(formData, accountId);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }
  const created = await createValuation(session.user.id, parsed.input!);
  if (!created) {
    return { error: messages.accounts.errorValuation };
  }
  redirect(`/app/accounts/${accountId}`);
}

export async function updateValuationAction(
  accountId: string,
  valuationId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const parsed = parseValuationInput(formData, accountId);
  if ("error" in parsed && parsed.error) {
    return { error: parsed.error };
  }
  const updated = await updateValuation(
    session.user.id,
    valuationId,
    parsed.input!,
  );
  if (!updated) {
    return { error: messages.accounts.errorValuationNotFound };
  }
  redirect(`/app/accounts/${accountId}`);
}

export async function deleteValuationAction(
  accountId: string,
  valuationId: string,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  await deleteValuation(session.user.id, valuationId);
  redirect(`/app/accounts/${accountId}`);
}

export async function recordLoanPaymentAction(
  loanAccountId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const fromAccountId = String(formData.get("fromAccountId") ?? "").trim();
  const installment = Number(String(formData.get("installment") ?? "").trim());
  if (!fromAccountId || !Number.isInteger(installment) || installment < 1) {
    return { error: messages.accounts.errorLoanPayment };
  }

  const recorded = await recordLoanPayment(session.user.id, {
    loanAccountId,
    fromAccountId,
    installment,
  });
  if (!recorded) {
    return { error: messages.accounts.errorLoanPayment };
  }
  redirect(`/app/accounts/${loanAccountId}`);
}
