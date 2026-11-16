/** Split a purchase into N installment amounts (cents). Remainder goes on the first. */
export function splitInstallmentAmounts(
  totalCents: number,
  installmentCount: number,
): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("invalid total");
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw new Error("invalid count");
  }

  const base = Math.floor(totalCents / installmentCount);
  const remainder = totalCents - base * installmentCount;
  const amounts = Array.from({ length: installmentCount }, () => base);
  amounts[0] += remainder;
  return amounts;
}

/** Add calendar months to a YYYY-MM-DD date, clamping the day to the target month. */
export function addMonths(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error("invalid date");
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1 + months;
  const day = Number(match[3]);
  const target = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function installmentDates(
  purchaseDate: string,
  installmentCount: number,
): string[] {
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw new Error("invalid count");
  }
  return Array.from({ length: installmentCount }, (_, index) =>
    addMonths(purchaseDate, index),
  );
}

export function installmentDescription(
  baseDescription: string,
  index: number,
  installmentCount: number,
): string {
  return `${baseDescription} ${index}/${installmentCount}`;
}

export function installmentBaseDescription(description: string): string {
  const match = /^(.*) (\d+)\/(\d+)$/.exec(description);
  return match ? match[1] : description;
}

export type StatementPeriod = {
  from: string;
  to: string;
};

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampClosingDay(year: number, monthIndex: number, closingDay: number): string {
  const day = Math.min(closingDay, daysInMonth(year, monthIndex));
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(isoDate: string): { year: number; monthIndex: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error("invalid date");
  }
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

/** Statement period containing `date`, ending on the closing day of that cycle. */
export function statementPeriodContaining(
  closingDay: number,
  date: string,
): StatementPeriod {
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
    throw new Error("invalid closing day");
  }

  const { year, monthIndex, day } = parseIsoDate(date);
  const closingThisMonth = Math.min(closingDay, daysInMonth(year, monthIndex));

  let endYear = year;
  let endMonthIndex = monthIndex;
  if (day > closingThisMonth) {
    endMonthIndex += 1;
    if (endMonthIndex > 11) {
      endMonthIndex = 0;
      endYear += 1;
    }
  }

  const to = clampClosingDay(endYear, endMonthIndex, closingDay);
  let startYear = endYear;
  let startMonthIndex = endMonthIndex - 1;
  if (startMonthIndex < 0) {
    startMonthIndex = 11;
    startYear -= 1;
  }
  const previousClosing = clampClosingDay(startYear, startMonthIndex, closingDay);
  const prev = parseIsoDate(previousClosing);
  const nextDay = new Date(Date.UTC(prev.year, prev.monthIndex, prev.day + 1));
  return { from: nextDay.toISOString().slice(0, 10), to };
}

export function statementTotalCents(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}
