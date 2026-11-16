"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccount } from "@/db/accounts";
import { getCsvMapping, upsertCsvMapping } from "@/db/csv-mappings";
import {
  listAccountTransactionRefs,
  saveImportedTransactions,
} from "@/db/imports";
import {
  csvDateFormats,
  csvDecimalSeparators,
  type CsvDateFormat,
  type CsvDecimalSeparator,
} from "@/db/schema";
import { listAccountAmounts } from "@/db/transactions";
import {
  markProbableDuplicates,
} from "@/domain/duplicates";
import { accountBalanceCents } from "@/domain/money";
import {
  parseCsv,
  peekCsv,
  type CsvMapping,
} from "@/importers/csv";
import {
  extractPdfText,
  parseItauStatementText,
} from "@/importers/itau-pdf";
import { parseOfx } from "@/importers/ofx";
import type { NormalizedImportRow } from "@/importers/types";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

import { MAX_IMPORT_BYTES } from "./limits";

const MAX_OFX_BYTES = MAX_IMPORT_BYTES;

export type OfxPreviewRow = NormalizedImportRow & {
  probableDuplicate: boolean;
  include: boolean;
};

export type OfxPreviewState = {
  error?: string;
  accountId?: string;
  accountBalanceCents?: number;
  ledgerBalanceCents?: number | null;
  rows?: OfxPreviewRow[];
  savedCount?: number;
};

async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

function isOfxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".ofx") ||
    file.type === "application/x-ofx" ||
    file.type === "application/ofx" ||
    file.type === "text/plain" ||
    file.type === "application/octet-stream" ||
    file.type === ""
  );
}

async function readOfxFile(
  formData: FormData,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: messages.imports.errorFileType };
  }
  if (!isOfxFile(file)) {
    return { error: messages.imports.errorFileType };
  }
  if (file.size > MAX_OFX_BYTES) {
    return { error: messages.imports.errorFileSize };
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function previewOfxAction(
  _prev: OfxPreviewState | undefined,
  formData: FormData,
): Promise<OfxPreviewState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }

  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readOfxFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const parsed = parseOfx(fileResult.bytes);
  if (!parsed.ok) {
    return { error: messages.imports.errorInvalidOfx };
  }

  const existing = await listAccountTransactionRefs(
    session.user.id,
    accountId,
  );
  if (!existing) {
    return { error: messages.imports.errorAccount };
  }

  const marked = markProbableDuplicates(parsed.rows, existing);
  const amounts =
    (await listAccountAmounts(session.user.id, accountId)) ?? [];

  return {
    accountId,
    accountBalanceCents: accountBalanceCents(amounts),
    ledgerBalanceCents: parsed.ledgerBalanceCents,
    rows: marked.map((row) => ({
      ...row,
      include: !row.probableDuplicate,
    })),
  };
}

export async function confirmOfxAction(
  _prev: OfxPreviewState | undefined,
  formData: FormData,
): Promise<OfxPreviewState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }

  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readOfxFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const parsed = parseOfx(fileResult.bytes);
  if (!parsed.ok) {
    return { error: messages.imports.errorInvalidOfx };
  }

  const includeRaw = String(formData.get("includeIndexes") ?? "");
  let includeIndexes: number[];
  try {
    const parsedIndexes = JSON.parse(includeRaw) as unknown;
    if (
      !Array.isArray(parsedIndexes) ||
      !parsedIndexes.every((value) => Number.isInteger(value))
    ) {
      return { error: messages.imports.errorGeneric };
    }
    includeIndexes = parsedIndexes as number[];
  } catch {
    return { error: messages.imports.errorGeneric };
  }

  const selected = includeIndexes
    .filter((index) => index >= 0 && index < parsed.rows.length)
    .map((index) => parsed.rows[index]);

  let saved;
  try {
    saved = await saveImportedTransactions(
      session.user.id,
      accountId,
      selected,
    );
  } catch {
    // Unique constraint or other DB failure — transaction rolls back fully.
    return { error: messages.imports.errorGeneric };
  }
  if (!saved) {
    return { error: messages.imports.errorGeneric };
  }
  const ledgerParam =
    parsed.ledgerBalanceCents === null
      ? ""
      : `&ledger=${parsed.ledgerBalanceCents}`;
  redirect(
    `/app/accounts/${accountId}?imported=${saved.length}${ledgerParam}`,
  );
}

export type CsvMappingDraft = CsvMapping;

export type CsvPreviewRow = NormalizedImportRow & {
  probableDuplicate: boolean;
  include: boolean;
};

export type CsvImportState = {
  error?: string;
  accountId?: string;
  headers?: string[];
  samples?: string[][];
  mapping?: CsvMappingDraft;
  accountBalanceCents?: number;
  rows?: CsvPreviewRow[];
};

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.type === "text/plain" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "application/octet-stream" ||
    file.type === ""
  );
}

async function readCsvFile(
  formData: FormData,
): Promise<{ bytes: Uint8Array; text: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: messages.imports.errorFileTypeCsv };
  }
  if (!isCsvFile(file)) {
    return { error: messages.imports.errorFileTypeCsv };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: messages.imports.errorFileSize };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, text: new TextDecoder("utf-8").decode(bytes) };
}

function parseOptionalColumn(raw: string): number | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function mappingFromForm(formData: FormData): CsvMapping | { error: string } {
  const dateColumn = Number(String(formData.get("dateColumn") ?? ""));
  const descriptionColumn = Number(
    String(formData.get("descriptionColumn") ?? ""),
  );
  const dateFormat = String(formData.get("dateFormat") ?? "") as CsvDateFormat;
  const decimalSeparator = String(
    formData.get("decimalSeparator") ?? "",
  ) as CsvDecimalSeparator;
  const amountMode = String(formData.get("amountMode") ?? "single");

  if (
    !Number.isInteger(dateColumn) ||
    dateColumn < 0 ||
    !Number.isInteger(descriptionColumn) ||
    descriptionColumn < 0 ||
    !csvDateFormats.includes(dateFormat) ||
    !csvDecimalSeparators.includes(decimalSeparator)
  ) {
    return { error: messages.imports.errorMapping };
  }

  const idColumn = parseOptionalColumn(String(formData.get("idColumn") ?? ""));
  if (amountMode === "split") {
    const debitColumn = parseOptionalColumn(
      String(formData.get("debitColumn") ?? ""),
    );
    const creditColumn = parseOptionalColumn(
      String(formData.get("creditColumn") ?? ""),
    );
    if (debitColumn === null || creditColumn === null) {
      return { error: messages.imports.errorMapping };
    }
    return {
      dateColumn,
      amountColumn: null,
      debitColumn,
      creditColumn,
      descriptionColumn,
      idColumn,
      dateFormat,
      decimalSeparator,
    };
  }

  const amountColumn = parseOptionalColumn(
    String(formData.get("amountColumn") ?? ""),
  );
  if (amountColumn === null) {
    return { error: messages.imports.errorMapping };
  }
  return {
    dateColumn,
    amountColumn,
    debitColumn: null,
    creditColumn: null,
    descriptionColumn,
    idColumn,
    dateFormat,
    decimalSeparator,
  };
}

function mappingFromSaved(
  saved: NonNullable<Awaited<ReturnType<typeof getCsvMapping>>>,
): CsvMapping {
  return {
    dateColumn: saved.dateColumn,
    amountColumn: saved.amountColumn,
    debitColumn: saved.debitColumn,
    creditColumn: saved.creditColumn,
    descriptionColumn: saved.descriptionColumn,
    idColumn: saved.idColumn,
    dateFormat: saved.dateFormat as CsvDateFormat,
    decimalSeparator: saved.decimalSeparator as CsvDecimalSeparator,
  };
}

export async function startCsvImportAction(
  _prev: CsvImportState | undefined,
  formData: FormData,
): Promise<CsvImportState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }
  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readCsvFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const peeked = peekCsv(fileResult.text);
  if (!peeked.ok) {
    return { error: messages.imports.errorInvalidCsv };
  }

  const saved = await getCsvMapping(session.user.id, accountId);
  const mapping = saved
    ? mappingFromSaved(saved)
    : {
        dateColumn: 0,
        amountColumn: 1,
        debitColumn: null,
        creditColumn: null,
        descriptionColumn: Math.min(3, peeked.headers.length - 1),
        idColumn: peeked.headers.length > 2 ? 2 : null,
        dateFormat: "dd/mm/yyyy" as const,
        decimalSeparator: "." as const,
      };

  return {
    accountId,
    headers: peeked.headers,
    samples: peeked.samples,
    mapping,
  };
}

export async function previewCsvAction(
  _prev: CsvImportState | undefined,
  formData: FormData,
): Promise<CsvImportState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }
  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readCsvFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const peeked = peekCsv(fileResult.text);
  if (!peeked.ok) {
    return { error: messages.imports.errorInvalidCsv };
  }

  const mapping = mappingFromForm(formData);
  if ("error" in mapping) {
    return {
      error: mapping.error,
      accountId,
      headers: peeked.headers,
      samples: peeked.samples,
    };
  }

  if (String(formData.get("saveMapping") ?? "") === "on") {
    await upsertCsvMapping(session.user.id, { accountId, ...mapping });
  }

  const parsed = parseCsv(fileResult.text, mapping);
  if (!parsed.ok) {
    return {
      error: messages.imports.errorInvalidCsv,
      accountId,
      headers: peeked.headers,
      samples: peeked.samples,
      mapping,
    };
  }

  const existing = await listAccountTransactionRefs(
    session.user.id,
    accountId,
  );
  if (!existing) {
    return { error: messages.imports.errorAccount };
  }

  const marked = markProbableDuplicates(parsed.rows, existing);
  const amounts =
    (await listAccountAmounts(session.user.id, accountId)) ?? [];

  return {
    accountId,
    headers: peeked.headers,
    samples: peeked.samples,
    mapping,
    accountBalanceCents: accountBalanceCents(amounts),
    rows: marked.map((row) => ({
      ...row,
      include: !row.probableDuplicate,
    })),
  };
}

export async function confirmCsvAction(
  _prev: CsvImportState | undefined,
  formData: FormData,
): Promise<CsvImportState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }
  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readCsvFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const mapping = mappingFromForm(formData);
  if ("error" in mapping) {
    return { error: mapping.error };
  }

  const parsed = parseCsv(fileResult.text, mapping);
  if (!parsed.ok) {
    return { error: messages.imports.errorInvalidCsv };
  }

  const includeRaw = String(formData.get("includeIndexes") ?? "");
  let includeIndexes: number[];
  try {
    const parsedIndexes = JSON.parse(includeRaw) as unknown;
    if (
      !Array.isArray(parsedIndexes) ||
      !parsedIndexes.every((value) => Number.isInteger(value))
    ) {
      return { error: messages.imports.errorGeneric };
    }
    includeIndexes = parsedIndexes as number[];
  } catch {
    return { error: messages.imports.errorGeneric };
  }

  const selected = includeIndexes
    .filter((index) => index >= 0 && index < parsed.rows.length)
    .map((index) => parsed.rows[index]);

  let saved;
  try {
    saved = await saveImportedTransactions(
      session.user.id,
      accountId,
      selected,
    );
  } catch {
    return { error: messages.imports.errorGeneric };
  }
  if (!saved) {
    return { error: messages.imports.errorGeneric };
  }
  redirect(`/app/accounts/${accountId}?imported=${saved.length}`);
}

export type PdfPreviewRow = NormalizedImportRow & {
  probableDuplicate: boolean;
  include: boolean;
};

export type PdfPreviewState = {
  error?: string;
  accountId?: string;
  accountBalanceCents?: number;
  rows?: PdfPreviewRow[];
};

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    file.type === "application/pdf" ||
    file.type === "application/octet-stream" ||
    file.type === ""
  );
}

async function readPdfFile(
  formData: FormData,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: messages.imports.errorFileTypePdf };
  }
  if (!isPdfFile(file)) {
    return { error: messages.imports.errorFileTypePdf };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: messages.imports.errorFileSize };
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()) };
}

async function parseItauPdfBytes(bytes: Uint8Array) {
  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch {
    return { ok: false as const, error: "unrecognized_itau_pdf" as const };
  }
  return parseItauStatementText(text);
}

export async function previewPdfAction(
  _prev: PdfPreviewState | undefined,
  formData: FormData,
): Promise<PdfPreviewState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }
  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readPdfFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const parsed = await parseItauPdfBytes(fileResult.bytes);
  if (!parsed.ok) {
    return { error: messages.imports.errorUnrecognizedItauPdf };
  }

  const existing = await listAccountTransactionRefs(
    session.user.id,
    accountId,
  );
  if (!existing) {
    return { error: messages.imports.errorAccount };
  }

  const marked = markProbableDuplicates(parsed.rows, existing);
  const amounts =
    (await listAccountAmounts(session.user.id, accountId)) ?? [];

  return {
    accountId,
    accountBalanceCents: accountBalanceCents(amounts),
    rows: marked.map((row) => ({
      ...row,
      include: !row.probableDuplicate,
    })),
  };
}

export async function confirmPdfAction(
  _prev: PdfPreviewState | undefined,
  formData: FormData,
): Promise<PdfPreviewState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { error: messages.imports.errorAccount };
  }
  const account = await getAccount(session.user.id, accountId);
  if (!account) {
    return { error: messages.imports.errorAccount };
  }

  const fileResult = await readPdfFile(formData);
  if ("error" in fileResult) {
    return { error: fileResult.error };
  }

  const parsed = await parseItauPdfBytes(fileResult.bytes);
  if (!parsed.ok) {
    return { error: messages.imports.errorUnrecognizedItauPdf };
  }

  const includeRaw = String(formData.get("includeIndexes") ?? "");
  let includeIndexes: number[];
  try {
    const parsedIndexes = JSON.parse(includeRaw) as unknown;
    if (
      !Array.isArray(parsedIndexes) ||
      !parsedIndexes.every((value) => Number.isInteger(value))
    ) {
      return { error: messages.imports.errorGeneric };
    }
    includeIndexes = parsedIndexes as number[];
  } catch {
    return { error: messages.imports.errorGeneric };
  }

  const selected = includeIndexes
    .filter((index) => index >= 0 && index < parsed.rows.length)
    .map((index) => parsed.rows[index]);

  let saved;
  try {
    saved = await saveImportedTransactions(
      session.user.id,
      accountId,
      selected,
    );
  } catch {
    return { error: messages.imports.errorGeneric };
  }
  if (!saved) {
    return { error: messages.imports.errorGeneric };
  }
  redirect(`/app/accounts/${accountId}?imported=${saved.length}`);
}
