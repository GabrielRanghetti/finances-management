"use client";

import { useActionState, useState, useTransition } from "react";

import {
  confirmPluggySyncAction,
  previewPluggySyncAction,
  type SyncPreviewState,
} from "../actions";
import { formatSignedCentsToBrl } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type Props = {
  connectionId: string;
};

function formatDdMm(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return day && month ? `${day}/${month}` : isoDate;
}

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
    <div className="flex flex-col gap-6">
      <form action={previewAction}>
        <button
          className={`btn ${groups ? "btn--card" : "btn--ink"}`}
          type="submit"
          disabled={previewPending}
        >
          {messages.connections.syncNow}
        </button>
      </form>

      {error ? (
        <p role="alert" className="neg text-sm font-medium">
          {error}
        </p>
      ) : null}

      {groups
        ? groups.map((group) => (
            <div key={group.accountId} className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-foreground">
                {group.accountName}
              </h2>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">
                        {messages.screens.importsColumnImport}
                      </th>
                      <th scope="col">{messages.imports.date}</th>
                      <th scope="col">
                        {messages.screens.importsColumnBankDescription}
                      </th>
                      <th scope="col">
                        {messages.screens.importsColumnStatus}
                      </th>
                      <th scope="col" className="num">
                        {messages.imports.amount}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr
                        key={`${row.externalId ?? row.description}-${index}`}
                        className={row.probableDuplicate ? "dup" : undefined}
                      >
                        <td>
                          <input
                            className="chk"
                            type="checkbox"
                            aria-label={messages.screens.importsRowAria(
                              row.description,
                            )}
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
                        <td className="fig">{formatDdMm(row.date)}</td>
                        <td>{row.description}</td>
                        <td>
                          {row.probableDuplicate
                            ? messages.screens.importsStatusDuplicate
                            : messages.screens.importsStatusNew}
                        </td>
                        <td
                          className={`num fig ${
                            row.amountCents > 0
                              ? "pos"
                              : row.amountCents < 0
                                ? "neg"
                                : "text-foreground"
                          }`}
                        >
                          {formatSignedCentsToBrl(row.amountCents)}
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
          className="btn btn--ink self-start"
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
