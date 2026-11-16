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
      {pluggyAccounts.map((account) => (
        <fieldset
          key={account.id}
          className="flex flex-col gap-2 rounded border border-zinc-200 p-3 text-sm"
        >
          <legend className="px-1 font-medium">
            {messages.connections.pluggyAccount}: {account.name}
          </legend>
          <input type="hidden" name="pluggyAccountId" value={account.id} />

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`mode_${account.id}`}
              value="existing"
              checked={modes[account.id] === "existing"}
              onChange={() =>
                setModes((current) => ({ ...current, [account.id]: "existing" }))
              }
            />
            {messages.connections.appAccount}
          </label>
          {modes[account.id] === "existing" ? (
            <select
              className="rounded border px-3 py-2"
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
          ) : null}

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`mode_${account.id}`}
              value="create"
              checked={modes[account.id] === "create"}
              onChange={() =>
                setModes((current) => ({ ...current, [account.id]: "create" }))
              }
            />
            {messages.connections.createAccount}
          </label>
          {modes[account.id] === "create" ? (
            <>
              <input
                className="rounded border px-3 py-2"
                name={`newName_${account.id}`}
                defaultValue={account.name}
                required={modes[account.id] === "create"}
              />
              <select
                className="rounded border px-3 py-2"
                name={`newType_${account.id}`}
                defaultValue={account.suggestedType}
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {messages.accounts.types[type]}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </fieldset>
      ))}

      {state?.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}

      <button
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        {messages.connections.save}
      </button>
    </form>
  );
}
