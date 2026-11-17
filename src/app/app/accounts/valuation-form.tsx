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
    <form action={formAction} className="flex flex-col gap-4">
      <div className="field">
        <label className="lbl" htmlFor="val-date">
          {messages.accounts.valuationDate}
        </label>
        <input
          id="val-date"
          className="inp"
          type="date"
          name="date"
          required
          defaultValue={defaults?.date ?? today}
        />
      </div>

      <div className="field">
        <label className="lbl" htmlFor="val-value">
          {messages.accounts.valuationValue}
        </label>
        <input
          id="val-value"
          className="inp fig"
          name="value"
          required
          placeholder={messages.transactions.amountPlaceholder}
          inputMode="decimal"
          defaultValue={defaults?.value ?? ""}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="neg text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3">
        <button className="btn btn--ink" type="submit">
          {messages.accounts.save}
        </button>
        <Link className="btn btn--card" href={`/app/accounts/${accountId}`}>
          {messages.accounts.cancel}
        </Link>
      </div>
    </form>
  );
}
