export const valuedAccountTypes = ["property", "vehicle", "other"] as const;
export type ValuedAccountType = (typeof valuedAccountTypes)[number];

export function isValuedAccountType(type: string): type is ValuedAccountType {
  return (valuedAccountTypes as readonly string[]).includes(type);
}

export type ValuationPoint = {
  date: string;
  valueCents: number;
};

/** Latest valuation on or before asOfDate; otherwise acquisition cost (or 0). */
export function valuedBalanceOnDate(
  asOfDate: string,
  acquisitionCostCents: number | null | undefined,
  valuations: readonly ValuationPoint[],
): number {
  let latest: ValuationPoint | null = null;
  for (const point of valuations) {
    if (point.date > asOfDate) {
      continue;
    }
    if (!latest || point.date > latest.date) {
      latest = point;
    }
  }
  if (latest) {
    return latest.valueCents;
  }
  return acquisitionCostCents ?? 0;
}
