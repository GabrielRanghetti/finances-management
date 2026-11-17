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
    <form action={action} className="flex flex-col gap-4">
      <label className="field">
        <span className="lbl">{messages.connections.itemId}</span>
        <input
          className="inp"
          name="itemId"
          required
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
        <span className="lbl">{messages.connections.itemIdHint}</span>
      </label>
      <label className="field">
        <span className="lbl">{messages.connections.entity}</span>
        <select className="inp" name="entityId" required defaultValue="">
          <option value="">{messages.transactions.filterAll}</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </label>
      {state?.error ? (
        <p role="alert" className="neg text-sm font-medium">
          {state.error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3">
        <button className="btn btn--ink" type="submit" disabled={pending}>
          {messages.connections.save}
        </button>
        <Link className="btn btn--card" href="/app/connections">
          {messages.connections.cancel}
        </Link>
      </div>
    </form>
  );
}
