"use client";

import { useActionState } from "react";

import { createExpenseAction, createIncomeAction } from "./actions";
import { parseBrlToCents } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type FormState = { error?: string } | undefined;

type Option = { id: string; name: string };

type Props = {
  accounts: Option[];
  categories: Option[];
  defaultDate: string;
  defaultAccountId?: string;
};

function normalizeDateInput(raw: string): string {
  const trimmed = raw.trim();
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  return trimmed;
}

async function submitQuickTransaction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawDate = String(formData.get("date") ?? "");
  const normalizedDate = normalizeDateInput(rawDate);
  const rawAmount = String(formData.get("amount") ?? "").trim();

  const nextData = new FormData();
  for (const [key, value] of formData.entries()) {
    nextData.set(key, value);
  }
  nextData.set("date", normalizedDate);

  let cents: number;
  try {
    cents = parseBrlToCents(rawAmount);
  } catch {
    return createExpenseAction(prev, nextData);
  }

  if (cents < 0) {
    const absAmount = rawAmount.replace(/^[-−]\s*/, "");
    nextData.set("amount", absAmount);
    return createExpenseAction(prev, nextData);
  }

  if (cents > 0) {
    const absAmount = rawAmount.replace(/^\+\s*/, "");
    nextData.set("amount", absAmount);
    return createIncomeAction(prev, nextData);
  }

  return createExpenseAction(prev, nextData);
}

export function QuickTransactionForm({
  accounts,
  categories,
  defaultDate,
  defaultAccountId,
}: Props) {
  const [state, formAction] = useActionState(submitQuickTransaction, undefined);
  const initialAccount = defaultAccountId || accounts[0]?.id || "";

  return (
    <div className="border-b border-border pb-6">
      <form
        action={formAction}
        className="grid grid-cols-1 gap-3 min-[60rem]:grid-cols-[130px_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_140px_auto] min-[60rem]:items-end"
      >
        <div className="field">
          <label className="lbl" htmlFor="n-data">
            {messages.transactions.date}
          </label>
          <input
            className="inp"
            id="n-data"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
          />
        </div>

        <div className="field">
          <label className="lbl" htmlFor="n-desc">
            {messages.transactions.description}
          </label>
          <input
            className="inp"
            id="n-desc"
            name="description"
            type="text"
            required
            placeholder={messages.transactions.descriptionPlaceholder}
          />
        </div>

        <div className="field">
          <label className="lbl" htmlFor="n-cat">
            {messages.transactions.category}
          </label>
          <select className="inp" id="n-cat" name="categoryId" defaultValue="">
            <option value="">{messages.transactions.chooseCategory}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="lbl" htmlFor="n-conta">
            {messages.transactions.account}
          </label>
          <select
            className="inp"
            id="n-conta"
            name="accountId"
            required
            defaultValue={initialAccount}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="lbl" htmlFor="n-valor">
            {messages.transactions.amount}
          </label>
          <input
            className="inp fig text-right"
            id="n-valor"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder={messages.transactions.quickAmountPlaceholder}
          />
        </div>

        <button type="submit" className="btn btn--ink">
          {messages.transactions.add}
        </button>
      </form>

      {state?.error ? (
        <p role="alert" className="neg mt-3 text-sm">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
