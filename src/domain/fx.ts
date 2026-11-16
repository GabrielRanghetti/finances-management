/** Parse a decimal string like "5.55490" into scaled integers (no floats). */
export function parseDecimalString(value: string): {
  scaled: bigint;
  scale: number;
} {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("invalid decimal");
  }
  const negative = trimmed.startsWith("-");
  const raw = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ""] = raw.split(".");
  const scale = fraction.length;
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  const scaled = BigInt(digits);
  return { scaled: negative ? -scaled : scaled, scale };
}

/** Multiply then divide with round-half-away-from-zero (commercial half up). */
export function mulDivHalfUp(amount: bigint, num: bigint, den: bigint): bigint {
  if (den === BigInt(0)) {
    throw new Error("division by zero");
  }
  const product = amount * num;
  const half = den / BigInt(2);
  if (product >= BigInt(0)) {
    return (product + half) / den;
  }
  return (product - half) / den;
}

/**
 * Convert foreign-currency cents to BRL cents with integer math only.
 * Non-negative balances use the buy rate; negative balances use the sell rate.
 */
export function convertForeignCentsToBrl(
  foreignCents: number,
  buyRate: string,
  sellRate: string,
): number {
  if (!Number.isInteger(foreignCents)) {
    throw new Error("foreign cents must be an integer");
  }
  const rate = foreignCents < 0 ? sellRate : buyRate;
  const { scaled, scale } = parseDecimalString(rate);
  const denominator = BigInt(10) ** BigInt(scale);
  return Number(mulDivHalfUp(BigInt(foreignCents), scaled, denominator));
}
