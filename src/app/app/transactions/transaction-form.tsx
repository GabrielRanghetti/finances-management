"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

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
  const today = new Date().toISOString().slice(0, 10);
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
    <form action={formAction} className="flex flex-col gap-3">
      {mode !== "installment-group" ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.date}
          <input
            className="rounded border px-3 py-2"
            type="date"
            name="date"
            required
            defaultValue={defaults?.date ?? today}
          />
        </label>
      ) : null}
      {mode !== "installment-group" ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.amount}
          <input
            className="rounded border px-3 py-2"
            name="amount"
            required
            placeholder={messages.transactions.amountPlaceholder}
            inputMode="decimal"
            defaultValue={defaults?.amount ?? ""}
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.description}
        <input
          className="rounded border px-3 py-2"
          name="description"
          required
          defaultValue={defaults?.description ?? ""}
        />
      </label>

      {mode === "transfer" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {messages.transactions.fromAccount}
            <select
              className="rounded border px-3 py-2"
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
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.transactions.toAccount}
            <select
              className="rounded border px-3 py-2"
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
          </label>
        </>
      ) : mode !== "installment-group" ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.account}
          <select
            className="rounded border px-3 py-2"
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
        </label>
      ) : null}

      {showInstallments ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.installments}
          <input
            className="rounded border px-3 py-2"
            name="installmentCount"
            type="number"
            min={1}
            max={60}
            defaultValue={defaults?.installmentCount ?? 1}
          />
          <span className="text-zinc-600">
            {messages.transactions.installmentsHint}
          </span>
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.category}
        <select
          className="rounded border px-3 py-2"
          name="categoryId"
          defaultValue={defaults?.categoryId ?? ""}
        >
          <option value="">{messages.transactions.filterAll}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {mode !== "installment-group" ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.notes}
          <textarea
            className="rounded border px-3 py-2"
            name="notes"
            rows={2}
            defaultValue={defaults?.notes ?? ""}
          />
        </label>
      ) : null}

      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <div className="flex gap-3">
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {messages.transactions.save}
        </button>
        <Link className="self-center underline" href="/app/transactions">
          {messages.transactions.cancel}
        </Link>
      </div>
    </form>
  );
}
