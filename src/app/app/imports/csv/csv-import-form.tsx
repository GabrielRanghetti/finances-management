"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import {
  confirmCsvAction,
  previewCsvAction,
  startCsvImportAction,
  type CsvImportState,
} from "../actions";
import { MAX_IMPORT_BYTES } from "../limits";
import { csvDateFormats, csvDecimalSeparators } from "@/db/schema";
import { formatCentsToBrl } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type AccountOption = { id: string; name: string };

type Props = {
  accounts: AccountOption[];
};

function ColumnSelect({
  name,
  label,
  headers,
  defaultValue,
  allowNone = false,
}: {
  name: string;
  label: string;
  headers: string[];
  defaultValue: string;
  allowNone?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        className="rounded border px-3 py-2"
        name={name}
        defaultValue={defaultValue}
      >
        {allowNone ? (
          <option value="">{messages.imports.noneOption}</option>
        ) : null}
        {headers.map((header, index) => (
          <option key={`${name}-${index}`} value={index}>
            {index}: {header}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CsvImportForm({ accounts }: Props) {
  const [startState, startAction, startPending] = useActionState(
    startCsvImportAction,
    undefined as CsvImportState | undefined,
  );
  const [previewState, previewAction, previewPending] = useActionState(
    previewCsvAction,
    undefined as CsvImportState | undefined,
  );
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [clientError, setClientError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [amountMode, setAmountMode] = useState<"single" | "split" | null>(null);
  const [includeOverrides, setIncludeOverrides] = useState<
    Record<number, boolean>
  >({});

  const mappingState = previewState?.mapping ? previewState : startState;
  const rows = previewState?.rows;
  const headers = mappingState?.headers ?? [];
  const mapping = mappingState?.mapping;
  const error =
    confirmError || clientError || previewState?.error || startState?.error;
  const resolvedAmountMode =
    amountMode ??
    (mapping && mapping.amountColumn === null ? "split" : "single");

  function isIncluded(index: number, defaultInclude: boolean) {
    return includeOverrides[index] ?? defaultInclude;
  }

  function onConfirm(form: HTMLFormElement) {
    if (!file || !mappingState?.accountId || !rows) {
      return;
    }
    setConfirmError(undefined);
    const formData = new FormData(form);
    formData.set("accountId", mappingState.accountId);
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
      const result = await confirmCsvAction(undefined, formData);
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
          setClientError(undefined);
          setIncludeOverrides({});
          setAmountMode(null);
          const selected = formData.get("file");
          if (selected instanceof File) {
            setFile(selected);
            if (selected.size > MAX_IMPORT_BYTES) {
              setClientError(messages.imports.errorFileSize);
              return;
            }
          }
          setAccountId(String(formData.get("accountId") ?? ""));
          startAction(formData);
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
            accept=".csv,text/csv,text/plain"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setClientError(undefined);
            }}
          />
        </label>
        <button
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={startPending}
        >
          {messages.imports.mappingTitle}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {mapping && mappingState?.accountId ? (
        <form
          key={`${mappingState.accountId}-${headers.join("|")}-${mapping.dateFormat}-${mapping.decimalSeparator}`}
          className="flex flex-col gap-4"
          action={(formData) => {
            setConfirmError(undefined);
            setIncludeOverrides({});
            if (file) {
              formData.set("file", file);
            }
            formData.set("accountId", mappingState.accountId!);
            previewAction(formData);
          }}
        >
          <input type="hidden" name="accountId" value={mappingState.accountId} />
          <h2 className="text-lg font-medium">{messages.imports.mappingTitle}</h2>

          <ColumnSelect
            name="dateColumn"
            label={messages.imports.dateColumn}
            headers={headers}
            defaultValue={String(mapping.dateColumn)}
          />
          <ColumnSelect
            name="descriptionColumn"
            label={messages.imports.descriptionColumn}
            headers={headers}
            defaultValue={String(mapping.descriptionColumn)}
          />
          <ColumnSelect
            name="idColumn"
            label={messages.imports.idColumn}
            headers={headers}
            defaultValue={
              mapping.idColumn === null ? "" : String(mapping.idColumn)
            }
            allowNone
          />

          <fieldset className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="amountMode"
                value="single"
                checked={resolvedAmountMode === "single"}
                onChange={() => setAmountMode("single")}
              />
              {messages.imports.amountModeSingle}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="amountMode"
                value="split"
                checked={resolvedAmountMode === "split"}
                onChange={() => setAmountMode("split")}
              />
              {messages.imports.amountModeSplit}
            </label>
          </fieldset>

          {resolvedAmountMode === "single" ? (
            <ColumnSelect
              name="amountColumn"
              label={messages.imports.amountColumn}
              headers={headers}
              defaultValue={String(mapping.amountColumn ?? 1)}
            />
          ) : (
            <>
              <ColumnSelect
                name="debitColumn"
                label={messages.imports.debitColumn}
                headers={headers}
                defaultValue={String(mapping.debitColumn ?? 2)}
              />
              <ColumnSelect
                name="creditColumn"
                label={messages.imports.creditColumn}
                headers={headers}
                defaultValue={String(mapping.creditColumn ?? 3)}
              />
            </>
          )}

          <label className="flex flex-col gap-1 text-sm">
            {messages.imports.dateFormat}
            <select
              className="rounded border px-3 py-2"
              name="dateFormat"
              defaultValue={mapping.dateFormat}
            >
              {csvDateFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {messages.imports.decimalSeparator}
            <select
              className="rounded border px-3 py-2"
              name="decimalSeparator"
              defaultValue={mapping.decimalSeparator}
            >
              {csvDecimalSeparators.map((separator) => (
                <option key={separator} value={separator}>
                  {separator === "." ? ". (1,234.56)" : ", (1.234,56)"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="saveMapping" defaultChecked />
            {messages.imports.saveMapping}
          </label>

          {mappingState.samples && mappingState.samples.length > 0 ? (
            <div className="overflow-x-auto text-sm">
              <p className="mb-2 font-medium">{messages.imports.sampleRows}</p>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    {headers.map((header, index) => (
                      <th key={`h-${index}`} className="py-1 pr-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappingState.samples.map((sample, rowIndex) => (
                    <tr key={`s-${rowIndex}`} className="border-b">
                      {sample.map((cell, cellIndex) => (
                        <td
                          key={`c-${rowIndex}-${cellIndex}`}
                          className="py-1 pr-2"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <button
            className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            type="submit"
            disabled={previewPending}
          >
            {messages.imports.preview}
          </button>

          {rows ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                {messages.imports.accountBalance}:{" "}
                {messages.money(
                  formatCentsToBrl(previewState?.accountBalanceCents ?? 0),
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
                        key={`${row.externalId ?? row.description}-${index}`}
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
                  onClick={(event) => onConfirm(event.currentTarget.form!)}
                >
                  {messages.imports.confirm}
                </button>
                <Link
                  className="self-center text-sm underline"
                  href="/app/imports"
                >
                  {messages.imports.cancel}
                </Link>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
