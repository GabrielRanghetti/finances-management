import { describe, expect, test } from "vitest";

import { markProbableDuplicates } from "./duplicates";

describe("markProbableDuplicates", () => {
  test("matches by external id first", () => {
    const marked = markProbableDuplicates(
      [
        {
          date: "2026-01-10",
          amountCents: -1000,
          externalId: "a",
          description: "new amount same id",
        },
        {
          date: "2026-01-11",
          amountCents: -2000,
          externalId: "b",
          description: "new",
        },
      ],
      [{ date: "2026-01-10", amountCents: -999, externalId: "a" }],
    );

    expect(marked.map((row) => row.probableDuplicate)).toEqual([true, false]);
  });

  test("matches date+amount by count when ids differ or are missing", () => {
    const marked = markProbableDuplicates(
      [
        { date: "2026-01-10", amountCents: -1000, externalId: "file-1" },
        { date: "2026-01-10", amountCents: -1000, externalId: "file-2" },
        { date: "2026-01-10", amountCents: -1000, externalId: null },
      ],
      [
        { date: "2026-01-10", amountCents: -1000, externalId: "pluggy-1" },
        { date: "2026-01-10", amountCents: -1000, externalId: null },
      ],
    );

    expect(marked.map((row) => row.probableDuplicate)).toEqual([
      true,
      true,
      false,
    ]);
  });

  test("an external-id match consumes that existing row for date+amount", () => {
    const marked = markProbableDuplicates(
      [
        { date: "2026-01-10", amountCents: -1000, externalId: "same" },
        { date: "2026-01-10", amountCents: -1000, externalId: null },
      ],
      [{ date: "2026-01-10", amountCents: -1000, externalId: "same" }],
    );

    expect(marked.map((row) => row.probableDuplicate)).toEqual([true, false]);
  });
});
