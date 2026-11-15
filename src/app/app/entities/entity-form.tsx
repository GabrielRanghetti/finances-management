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
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {messages.entities.name}
        <input
          className="rounded border px-3 py-2"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.entities.type}
        <select
          className="rounded border px-3 py-2"
          name="type"
          required
          defaultValue={defaults?.type ?? "pf"}
        >
          <option value="pf">{messages.entities.typePf}</option>
          <option value="pj">{messages.entities.typePj}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {messages.entities.documentNumber}
        <input
          className="rounded border px-3 py-2"
          name="documentNumber"
          defaultValue={defaults?.documentNumber ?? ""}
        />
      </label>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-3">
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          {messages.entities.save}
        </button>
        <Link className="self-center underline" href="/app/entities">
          {messages.entities.cancel}
        </Link>
      </div>
    </form>
  );
}
