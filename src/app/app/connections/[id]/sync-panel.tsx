"use client";

import { useActionState, useState, useTransition } from "react";

import {
  confirmPluggySyncAction,
  previewPluggySyncAction,
  type SyncPreviewState,
} from "../actions";
import { formatCentsToBrl } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type Props = {
  connectionId: string;
};

export function SyncPanel({ connectionId }: Props) {
  const previewBound = previewPluggySyncAction.bind(null, connectionId);
  const confirmBound = confirmPluggySyncAction.bind(null, connectionId);
  const [previewState, previewAction, previewPending] = useActionState(
    previewBound,
    undefined as SyncPreviewState | undefined,
  );
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [includeOverrides, setIncludeOverrides] = useState<
    Record<string, boolean>
  >({});

  const error = confirmError || previewState?.error;
  const groups = previewState?.rowsByAccount;

  function keyFor(accountId: string, index: number) {
    return `${accountId}:${index}`;
  }

  function isIncluded(
    accountId: string,
    index: number,
    defaultInclude: boolean,
  ) {
    return includeOverrides[keyFor(accountId, index)] ?? defaultInclude;
  }

  function onConfirm() {
    if (!groups) {
      return;
    }
    setConfirmError(undefined);
    const payload = groups.map((group) => ({
      accountId: group.accountId,
      rows: group.rows.filter((row, index) =>
        isIncluded(group.accountId, index, row.include),
      ),
    }));
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const result = await confirmBound(undefined, formData);
      if (result?.error) {
        setConfirmError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={previewAction}>
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={previewPending}
        >
          {messages.connections.syncNow}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {groups
        ? groups.map((group) => (
            <div key={group.accountId} className="flex flex-col gap-2">
              <h2 className="font-medium">{group.accountName}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-2">{messages.imports.include}</th>
                      <th className="py-2 pr-2">{messages.imports.date}</th>
                      <th className="py-2 pr-2">{messages.imports.description}</th>
                      <th className="py-2 pr-2">{messages.imports.amount}</th>
                      <th className="py-2">{messages.imports.probableDuplicate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr
                        key={`${row.externalId ?? row.description}-${index}`}
                        className="border-b"
                      >
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={isIncluded(
                              group.accountId,
                              index,
                              row.include,
                            )}
                            onChange={() =>
                              setIncludeOverrides((current) => ({
                                ...current,
                                [keyFor(group.accountId, index)]: !isIncluded(
                                  group.accountId,
                                  index,
                                  row.include,
                                ),
                              }))
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2">{row.date}</td>
                        <td className="py-2 pr-2">{row.description}</td>
                        <td className="whitespace-nowrap py-2 pr-2">
                          {messages.money(formatCentsToBrl(row.amountCents))}
                        </td>
                        <td className="py-2">
                          {row.probableDuplicate
                            ? messages.imports.probableDuplicate
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        : null}

      {groups ? (
        <button
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="button"
          disabled={pending}
          onClick={onConfirm}
        >
          {messages.connections.confirmSync}
        </button>
      ) : null}
    </div>
  );
}
