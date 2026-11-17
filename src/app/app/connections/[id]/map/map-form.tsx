"use client";

import { useActionState, useState } from "react";

import { saveConnectionMapsAction } from "../../actions";
import type { AccountType } from "@/db/schema";
import { messages } from "@/messages/pt-BR";

type PluggyAccountOption = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  suggestedType: AccountType;
};

type AppAccountOption = { id: string; name: string };

type Props = {
  connectionId: string;
  pluggyAccounts: PluggyAccountOption[];
  appAccounts: AppAccountOption[];
  existingMaps: Record<string, string>;
  accountTypes: AccountType[];
};

export function MapAccountsForm({
  connectionId,
  pluggyAccounts,
  appAccounts,
  existingMaps,
  accountTypes,
}: Props) {
  const bound = saveConnectionMapsAction.bind(null, connectionId);
  const [state, action, pending] = useActionState(
    bound,
    undefined as { error?: string } | undefined,
  );
  const [modes, setModes] = useState<Record<string, "existing" | "create">>(
    () =>
      Object.fromEntries(
        pluggyAccounts.map((account) => [
          account.id,
          existingMaps[account.id] ? "existing" : "create",
        ]),
      ) as Record<string, "existing" | "create">,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="divide-y divide-border">
        {pluggyAccounts.map((account) => (
          <fieldset
            key={account.id}
            className="flex flex-col gap-4 py-6 first:pt-0 last:pb-0 text-sm"
          >
            <legend className="text-base font-semibold text-foreground">
              {messages.connections.pluggyAccount}: {account.name}
            </legend>
            <input type="hidden" name="pluggyAccountId" value={account.id} />

            <label className="flex items-center gap-2">
              <input
                className="chk"
                type="radio"
                name={`mode_${account.id}`}
                value="existing"
                checked={modes[account.id] === "existing"}
                onChange={() =>
                  setModes((current) => ({
                    ...current,
                    [account.id]: "existing",
                  }))
                }
              />
              {messages.connections.appAccount}
            </label>
            {modes[account.id] === "existing" ? (
              <label className="field max-w-md">
                <span className="lbl">{messages.connections.appAccount}</span>
                <select
                  className="inp"
                  name={`accountId_${account.id}`}
                  defaultValue={existingMaps[account.id] ?? ""}
                >
                  <option value="">{messages.imports.noneOption}</option>
                  {appAccounts.map((appAccount) => (
                    <option key={appAccount.id} value={appAccount.id}>
                      {appAccount.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex items-center gap-2">
              <input
                className="chk"
                type="radio"
                name={`mode_${account.id}`}
                value="create"
                checked={modes[account.id] === "create"}
                onChange={() =>
                  setModes((current) => ({
                    ...current,
                    [account.id]: "create",
                  }))
                }
              />
              {messages.connections.createAccount}
            </label>
            {modes[account.id] === "create" ? (
              <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="field">
                  <span className="lbl">
                    {messages.screens.connectionsNewAccountName}
                  </span>
                  <input
                    className="inp"
                    name={`newName_${account.id}`}
                    defaultValue={account.name}
                    required={modes[account.id] === "create"}
                  />
                </label>
                <label className="field">
                  <span className="lbl">
                    {messages.screens.connectionsNewAccountType}
                  </span>
                  <select
                    className="inp"
                    name={`newType_${account.id}`}
                    defaultValue={account.suggestedType}
                  >
                    {accountTypes.map((type) => (
                      <option key={type} value={type}>
                        {messages.accounts.types[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>

      {state?.error ? (
        <p role="alert" className="neg text-sm font-medium">
          {state.error}
        </p>
      ) : null}

      <button className="btn btn--ink self-start" type="submit" disabled={pending}>
        {messages.connections.save}
      </button>
    </form>
  );
}
