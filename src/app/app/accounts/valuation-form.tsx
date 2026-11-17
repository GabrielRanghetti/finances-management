"use client";

import { useActionState } from "react";
import Link from "next/link";

import { todayInSaoPaulo } from "@/domain/date";
import { messages } from "@/messages/pt-BR";

type FormState = { error?: string } | undefined;

type Props = {
  accountId: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: {
    date: string;
    value: string;
  };
};

export function ValuationForm({ accountId, action, defaults }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const today = todayInSaoPaulo();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.valuationDate}
        <input
          className="rounded border px-3 py-2"
          type="date"
          name="date"
          required
          defaultValue={defaults?.date ?? today}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.valuationValue}
        <input
          className="rounded border px-3 py-2"
          name="value"
          required
          placeholder={messages.transactions.amountPlaceholder}
          inputMode="decimal"
          defaultValue={defaults?.value ?? ""}
        />
      </label>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-3">
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {messages.accounts.save}
        </button>
        <Link
          className="self-center underline"
          href={`/app/accounts/${accountId}`}
        >
          {messages.accounts.cancel}
        </Link>
      </div>
    </form>
  );
}
