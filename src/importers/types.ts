export type ImportSource = "ofx" | "csv" | "pdf" | "pluggy";

/** Normalized row produced by every importer before preview/save. */
export type NormalizedImportRow = {
  date: string;
  amountCents: number;
  description: string;
  externalId: string | null;
  source: ImportSource;
};
