"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import {
  confirmOfxAction,
  previewOfxAction,
  type OfxPreviewState,
} from "../actions";
import { MAX_IMPORT_BYTES } from "../limits";
import {
  formatBalanceCentsToBrl,
  formatCentsToBrl,
  formatSignedCentsToBrl,
} from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type AccountOption = { id: string; name: string };

type Props = {
  accounts: AccountOption[];
};

function formatDdMm(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return day && month ? `${day}/${month}` : isoDate;
}

export function OfxImportForm({ accounts }: Props) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewOfxAction,
    undefined as OfxPreviewState | undefined,
  );
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [clientError, setClientError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [includeOverrides, setIncludeOverrides] = useState<
    Record<number, boolean>
  >({});

  const rows = previewState?.rows;
  const error = confirmError || clientError || previewState?.error;

  function isIncluded(index: number, defaultInclude: boolean) {
    return includeOverrides[index] ?? defaultInclude;
  }

  function toggleInclude(index: number, defaultInclude: boolean) {
    setIncludeOverrides((current) => ({
      ...current,
      [index]: !isIncluded(index, defaultInclude),
    }));
  }

  function onPreviewSubmit(formData: FormData) {
    setConfirmError(undefined);
    setClientError(undefined);
    setIncludeOverrides({});
    const selected = formData.get("file");
    if (selected instanceof File) {
      setFile(selected);
      if (selected.size > MAX_IMPORT_BYTES) {
        setClientError(messages.imports.errorFileSize);
        return;
      }
    }
    setAccountId(String(formData.get("accountId") ?? ""));
    previewAction(formData);
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
      const result = await confirmOfxAction(undefined, formData);
      if (result?.error) {
        setConfirmError(result.error);
      }
    });
  }

  const totalCount = rows?.length ?? 0;
  const duplicateCount =
    rows?.filter((row) => row.probableDuplicate).length ?? 0;
  const newCount = totalCount - duplicateCount;
  const selectedRows =
    rows?.filter((row, index) => isIncluded(index, row.include)) ?? [];
  const selectedCount = selectedRows.length;
  const selectedSumCents = selectedRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const balanceAfterImportCents =
    (previewState?.accountBalanceCents ?? 0) + selectedSumCents;
  const hasLedgerBalance =
    previewState?.ledgerBalanceCents !== null &&
    previewState?.ledgerBalanceCents !== undefined;
  const ledgerBalanceCents = previewState?.ledgerBalanceCents ?? 0;
  const diffCents = Math.abs(balanceAfterImportCents - ledgerBalanceCents);
  const balancesMatch = diffCents === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="sheet p-5 min-[60rem]:p-8">
        <form
          action={onPreviewSubmit}
          className="flex flex-col gap-4 min-[60rem]:flex-row min-[60rem]:items-end"
        >
          <label className="field flex-1">
            <span className="lbl">{messages.imports.account}</span>
            <select
              className="inp"
              name="accountId"
              required
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="" disabled>
                {messages.screens.importsSelectAccount}
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="lbl">{messages.imports.file}</span>
            <input
              className="inp"
              name="file"
              type="file"
              accept=".ofx,application/x-ofx,application/ofx,text/plain"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setConfirmError(undefined);
                setClientError(undefined);
              }}
            />
          </label>
          <button
            className={`btn ${rows ? "btn--card" : "btn--ink"} self-start min-[60rem]:self-auto`}
            type="submit"
            disabled={previewPending}
          >
            {messages.imports.preview}
          </button>
        </form>

        {error ? (
          <p role="alert" className="neg mt-4 text-sm font-medium">
            {error}
          </p>
        ) : null}
      </section>

      {rows && previewState?.accountId ? (
        <section className="sheet p-5 min-[60rem]:p-8">
          <p className="text-sm text-foreground">
            {messages.screens.importsReviewCount(
              totalCount,
              newCount,
              duplicateCount,
            )}
          </p>

          {rows.length === 0 ? (
            <p className="lbl mt-4">{messages.imports.emptyPreview}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">{messages.screens.importsColumnImport}</th>
                    <th scope="col">{messages.imports.date}</th>
                    <th scope="col">
                      {messages.screens.importsColumnBankDescription}
                    </th>
                    <th scope="col">{messages.screens.importsColumnStatus}</th>
                    <th scope="col" className="num">
                      {messages.imports.amount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
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
                          checked={isIncluded(index, row.include)}
                          onChange={() => toggleInclude(index, row.include)}
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
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-6">
            {hasLedgerBalance ? (
              <div className="text-sm">
                <p>
                  {messages.screens.importsBalanceAfter}{" "}
                  <span
                    className={`fig ml-2 font-semibold ${
                      balanceAfterImportCents < 0 ? "neg" : "text-foreground"
                    }`}
                  >
                    {formatBalanceCentsToBrl(balanceAfterImportCents)}
                  </span>
                </p>
                <p>
                  {messages.screens.importsBalanceReported}{" "}
                  <span
                    className={`fig ml-2 font-semibold ${
                      ledgerBalanceCents < 0 ? "neg" : "text-foreground"
                    }`}
                  >
                    {formatBalanceCentsToBrl(ledgerBalanceCents)}
                  </span>
                </p>
                <p className="lbl mt-1">
                  {balancesMatch
                    ? messages.screens.importsBalancesMatch
                    : messages.screens.importsBalancesMismatch(
                        formatCentsToBrl(diffCents),
                      )}
                </p>
              </div>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap gap-3">
              <Link className="btn btn--card" href="/app/imports">
                {messages.imports.cancel}
              </Link>
              <button
                className="btn btn--ink"
                type="button"
                disabled={pending || selectedCount === 0}
                onClick={onConfirm}
              >
                {messages.screens.importsConfirmCount(selectedCount)}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
