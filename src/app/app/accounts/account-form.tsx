"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import type { AccountType } from "@/db/schema";
import { accountTypes } from "@/db/schema";
import { formatCentsToBrl } from "@/domain/money";
import { isValuedAccountType } from "@/domain/valuations";
import { messages } from "@/messages/pt-BR";

type AccountFormState = { error?: string } | undefined;

type EntityOption = { id: string; name: string; type: string };

type Props = {
  action: (
    prev: AccountFormState,
    formData: FormData,
  ) => Promise<AccountFormState>;
  entities: EntityOption[];
  defaults?: {
    name: string;
    type: AccountType;
    currency: string;
    entityId: string;
    institution: string | null;
    closingDay: number | null;
    acquisitionCostCents: number | null;
    acquisitionDate: string | null;
  };
};

export function AccountForm({ action, entities, defaults }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [type, setType] = useState<AccountType>(defaults?.type ?? "bank");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.name}
        <input
          className="rounded border px-3 py-2"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.type}
        <select
          className="rounded border px-3 py-2"
          name="type"
          required
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {accountTypes.map((accountType) => (
            <option key={accountType} value={accountType}>
              {messages.accounts.types[accountType]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.currency}
        <input
          className="rounded border px-3 py-2"
          name="currency"
          required
          defaultValue={defaults?.currency ?? "BRL"}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.institution}
        <input
          className="rounded border px-3 py-2"
          name="institution"
          defaultValue={defaults?.institution ?? ""}
        />
      </label>
      {type === "credit_card" ? (
        <label className="flex flex-col gap-1 text-sm">
          {messages.accounts.closingDay}
          <input
            className="rounded border px-3 py-2"
            name="closingDay"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={defaults?.closingDay ?? 10}
          />
        </label>
      ) : null}
      {isValuedAccountType(type) ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.acquisitionCost}
            <input
              className="rounded border px-3 py-2"
              name="acquisitionCost"
              required
              placeholder={messages.transactions.amountPlaceholder}
              inputMode="decimal"
              defaultValue={
                defaults?.acquisitionCostCents != null
                  ? formatCentsToBrl(defaults.acquisitionCostCents)
                  : ""
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.acquisitionDate}
            <input
              className="rounded border px-3 py-2"
              name="acquisitionDate"
              type="date"
              required
              defaultValue={
                defaults?.acquisitionDate ??
                new Date().toISOString().slice(0, 10)
              }
            />
          </label>
        </>
      ) : null}
      {type === "loan" && !defaults ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.loanPrincipal}
            <input
              className="rounded border px-3 py-2"
              name="principal"
              required
              placeholder={messages.transactions.amountPlaceholder}
              inputMode="decimal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.loanRate}
            <input
              className="rounded border px-3 py-2"
              name="monthlyRate"
              required
              placeholder={messages.accounts.loanRatePlaceholder}
              inputMode="decimal"
              defaultValue="1,00"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.loanTermMonths}
            <input
              className="rounded border px-3 py-2"
              name="termMonths"
              type="number"
              min={1}
              required
              defaultValue={12}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.loanFirstPayment}
            <input
              className="rounded border px-3 py-2"
              name="firstPaymentDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.accounts.loanSystem}
            <select
              className="rounded border px-3 py-2"
              name="loanSystem"
              required
              defaultValue="price"
            >
              <option value="price">{messages.accounts.loanSystemPrice}</option>
              <option value="sac">{messages.accounts.loanSystemSac}</option>
            </select>
          </label>
        </>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        {messages.accounts.entity}
        <select
          className="rounded border px-3 py-2"
          name="entityId"
          required
          defaultValue={defaults?.entityId ?? entities[0]?.id ?? ""}
        >
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name} (
              {entity.type === "pj"
                ? messages.entities.typePj
                : messages.entities.typePf}
              )
            </option>
          ))}
        </select>
      </label>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-3">
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {messages.accounts.save}
        </button>
        <Link className="self-center underline" href="/app/accounts">
          {messages.accounts.cancel}
        </Link>
      </div>
    </form>
  );
}
