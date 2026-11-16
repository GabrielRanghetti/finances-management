"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import {
  confirmPdfAction,
  previewPdfAction,
  type PdfPreviewState,
} from "../actions";
import { formatCentsToBrl } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type AccountOption = { id: string; name: string };

type Props = {
  accounts: AccountOption[];
};

export function PdfImportForm({ accounts }: Props) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewPdfAction,
    undefined as PdfPreviewState | undefined,
  );
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [includeOverrides, setIncludeOverrides] = useState<
    Record<number, boolean>
  >({});

  const rows = previewState?.rows;
  const error = confirmError || previewState?.error;

  function isIncluded(index: number, defaultInclude: boolean) {
    return includeOverrides[index] ?? defaultInclude;
  }

  function onConfirm() {
    if (!file || !previewState?.accountId || !rows) {
      return;
    }
    setConfirmError(undefined);
    const formData = new FormData();
    formData.set("accountId", previewState.accountId);
    formData.set("file", file);
    formData.set(
      "includeIndexes",
      JSON.stringify(
        rows.flatMap((row, index) =>
          isIncluded(index, row.include) ? [index] : [],
        ),
      ),
    );
    startTransition(async () => {
      const result = await confirmPdfAction(undefined, formData);
      if (result?.error) {
        setConfirmError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={(formData) => {
          setConfirmError(undefined);
          setIncludeOverrides({});
          const selected = formData.get("file");
          if (selected instanceof File) {
            setFile(selected);
          }
          setAccountId(String(formData.get("accountId") ?? ""));
          previewAction(formData);
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.imports.account}
          <select
            className="rounded border px-3 py-2"
            name="accountId"
            required
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">{messages.transactions.filterAll}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.imports.file}
          <input
            className="rounded border px-3 py-2"
            name="file"
            type="file"
            accept=".pdf,application/pdf"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={previewPending}
        >
          {messages.imports.preview}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {rows && previewState?.accountId ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {messages.imports.accountBalance}:{" "}
            {messages.money(
              formatCentsToBrl(previewState.accountBalanceCents ?? 0),
            )}
          </p>
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
                {rows.map((row, index) => (
                  <tr
                    key={`${row.description}-${index}`}
                    className="border-b"
                  >
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={isIncluded(index, row.include)}
                        onChange={() =>
                          setIncludeOverrides((current) => ({
                            ...current,
                            [index]: !isIncluded(index, row.include),
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
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              type="button"
              disabled={pending}
              onClick={onConfirm}
            >
              {messages.imports.confirm}
            </button>
            <Link className="self-center text-sm underline" href="/app/imports">
              {messages.imports.cancel}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
