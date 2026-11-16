import { describe, expect, test } from "vitest";

import {
  convertForeignCentsToBrl,
  mulDivHalfUp,
  parseDecimalString,
} from "./fx";

describe("parseDecimalString", () => {
  test("keeps scale without floats", () => {
    expect(parseDecimalString("5.55490")).toEqual({
      scaled: BigInt(555490),
      scale: 5,
    });
    expect(parseDecimalString("1")).toEqual({ scaled: BigInt(1), scale: 0 });
  });
});

describe("mulDivHalfUp", () => {
  test("rounds half away from zero", () => {
    expect(mulDivHalfUp(BigInt(1), BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(mulDivHalfUp(BigInt(-1), BigInt(5), BigInt(2))).toBe(BigInt(-3));
  });
});

describe("convertForeignCentsToBrl", () => {
  test("converts a held balance with the buy rate (hand-worked)", () => {
    // 100.00 USD * 5.55490 = 555.49 BRL → 55549 cents
    expect(convertForeignCentsToBrl(10_000, "5.55490", "5.55550")).toBe(55_549);
  });

  test("converts a negative balance with the sell rate (hand-worked)", () => {
    // -50.00 USD * 5.55550 = -277.775 → half up to -277.78 → -27778 cents
    expect(convertForeignCentsToBrl(-5_000, "5.55490", "5.55550")).toBe(
      -27_778,
    );
  });
});
