"use client";

import { useActionState } from "react";

import { messages } from "@/messages/pt-BR";

type FormState = { error?: string } | undefined;

type Option = { id: string; name: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  installment: number;
  termMonths: number;
  paymentAccounts: Option[];
};

export function LoanPaymentForm({
  action,
  installment,
  termMonths,
  paymentAccounts,
}: Props) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 text-sm">
      <p>
        {messages.accounts.loanNextInstallment(installment, termMonths)}
      </p>
      <input type="hidden" name="installment" value={installment} />
      <label className="flex flex-col gap-1">
        {messages.accounts.loanPayFrom}
        <select
          className="rounded border px-3 py-2"
          name="fromAccountId"
          required
          defaultValue={paymentAccounts[0]?.id ?? ""}
        >
          {paymentAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      {state?.error ? <p className="text-red-700">{state.error}</p> : null}
      <button className="rounded bg-black px-3 py-2 text-white" type="submit">
        {messages.accounts.loanRecordPayment}
      </button>
    </form>
  );
}
