"use client";

import { useActionState } from "react";
import Link from "next/link";

import { messages } from "@/messages/pt-BR";

type FormState = { error?: string } | undefined;

type Option = { id: string; name: string };

type Props = {
  mode: "income" | "expense" | "transfer";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  accounts: Option[];
  categories: Option[];
};

export function TransactionForm({
  mode,
  action,
  accounts,
  categories,
}: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.date}
        <input
          className="rounded border px-3 py-2"
          type="date"
          name="date"
          required
          defaultValue={today}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.amount}
        <input
          className="rounded border px-3 py-2"
          name="amount"
          required
          placeholder="1.234,56"
          inputMode="decimal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.description}
        <input
          className="rounded border px-3 py-2"
          name="description"
          required
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
              defaultValue={accounts[0]?.id ?? ""}
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
              defaultValue={accounts[1]?.id ?? accounts[0]?.id ?? ""}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          {messages.transactions.account}
          <select
            className="rounded border px-3 py-2"
            name="accountId"
            required
            defaultValue={accounts[0]?.id ?? ""}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.category}
        <select className="rounded border px-3 py-2" name="categoryId">
          <option value="">{messages.transactions.filterAll}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {messages.transactions.notes}
        <textarea className="rounded border px-3 py-2" name="notes" rows={2} />
      </label>

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
