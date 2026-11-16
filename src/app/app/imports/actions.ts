"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAccount } from "@/db/accounts";
import {
  listAccountTransactionRefs,
  saveImportedTransactions,
} from "@/db/imports";
import { listAccountAmounts } from "@/db/transactions";
import {
  markProbableDuplicates,
} from "@/domain/duplicates";
import { accountBalanceCents } from "@/domain/money";
import { parseOfx } from "@/importers/ofx";
import type { NormalizedImportRow } from "@/importers/types";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

const MAX_OFX_BYTES = 5 * 1024 * 1024;

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
