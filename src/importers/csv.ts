import type { NormalizedImportRow } from "./types";

export type CsvDateFormat = "dd/mm/yyyy" | "yyyy-mm-dd" | "mm/dd/yyyy";
export type CsvDecimalSeparator = "." | ",";

export type CsvMapping = {
  dateColumn: number;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  descriptionColumn: number;
  idColumn: number | null;
  dateFormat: CsvDateFormat;
  decimalSeparator: CsvDecimalSeparator;
};

export type CsvParseSuccess = {
  ok: true;
  rows: NormalizedImportRow[];
  headers: string[];
};

export type CsvParseFailure = {
  ok: false;
  error: "invalid_csv" | "invalid_mapping";
};

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

/** Split a CSV line, honouring double-quoted fields. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

export function detectCsvDelimiter(headerLine: string): "," | ";" {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

export function parseCsvDate(
  raw: string,
  format: CsvDateFormat,
): string | null {
  const value = raw.trim();
  if (format === "yyyy-mm-dd") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    return value;
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }
  const a = Number(match[1]);
  const b = Number(match[2]);
  const year = match[3];
  const day = format === "dd/mm/yyyy" ? a : b;
  const month = format === "dd/mm/yyyy" ? b : a;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseCsvAmountToCents(
  raw: string,
  decimalSeparator: CsvDecimalSeparator,
): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    return null;
  }
  const negative =
    trimmed.startsWith("-") ||
    (trimmed.startsWith("(") && trimmed.endsWith(")"));
  let unsigned = trimmed.replace(/^[+(]+/, "").replace(/\)+$/, "");
  if (negative && unsigned.startsWith("-")) {
    unsigned = unsigned.slice(1);
  }

  if (decimalSeparator === ",") {
    // 1.234,56 or 1234,56
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(unsigned)) {
      return null;
    }
    const [whole, fraction = ""] = unsigned.replace(/\./g, "").split(",");
    const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
    return negative ? -cents : cents;
  }

  // 1,234.56 or 1234.56
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(unsigned)) {
    return null;
  }
  const [whole, fraction = ""] = unsigned.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function mappingValid(mapping: CsvMapping): boolean {
  if (mapping.dateColumn < 0 || mapping.descriptionColumn < 0) {
    return false;
  }
  const hasAmount = mapping.amountColumn !== null && mapping.amountColumn >= 0;
  const hasDebitCredit =
    mapping.debitColumn !== null &&
    mapping.debitColumn >= 0 &&
    mapping.creditColumn !== null &&
    mapping.creditColumn >= 0;
  return hasAmount || hasDebitCredit;
}

/**
 * Parses a CSV into normalized import rows using an explicit column mapping.
 * Pure — no database access.
 */
export function parseCsv(
  input: string | Uint8Array,
  mapping: CsvMapping,
): CsvParseResult {
  if (!mappingValid(mapping)) {
    return { ok: false, error: "invalid_mapping" };
  }

  const text =
    typeof input === "string"
      ? input
      : new TextDecoder("utf-8").decode(input);
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "invalid_csv" };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows: NormalizedImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const fields = splitCsvLine(lines[i], delimiter);
    const dateRaw = fields[mapping.dateColumn] ?? "";
    const description = (fields[mapping.descriptionColumn] ?? "").trim();
    const date = parseCsvDate(dateRaw, mapping.dateFormat);
    if (!date || !description) {
      continue;
    }

    let amountCents: number | null = null;
    if (mapping.amountColumn !== null && mapping.amountColumn >= 0) {
      amountCents = parseCsvAmountToCents(
        fields[mapping.amountColumn] ?? "",
        mapping.decimalSeparator,
      );
    } else {
      const debit = parseCsvAmountToCents(
        fields[mapping.debitColumn!] ?? "",
        mapping.decimalSeparator,
      );
      const credit = parseCsvAmountToCents(
        fields[mapping.creditColumn!] ?? "",
        mapping.decimalSeparator,
      );
      if (debit !== null && debit !== 0) {
        amountCents = debit > 0 ? -debit : debit;
      } else if (credit !== null) {
        amountCents = Math.abs(credit);
      }
    }

    if (amountCents === null) {
      continue;
    }

    const externalId =
      mapping.idColumn !== null && mapping.idColumn >= 0
        ? (fields[mapping.idColumn] ?? "").trim() || null
        : null;

    rows.push({
      date,
      amountCents,
      description,
      externalId,
      source: "csv",
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "invalid_csv" };
  }

  return { ok: true, rows, headers };
}

/** Peek headers and a few sample rows for the mapping UI. */
export function peekCsv(input: string | Uint8Array): {
  ok: true;
  delimiter: "," | ";";
  headers: string[];
  samples: string[][];
} | { ok: false; error: "invalid_csv" } {
  const text =
    typeof input === "string"
      ? input
      : new TextDecoder("utf-8").decode(input);
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "invalid_csv" };
  }
  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const samples = lines
    .slice(1, 4)
    .map((line) => splitCsvLine(line, delimiter));
  return { ok: true, delimiter, headers, samples };
}
