import type { NormalizedImportRow } from "./types";

export type OfxParseSuccess = {
  ok: true;
  rows: NormalizedImportRow[];
  ledgerBalanceCents: number | null;
};

export type OfxParseFailure = {
  ok: false;
  error: "invalid_ofx";
};

export type OfxParseResult = OfxParseSuccess | OfxParseFailure;

function decodeOfxBytes(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 256));
  const encoding = /ENCODING:([^\r\n]+)/i.exec(head)?.[1]?.trim().toUpperCase();
  const charset = /CHARSET:([^\r\n]+)/i.exec(head)?.[1]?.trim().toUpperCase();

  if (
    encoding === "USASCII" ||
    charset === "1252" ||
    charset === "ISO-8859-1"
  ) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function tagValue(block: string, tag: string): string | null {
  const closed = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(block);
  if (closed) {
    return closed[1].trim();
  }
  const sgml = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return sgml ? sgml[1].trim() : null;
}

/** OFX dates like 20261005000000[-3:BRT] → YYYY-MM-DD */
export function parseOfxDate(raw: string): string | null {
  const digits = raw.replace(/\[.*$/, "").trim();
  if (!/^\d{8}/.test(digits)) {
    return null;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** OFX amounts use a dot decimal and an optional leading minus. */
export function parseOfxAmountToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const negative = trimmed.startsWith("-");
  const unsigned =
    negative || trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(unsigned)) {
    return null;
  }
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function parseStmtTrn(block: string): NormalizedImportRow | null {
  const dateRaw = tagValue(block, "DTPOSTED");
  const amountRaw = tagValue(block, "TRNAMT");
  if (!dateRaw || !amountRaw) {
    return null;
  }
  const date = parseOfxDate(dateRaw);
  const amountCents = parseOfxAmountToCents(amountRaw);
  if (!date || amountCents === null) {
    return null;
  }

  const memo = tagValue(block, "MEMO");
  const name = tagValue(block, "NAME");
  const trnType = tagValue(block, "TRNTYPE");
  const description = (memo || name || trnType || "OFX").trim();
  const fitid = tagValue(block, "FITID");

  return {
    date,
    amountCents,
    description,
    externalId: fitid || null,
    source: "ofx",
  };
}

/**
 * Parses bank (STMTRS) and card (CCSTMTRS) OFX SGML statements.
 * No library — Nubank-style subset only.
 */
export function parseOfx(input: string | Uint8Array): OfxParseResult {
  const text =
    typeof input === "string" ? input : decodeOfxBytes(input);

  if (!/<OFX>/i.test(text) || !/<STMTTRN>/i.test(text)) {
    return { ok: false, error: "invalid_ofx" };
  }

  if (!/<STMTRS>/i.test(text) && !/<CCSTMTRS>/i.test(text)) {
    return { ok: false, error: "invalid_ofx" };
  }

  const rows: NormalizedImportRow[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  while ((match = trnRegex.exec(text)) !== null) {
    const row = parseStmtTrn(match[1]);
    if (row) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "invalid_ofx" };
  }

  const ledgerBlock = /<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i.exec(text)?.[1];
  const ledgerRaw = ledgerBlock ? tagValue(ledgerBlock, "BALAMT") : null;
  const ledgerBalanceCents =
    ledgerRaw !== null ? parseOfxAmountToCents(ledgerRaw) : null;

  return {
    ok: true,
    rows,
    ledgerBalanceCents,
  };
}
