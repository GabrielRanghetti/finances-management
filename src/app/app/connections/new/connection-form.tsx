"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createPluggyConnectionAction } from "../actions";
import { messages } from "@/messages/pt-BR";

type EntityOption = { id: string; name: string };

type Props = {
  entities: EntityOption[];
};

export function ConnectionForm({ entities }: Props) {
  const [state, action, pending] = useActionState(
    createPluggyConnectionAction,
    undefined as { error?: string } | undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {messages.connections.itemId}
        <input
          className="rounded border px-3 py-2"
          name="itemId"
          required
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
        <span className="text-zinc-600">{messages.connections.itemIdHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.connections.entity}
        <select className="rounded border px-3 py-2" name="entityId" required>
          <option value="">{messages.transactions.filterAll}</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </label>
      {state?.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={pending}
        >
          {messages.connections.save}
        </button>
        <Link className="self-center text-sm underline" href="/app/connections">
          {messages.connections.cancel}
        </Link>
      </div>
    </form>
  );
}
