import type { NormalizedImportRow } from "./types";
import { parseCsvAmountToCents, parseCsvDate } from "./csv";

export type ItauPdfParseSuccess = {
  ok: true;
  rows: NormalizedImportRow[];
};

export type ItauPdfParseFailure = {
  ok: false;
  error: "unrecognized_itau_pdf";
};

export type ItauPdfParseResult = ItauPdfParseSuccess | ItauPdfParseFailure;

const HEADER_MARKERS = [
  "extrato conta / lançamentos",
  "extrato conta / lancamentos",
];

const COLUMN_HEADER = /data\s+lan[cç]amentos\s+valor\s*\(R\$\)/i;
const ROW_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})$/;

/**
 * Parses Itaú checking-account statement text (already extracted from PDF).
 * Pure — no PDF library calls.
 */
export function parseItauStatementText(text: string): ItauPdfParseResult {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lower = normalized.toLowerCase();
  if (
    !HEADER_MARKERS.some((marker) => lower.includes(marker)) ||
    !COLUMN_HEADER.test(normalized)
  ) {
    return { ok: false, error: "unrecognized_itau_pdf" };
  }

  const lines = normalized.split("\n");
  const rows: NormalizedImportRow[] = [];
  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (COLUMN_HEADER.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) {
      continue;
    }
    if (/^aviso!/i.test(line)) {
      break;
    }
    if (/saldo do dia/i.test(line)) {
      continue;
    }

    const match = ROW_RE.exec(line);
    if (!match) {
      continue;
    }

    const date = parseCsvDate(match[1], "dd/mm/yyyy");
    const amountCents = parseCsvAmountToCents(match[3], ",");
    const description = match[2].trim();
    if (!date || amountCents === null || !description) {
      continue;
    }

    rows.push({
      date,
      amountCents,
      description,
      externalId: null,
      source: "pdf",
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "unrecognized_itau_pdf" };
  }

  return { ok: true, rows };
}

/** Extracts text from a PDF buffer using unpdf (server-only). */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
