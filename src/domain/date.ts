const saoPauloDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's ISO calendar date (YYYY-MM-DD) in America/Sao_Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = saoPauloDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}
