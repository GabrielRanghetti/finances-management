export type PluggyAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  currencyCode: string;
  marketingName: string | null;
};

export type PluggyTransaction = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: string;
};

export type PluggyItem = {
  id: string;
  status: string;
  executionStatus: string | null;
  error: { code?: string; message?: string } | null;
};

export class PluggyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PluggyApiError";
  }
}

/** Accepts a bare UUID or a Pluggy dashboard URL that contains one. */
export function extractPluggyItemId(raw: string): string | null {
  const match = raw
    .trim()
    .match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
    );
  return match ? match[0].toLowerCase() : null;
}

function requireCredentials() {
  const clientId = process.env.PLUGGY_API_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_API_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new PluggyApiError("missing_credentials", 0, "MISSING_CREDENTIALS");
  }
  return { clientId, clientSecret };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function createPluggyApiKey(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const { clientId, clientSecret } = requireCredentials();
  const response = await fetchImpl("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const body = (await readJson(response)) as { apiKey?: string } | null;
  if (!response.ok || !body?.apiKey) {
    throw new PluggyApiError("auth_failed", response.status);
  }
  return body.apiKey;
}

async function pluggyGet(
  path: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const url = path.startsWith("http")
    ? path
    : `https://api.pluggy.ai${path}`;
  const response = await fetchImpl(url, {
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
  });
  const body = await readJson(response);
  if (!response.ok) {
    const code =
      body && typeof body === "object" && "codeDescription" in body
        ? String((body as { codeDescription?: string }).codeDescription)
        : undefined;
    throw new PluggyApiError("request_failed", response.status, code);
  }
  return body;
}

export async function getPluggyItem(
  itemId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PluggyItem> {
  const body = (await pluggyGet(`/items/${itemId}`, apiKey, fetchImpl)) as {
    id: string;
    status: string;
    executionStatus?: string | null;
    error?: { code?: string; message?: string } | null;
  };
  return {
    id: body.id,
    status: body.status,
    executionStatus: body.executionStatus ?? null,
    error: body.error ?? null,
  };
}

export async function listPluggyAccounts(
  itemId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PluggyAccount[]> {
  const body = (await pluggyGet(
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
    apiKey,
    fetchImpl,
  )) as { results?: Array<Record<string, unknown>> };
  return (body.results ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? row.marketingName ?? "Conta"),
    type: String(row.type ?? ""),
    subtype: row.subtype == null ? null : String(row.subtype),
    currencyCode: String(row.currencyCode ?? "BRL"),
    marketingName:
      row.marketingName == null ? null : String(row.marketingName),
  }));
}

export async function listPluggyTransactions(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PluggyTransaction[]> {
  const rows: PluggyTransaction[] = [];
  let path: string | null =
    `/v2/transactions?accountId=${encodeURIComponent(accountId)}` +
    `&dateFrom=${encodeURIComponent(dateFrom)}` +
    `&dateTo=${encodeURIComponent(dateTo)}`;

  while (path) {
    const body = (await pluggyGet(path, apiKey, fetchImpl)) as {
      results?: Array<Record<string, unknown>>;
      next?: string | null;
    };
    for (const row of body.results ?? []) {
      rows.push({
        id: String(row.id),
        accountId: String(row.accountId),
        date: String(row.date),
        description: String(row.description ?? row.descriptionRaw ?? "Pluggy"),
        amount: Number(row.amount),
        type: String(row.type ?? ""),
      });
    }
    path = body.next ?? null;
  }

  return rows;
}
