"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAccount, listAccounts } from "@/db/accounts";
import {
  createConnection,
  getConnection,
  listConnectionAccountMaps,
  updateConnectionStatus,
  upsertConnectionAccountMap,
} from "@/db/connections";
import { getEntity } from "@/db/entities";
import {
  listAccountTransactionRefs,
  saveImportedTransactionGroups,
} from "@/db/imports";
import type { AccountType } from "@/db/schema";
import { markProbableDuplicates } from "@/domain/duplicates";
import {
  createPluggyApiKey,
  extractPluggyItemId,
  getPluggyItem,
  listPluggyAccounts,
  listPluggyTransactions,
  PluggyApiError,
} from "@/integrations/pluggy/client";
import {
  isPluggyConnectionFailed,
  pluggyTransactionsToRows,
} from "@/integrations/pluggy/map";
import type { NormalizedImportRow } from "@/importers/types";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

const SYNC_OVERLAP_DAYS = 3;

async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

function accountTypeFromPluggy(type: string, subtype: string | null): AccountType {
  if (type === "CREDIT" || subtype === "CREDIT_CARD") {
    return "credit_card";
  }
  return "bank";
}

function syncWindow(lastSyncAt: Date | null): { from: string; to: string } {
  const to = new Date();
  const from = lastSyncAt
    ? new Date(lastSyncAt.getTime() - SYNC_OVERLAP_DAYS * 24 * 60 * 60 * 1000)
    : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function createPluggyConnectionAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const itemId = extractPluggyItemId(String(formData.get("itemId") ?? ""));
  const entityId = String(formData.get("entityId") ?? "").trim();
  if (!itemId) {
    return { error: messages.connections.errorItemId };
  }
  if (!entityId || !(await getEntity(session.user.id, entityId))) {
    return { error: messages.connections.errorEntity };
  }

  let created;
  try {
    created = await createConnection(session.user.id, {
      itemId,
      entityId,
    });
  } catch {
    return { error: messages.connections.errorGeneric };
  }
  if (!created) {
    return { error: messages.connections.errorGeneric };
  }
  redirect(`/app/connections/${created.id}/map`);
}

export async function saveConnectionMapsAction(
  connectionId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const connection = await getConnection(session.user.id, connectionId);
  if (!connection) {
    return { error: messages.connections.errorNotFound };
  }

  const pluggyIds = formData.getAll("pluggyAccountId").map(String);
  for (const pluggyAccountId of pluggyIds) {
    const mode = String(formData.get(`mode_${pluggyAccountId}`) ?? "existing");
    let accountId = String(
      formData.get(`accountId_${pluggyAccountId}`) ?? "",
    ).trim();

    if (mode === "create") {
      const name = String(
        formData.get(`newName_${pluggyAccountId}`) ?? "",
      ).trim();
      const type = String(
        formData.get(`newType_${pluggyAccountId}`) ?? "bank",
      ) as AccountType;
      if (!name) {
        return { error: messages.connections.errorMap };
      }
      const created = await createAccount(session.user.id, {
        name,
        type,
        currency: "BRL",
        entityId: connection.entityId,
      });
      accountId = created.id;
    }

    if (!accountId) {
      continue;
    }

    const mapped = await upsertConnectionAccountMap(session.user.id, {
      connectionId,
      pluggyAccountId,
      accountId,
    });
    if (!mapped) {
      return { error: messages.connections.errorMap };
    }
  }
  redirect(`/app/connections/${connectionId}`);
}

export type SyncPreviewState = {
  error?: string;
  connectionId?: string;
  rowsByAccount?: Array<{
    accountId: string;
    accountName: string;
    rows: Array<NormalizedImportRow & { probableDuplicate: boolean; include: boolean }>;
  }>;
};

export async function previewPluggySyncAction(
  connectionId: string,
  _prev: SyncPreviewState | undefined,
  formData: FormData,
): Promise<SyncPreviewState> {
  void formData;
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const connection = await getConnection(session.user.id, connectionId);
  if (!connection) {
    return { error: messages.connections.errorNotFound };
  }

  let apiKey: string;
  try {
    apiKey = await createPluggyApiKey();
  } catch (error) {
    if (error instanceof PluggyApiError && error.code === "MISSING_CREDENTIALS") {
      return { error: messages.connections.errorCredentials };
    }
    return { error: messages.connections.errorSync };
  }

  try {
    const item = await getPluggyItem(connection.itemId, apiKey);
    if (isPluggyConnectionFailed(item)) {
      await updateConnectionStatus(session.user.id, connectionId, {
        status: item.status === "OUTDATED" ? "expired" : "error",
        lastError: messages.connections.errorFailed,
      });
      return { error: messages.connections.errorFailed };
    }

    const maps = await listConnectionAccountMaps(session.user.id, connectionId);
    if (maps.length === 0) {
      return { error: messages.connections.errorMap };
    }

    const accounts = await listAccounts(session.user.id, {
      includeArchived: true,
    });
    const accountName = new Map(accounts.map((row) => [row.id, row.name]));
    const window = syncWindow(connection.lastSyncAt);

    const rowsByAccount = [];
    for (const map of maps) {
      const txs = await listPluggyTransactions(
        map.pluggyAccountId,
        window.from,
        window.to,
        apiKey,
      );
      const rows = pluggyTransactionsToRows(txs);
      const existing = await listAccountTransactionRefs(
        session.user.id,
        map.accountId,
      );
      if (!existing) {
        return { error: messages.connections.errorSync };
      }
      const marked = markProbableDuplicates(rows, existing);
      rowsByAccount.push({
        accountId: map.accountId,
        accountName: accountName.get(map.accountId) ?? map.accountId,
        rows: marked.map((row) => ({
          ...row,
          include: !row.probableDuplicate,
        })),
      });
    }

    await updateConnectionStatus(session.user.id, connectionId, {
      status: "active",
      lastError: null,
    });

    return { connectionId, rowsByAccount };
  } catch {
    await updateConnectionStatus(session.user.id, connectionId, {
      status: "error",
      lastError: messages.connections.errorSync,
    });
    return { error: messages.connections.errorSync };
  }
}

export async function confirmPluggySyncAction(
  connectionId: string,
  _prev: SyncPreviewState | undefined,
  formData: FormData,
): Promise<SyncPreviewState> {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }

  const connection = await getConnection(session.user.id, connectionId);
  if (!connection) {
    return { error: messages.connections.errorNotFound };
  }

  const payloadRaw = String(formData.get("payload") ?? "");
  let payload: Array<{ accountId: string; rows: NormalizedImportRow[] }>;
  try {
    payload = JSON.parse(payloadRaw) as typeof payload;
    if (!Array.isArray(payload)) {
      return { error: messages.connections.errorSync };
    }
  } catch {
    return { error: messages.connections.errorSync };
  }

  // Re-check ownership of every account before writing.
  for (const group of payload) {
    const refs = await listAccountTransactionRefs(
      session.user.id,
      group.accountId,
    );
    if (!refs) {
      return { error: messages.connections.errorSync };
    }
  }

  let saved;
  try {
    saved = await saveImportedTransactionGroups(session.user.id, payload);
  } catch {
    return { error: messages.connections.errorSync };
  }
  if (!saved) {
    return { error: messages.connections.errorSync };
  }

  await updateConnectionStatus(session.user.id, connectionId, {
    status: "active",
    lastError: null,
    lastSyncAt: new Date(),
  });

  redirect(`/app/connections/${connectionId}?synced=${saved.length}`);
}

export async function loadPluggyAccountsForMapping(connectionId: string) {
  const session = await requireSession();
  if (!session) {
    redirect("/sign-in");
  }
  const connection = await getConnection(session.user.id, connectionId);
  if (!connection) {
    return { error: messages.connections.errorNotFound as string };
  }
  try {
    const apiKey = await createPluggyApiKey();
    const item = await getPluggyItem(connection.itemId, apiKey);
    if (isPluggyConnectionFailed(item)) {
      await updateConnectionStatus(session.user.id, connectionId, {
        status: item.status === "OUTDATED" ? "expired" : "error",
        lastError: messages.connections.errorFailed,
      });
      return { error: messages.connections.errorFailed };
    }
    const pluggyAccounts = await listPluggyAccounts(connection.itemId, apiKey);
    return {
      pluggyAccounts: pluggyAccounts.map((account) => ({
        ...account,
        suggestedType: accountTypeFromPluggy(account.type, account.subtype),
      })),
    };
  } catch (error) {
    if (error instanceof PluggyApiError && error.code === "MISSING_CREDENTIALS") {
      return { error: messages.connections.errorCredentials };
    }
    return { error: messages.connections.errorSync };
  }
}
