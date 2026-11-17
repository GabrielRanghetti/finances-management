"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { EntityType } from "@/db/schema";
import { messages } from "@/messages/pt-BR";

type EntityFormState = { error?: string } | undefined;

type Props = {
  action: (
    prev: EntityFormState,
    formData: FormData,
  ) => Promise<EntityFormState>;
  defaults?: {
    name: string;
    type: EntityType;
    documentNumber: string | null;
  };
};

export function EntityForm({ action, defaults }: Props) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="field">
        <span className="lbl">{messages.entities.name}</span>
        <input
          className="inp"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
        />
      </label>
      <label className="field">
        <span className="lbl">{messages.entities.type}</span>
        <select
          className="inp"
          name="type"
          required
          defaultValue={defaults?.type ?? "pf"}
        >
          <option value="pf">{messages.entities.typePf}</option>
          <option value="pj">{messages.entities.typePj}</option>
        </select>
      </label>
      <label className="field">
        <span className="lbl">{messages.entities.documentNumber}</span>
        <input
          className="inp fig"
          name="documentNumber"
          defaultValue={defaults?.documentNumber ?? ""}
        />
      </label>
      {state?.error ? (
        <p role="alert" className="neg text-sm font-medium">
          {state.error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3">
        <button className="btn btn--ink" type="submit">
          {messages.entities.save}
        </button>
        <Link className="btn btn--card" href="/app/entities">
          {messages.entities.cancel}
        </Link>
      </div>
    </form>
  );
}
