"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import type { AccountType } from "@/db/schema";
import { accountTypes } from "@/db/schema";
import { todayInSaoPaulo } from "@/domain/date";
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
  const today = todayInSaoPaulo();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="field">
        <label className="lbl" htmlFor="acc-name">
          {messages.accounts.name}
        </label>
        <input
          id="acc-name"
          className="inp"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
        />
      </div>

      <div className="field">
        <label className="lbl" htmlFor="acc-type">
          {messages.accounts.type}
        </label>
        <select
          id="acc-type"
          className="inp"
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
      </div>

      <div className="field">
        <label className="lbl" htmlFor="acc-currency">
          {messages.accounts.currency}
        </label>
        <input
          id="acc-currency"
          className="inp"
          name="currency"
          required
          defaultValue={defaults?.currency ?? "BRL"}
        />
      </div>

      <div className="field">
        <label className="lbl" htmlFor="acc-institution">
          {messages.accounts.institution}
        </label>
        <input
          id="acc-institution"
          className="inp"
          name="institution"
          defaultValue={defaults?.institution ?? ""}
        />
      </div>

      {type === "credit_card" ? (
        <div className="field">
          <label className="lbl" htmlFor="acc-closing-day">
            {messages.accounts.closingDay}
          </label>
          <input
            id="acc-closing-day"
            className="inp fig"
            name="closingDay"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={defaults?.closingDay ?? 10}
          />
        </div>
      ) : null}

      {isValuedAccountType(type) ? (
        <>
          <div className="field">
            <label className="lbl" htmlFor="acc-acquisition-cost">
              {messages.accounts.acquisitionCost}
            </label>
            <input
              id="acc-acquisition-cost"
              className="inp fig"
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
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-acquisition-date">
              {messages.accounts.acquisitionDate}
            </label>
            <input
              id="acc-acquisition-date"
              className="inp"
              name="acquisitionDate"
              type="date"
              required
              defaultValue={defaults?.acquisitionDate ?? today}
            />
          </div>
        </>
      ) : null}

      {type === "loan" && !defaults ? (
        <>
          <div className="field">
            <label className="lbl" htmlFor="acc-loan-principal">
              {messages.accounts.loanPrincipal}
            </label>
            <input
              id="acc-loan-principal"
              className="inp fig"
              name="principal"
              required
              placeholder={messages.transactions.amountPlaceholder}
              inputMode="decimal"
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-loan-rate">
              {messages.accounts.loanRate}
            </label>
            <input
              id="acc-loan-rate"
              className="inp fig"
              name="monthlyRate"
              required
              placeholder={messages.accounts.loanRatePlaceholder}
              inputMode="decimal"
              defaultValue="1,00"
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-loan-term">
              {messages.accounts.loanTermMonths}
            </label>
            <input
              id="acc-loan-term"
              className="inp fig"
              name="termMonths"
              type="number"
              min={1}
              required
              defaultValue={12}
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-loan-first-payment">
              {messages.accounts.loanFirstPayment}
            </label>
            <input
              id="acc-loan-first-payment"
              className="inp"
              name="firstPaymentDate"
              type="date"
              required
              defaultValue={today}
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-loan-system">
              {messages.accounts.loanSystem}
            </label>
            <select
              id="acc-loan-system"
              className="inp"
              name="loanSystem"
              required
              defaultValue="price"
            >
              <option value="price">{messages.accounts.loanSystemPrice}</option>
              <option value="sac">{messages.accounts.loanSystemSac}</option>
            </select>
          </div>
        </>
      ) : null}

      <div className="field">
        <label className="lbl" htmlFor="acc-entity">
          {messages.accounts.entity}
        </label>
        <select
          id="acc-entity"
          className="inp"
          name="entityId"
          required
          defaultValue={defaults?.entityId ?? entities[0]?.id ?? ""}
        >
          {entities.map((entity) => {
            const typeLabel =
              entity.type === "pj"
                ? messages.entities.typePj
                : messages.entities.typePf;
            return (
              <option key={entity.id} value={entity.id}>
                {entity.name === typeLabel
                  ? entity.name
                  : messages.entities.linkLabel(entity.name, typeLabel)}
              </option>
            );
          })}
        </select>
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
        <Link className="btn btn--card" href="/app/accounts">
          {messages.accounts.cancel}
        </Link>
      </div>
    </form>
  );
}
