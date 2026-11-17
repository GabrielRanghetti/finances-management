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
import { formatSignedCentsToBrl } from "@/domain/money";
import { messages } from "@/messages/pt-BR";

type AccountOption = { id: string; name: string };

type Props = {
  accounts: AccountOption[];
};

function formatDdMm(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return day && month ? `${day}/${month}` : isoDate;
}

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
    <label className="field">
      <span className="lbl">{label}</span>
      <select className="inp" name={name} defaultValue={defaultValue}>
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

  const totalCount = rows?.length ?? 0;
  const duplicateCount =
    rows?.filter((row) => row.probableDuplicate).length ?? 0;
  const newCount = totalCount - duplicateCount;
  const selectedCount =
    rows?.filter((row, index) => isIncluded(index, row.include)).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="sheet p-5 min-[60rem]:p-8">
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
              accept=".csv,text/csv,text/plain"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setClientError(undefined);
              }}
            />
          </label>
          <button
            className={`btn ${mapping ? "btn--card" : "btn--ink"} self-start min-[60rem]:self-auto`}
            type="submit"
            disabled={startPending}
          >
            {messages.imports.mappingTitle}
          </button>
        </form>

        {error ? (
          <p role="alert" className="neg mt-4 text-sm font-medium">
            {error}
          </p>
        ) : null}

        {mapping && mappingState?.accountId ? (
          <form
            key={`${mappingState.accountId}-${headers.join("|")}-${mapping.dateFormat}-${mapping.decimalSeparator}`}
            className="mt-6 flex flex-col gap-4 border-t border-border pt-6"
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
            <input
              type="hidden"
              name="accountId"
              value={mappingState.accountId}
            />
            <h2 className="text-base font-semibold text-foreground">
              {messages.imports.mappingTitle}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[60rem]:grid-cols-3">
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
            </div>

            <fieldset className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  className="chk"
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
                  className="chk"
                  type="radio"
                  name="amountMode"
                  value="split"
                  checked={resolvedAmountMode === "split"}
                  onChange={() => setAmountMode("split")}
                />
                {messages.imports.amountModeSplit}
              </label>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[60rem]:grid-cols-3">
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

              <label className="field">
                <span className="lbl">{messages.imports.dateFormat}</span>
                <select
                  className="inp"
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

              <label className="field">
                <span className="lbl">{messages.imports.decimalSeparator}</span>
                <select
                  className="inp"
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
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                className="chk"
                type="checkbox"
                name="saveMapping"
                defaultChecked
              />
              {messages.imports.saveMapping}
            </label>

            {mappingState.samples && mappingState.samples.length > 0 ? (
              <div className="overflow-x-auto">
                <p className="lbl mb-2">{messages.imports.sampleRows}</p>
                <table className="tbl">
                  <thead>
                    <tr>
                      {headers.map((header, index) => (
                        <th scope="col" key={`h-${index}`}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappingState.samples.map((sample, rowIndex) => (
                      <tr key={`s-${rowIndex}`}>
                        {sample.map((cell, cellIndex) => (
                          <td key={`c-${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <button
              className={`btn ${rows ? "btn--card" : "btn--ink"} self-start`}
              type="submit"
              disabled={previewPending}
            >
              {messages.imports.preview}
            </button>

            {rows ? (
              <div className="mt-4 flex flex-col gap-4 border-t border-border pt-6">
                <p className="text-sm text-foreground">
                  {messages.screens.importsReviewCount(
                    totalCount,
                    newCount,
                    duplicateCount,
                  )}
                </p>

                {rows.length === 0 ? (
                  <p className="lbl">{messages.imports.emptyPreview}</p>
                ) : (
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
                        {rows.map((row, index) => (
                          <tr
                            key={`${row.externalId ?? row.description}-${index}`}
                            className={
                              row.probableDuplicate ? "dup" : undefined
                            }
                          >
                            <td>
                              <input
                                className="chk"
                                type="checkbox"
                                aria-label={messages.screens.importsRowAria(
                                  row.description,
                                )}
                                checked={isIncluded(index, row.include)}
                                onChange={() =>
                                  setIncludeOverrides((current) => ({
                                    ...current,
                                    [index]: !isIncluded(index, row.include),
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
                )}

                <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-border pt-6">
                  <Link className="btn btn--card" href="/app/imports">
                    {messages.imports.cancel}
                  </Link>
                  <button
                    className="btn btn--ink"
                    type="button"
                    disabled={pending || selectedCount === 0}
                    onClick={(event) => onConfirm(event.currentTarget.form!)}
                  >
                    {messages.screens.importsConfirmCount(selectedCount)}
                  </button>
                </div>
              </div>
            ) : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
