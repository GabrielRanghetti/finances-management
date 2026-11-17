"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { todayInSaoPaulo } from "@/domain/date";
import { messages } from "@/messages/pt-BR";

type FormState = { error?: string } | undefined;

type Option = { id: string; name: string; type?: string };

type Defaults = {
  date: string;
  amount: string;
  description: string;
  notes: string | null;
  categoryId: string | null;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  installmentCount?: number;
};

type Props = {
  mode: "income" | "expense" | "transfer" | "installment-group";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  accounts: Option[];
  categories: Option[];
  defaults?: Defaults;
};

export function TransactionForm({
  mode,
  action,
  accounts,
  categories,
  defaults,
}: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const today = todayInSaoPaulo();
  const [accountId, setAccountId] = useState(
    defaults?.accountId ?? accounts[0]?.id ?? "",
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );
  const showInstallments =
    mode === "expense" && selectedAccount?.type === "credit_card";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode !== "installment-group" ? (
        <div className="field">
          <label className="lbl" htmlFor="tx-date">
            {messages.transactions.date}
          </label>
          <input
            id="tx-date"
            className="inp"
            type="date"
            name="date"
            required
            defaultValue={defaults?.date ?? today}
          />
        </div>
      ) : null}

      {mode !== "installment-group" ? (
        <div className="field">
          <label className="lbl" htmlFor="tx-amount">
            {messages.transactions.amount}
          </label>
          <input
            id="tx-amount"
            className="inp fig"
            name="amount"
            required
            placeholder={messages.transactions.amountPlaceholder}
            inputMode="decimal"
            defaultValue={defaults?.amount ?? ""}
          />
        </div>
      ) : null}

      <div className="field">
        <label className="lbl" htmlFor="tx-description">
          {messages.transactions.description}
        </label>
        <input
          id="tx-description"
          className="inp"
          name="description"
          required
          defaultValue={defaults?.description ?? ""}
        />
      </div>

      {mode === "transfer" ? (
        <>
          <div className="field">
            <label className="lbl" htmlFor="tx-from-account">
              {messages.transactions.fromAccount}
            </label>
            <select
              id="tx-from-account"
              className="inp"
              name="fromAccountId"
              required
              defaultValue={
                defaults?.fromAccountId ?? accounts[0]?.id ?? ""
              }
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl" htmlFor="tx-to-account">
              {messages.transactions.toAccount}
            </label>
            <select
              id="tx-to-account"
              className="inp"
              name="toAccountId"
              required
              defaultValue={
                defaults?.toAccountId ??
                accounts[1]?.id ??
                accounts[0]?.id ??
                ""
              }
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : mode !== "installment-group" ? (
        <div className="field">
          <label className="lbl" htmlFor="tx-account">
            {messages.transactions.account}
          </label>
          <select
            id="tx-account"
            className="inp"
            name="accountId"
            required
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showInstallments ? (
        <div className="field">
          <label className="lbl" htmlFor="tx-installments">
            {messages.transactions.installments}
          </label>
          <input
            id="tx-installments"
            className="inp fig"
            name="installmentCount"
            type="number"
            min={1}
            max={60}
            defaultValue={defaults?.installmentCount ?? 1}
          />
          <span className="lbl">
            {messages.transactions.installmentsHint}
          </span>
        </div>
      ) : null}

      <div className="field">
        <label className="lbl" htmlFor="tx-category">
          {messages.transactions.category}
        </label>
        <select
          id="tx-category"
          className="inp"
          name="categoryId"
          defaultValue={defaults?.categoryId ?? ""}
        >
          <option value="">{messages.transactions.uncategorized}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {mode !== "installment-group" ? (
        <div className="field">
          <label className="lbl" htmlFor="tx-notes">
            {messages.transactions.notes}
          </label>
          <textarea
            id="tx-notes"
            className="inp"
            name="notes"
            rows={2}
            defaultValue={defaults?.notes ?? ""}
          />
        </div>
      ) : null}

      {state?.error ? (
        <p role="alert" className="neg text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3">
        <button className="btn btn--ink" type="submit">
          {messages.transactions.save}
        </button>
        <Link className="btn btn--card" href="/app/transactions">
          {messages.transactions.cancel}
        </Link>
      </div>
    </form>
  );
}
