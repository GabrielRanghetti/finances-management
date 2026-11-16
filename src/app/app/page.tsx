import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getNetWorthOverview, type OverviewHistoryPoint } from "@/db/overview";
import {
  formatBalanceCentsToBrl,
  formatSignedCentsToBrl,
} from "@/domain/money";
import type { OverviewScope } from "@/domain/overview";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ scope?: string }>;
};

function parseScope(value: string | undefined): OverviewScope {
  if (value === "pf" || value === "pj") {
    return value;
  }
  return "all";
}

function scopeTitle(scope: OverviewScope): string {
  if (scope === "pf") {
    return messages.overview.titlePf;
  }
  if (scope === "pj") {
    return messages.overview.titlePj;
  }
  return messages.overview.titleAll;
}

function scopeTransferNote(scope: OverviewScope): string {
  if (scope === "pf") {
    return messages.overview.transferNotePf;
  }
  if (scope === "pj") {
    return messages.overview.transferNotePj;
  }
  return messages.overview.transferNoteAll;
}

function formatFullDatePtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthName = messages.overview.monthsFull[(month ?? 1) - 1] ?? "";
  return `${day} de ${monthName} de ${year}`;
}

function formatShortDatePtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatMonthFullName(isoDate: string): string {
  const [, month] = isoDate.split("-").map(Number);
  return messages.overview.monthsFull[(month ?? 1) - 1] ?? "";
}

function formatMonthShortName(isoDate: string): string {
  const [, month] = isoDate.split("-").map(Number);
  return messages.overview.monthsShort[(month ?? 1) - 1] ?? "";
}

function formatRatePtBr(rate: string): string {
  return rate.replace(".", ",");
}

function signedColorClass(cents: number): string {
  if (cents > 0) {
    return "text-positive";
  }
  if (cents < 0) {
    return "text-negative";
  }
  return "text-foreground";
}

function balanceColorClass(cents: number): string {
  return cents < 0 ? "text-negative" : "text-foreground";
}

function accountClassLabel(accountClass: string): string {
  const types = messages.accounts.types as Record<string, string>;
  return types[accountClass] ?? accountClass;
}

function computeChartGeometry(points: readonly OverviewHistoryPoint[]) {
  const values =
    points.length > 0 ? points.map((point) => point.netWorthCents) : [0];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  let lo = minVal;
  let hi = maxVal;
  if (lo === hi) {
    if (lo === 0) {
      hi = 100_000;
    } else if (lo > 0) {
      lo = 0;
    } else {
      hi = 0;
    }
  }
  const mid = Math.round((lo + hi) / 2);
  const span = hi - lo || 1;

  const yTop = 16;
  const yBottom = 140;
  const xStart = 8;
  const xEnd = 632;
  const count = Math.max(points.length, 1);

  const coords = points.map((point, index) => {
    const ratioX = count > 1 ? index / (count - 1) : 1;
    const x = Math.round((xStart + ratioX * (xEnd - xStart)) * 10) / 10;
    const ratioY = (point.netWorthCents - lo) / span;
    const y =
      Math.round((yBottom - ratioY * (yBottom - yTop)) * 10) / 10;
    return { x, y, date: point.date, netWorthCents: point.netWorthCents };
  });

  const polylinePoints = coords.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const lastCoord = coords[coords.length - 1] ?? {
    x: xEnd,
    y: yBottom,
    date: "",
    netWorthCents: 0,
  };

  return {
    lo,
    mid,
    hi,
    coords,
    polylinePoints,
    lastCoord,
  };
}

export default async function AppHomePage({ searchParams }: Props = {}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = searchParams ? await searchParams : {};
  const scope = parseScope(params.scope);
  const today = new Date().toISOString().slice(0, 10);
  const overview = await getNetWorthOverview(session.user.id, scope, today);
  const title = scopeTitle(overview.scope);

  const scopeLinks: { value: OverviewScope; label: string; href: string }[] = [
    {
      value: "pf",
      label: messages.overview.scopePf,
      href: "/app?scope=pf",
    },
    {
      value: "pj",
      label: messages.overview.scopePj,
      href: "/app?scope=pj",
    },
    {
      value: "all",
      label: messages.overview.scopeAll,
      href: "/app?scope=all",
    },
  ];

  const chart = computeChartGeometry(overview.history);
  const firstPointCents = overview.history[0]?.netWorthCents ?? 0;
  const lastPointCents =
    overview.history[overview.history.length - 1]?.netWorthCents ??
    overview.netWorthCents;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex items-center justify-between">
        <div
          role="group"
          aria-label={messages.overview.scopeAria}
          className="inline-flex w-full rounded-lg bg-secondary p-1 min-[60rem]:w-auto"
        >
          {scopeLinks.map((item) => {
            const active = overview.scope === item.value;
            return (
              <Link
                key={item.value}
                href={item.href}
                aria-current={active ? "true" : undefined}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium no-underline transition-opacity duration-150 min-[60rem]:min-h-9 min-[60rem]:flex-initial ${
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!overview.hasAccounts ? (
        <article className="rounded-lg border border-border bg-card p-6 shadow-xs min-[60rem]:p-10">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {messages.overview.emptyBody}
          </p>
          <div className="mt-6">
            <Link
              href="/app/accounts/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground no-underline transition-[transform,opacity] duration-150 hover:opacity-90 active:translate-y-px min-[60rem]:min-h-10"
            >
              {messages.overview.emptyAction}
            </Link>
          </div>
        </article>
      ) : (
        <div className="flex flex-col gap-8 min-[60rem]:flex-row min-[60rem]:items-start min-[60rem]:gap-10">
          <article className="min-w-0 flex-1 rounded-lg border border-border bg-card p-5 shadow-xs min-[60rem]:p-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {messages.overview.headingWithDate(
                  title,
                  formatFullDatePtBr(overview.asOfDate),
                )}
              </p>
              <h1
                className={`mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums break-words min-[60rem]:text-5xl ${balanceColorClass(
                  overview.netWorthCents,
                )}`}
              >
                {formatBalanceCentsToBrl(overview.netWorthCents, true)}
              </h1>
              <p className="mt-2 text-sm text-foreground">
                <span
                  className={`font-mono tabular-nums ${signedColorClass(
                    overview.changeMonthCents,
                  )}`}
                >
                  {formatSignedCentsToBrl(overview.changeMonthCents, true)}
                </span>{" "}
                {messages.overview.inMonth(
                  formatMonthFullName(overview.asOfDate),
                )}{" "}
                <span
                  className={`font-mono tabular-nums ${signedColorClass(
                    overview.change12MonthsCents,
                  )}`}
                >
                  {formatSignedCentsToBrl(overview.change12MonthsCents, true)}
                </span>{" "}
                {messages.overview.in12Months}
              </p>
            </div>

            <svg
              viewBox="0 0 640 170"
              role="img"
              aria-label={messages.overview.chartAria(
                title,
                formatBalanceCentsToBrl(firstPointCents, true),
                formatBalanceCentsToBrl(lastPointCents, true),
              )}
              className="mt-8 block h-auto w-full"
            >
              <line
                x1="0"
                y1="16"
                x2="640"
                y2="16"
                className="stroke-border stroke-1"
              />
              <line
                x1="0"
                y1="78"
                x2="640"
                y2="78"
                className="stroke-border stroke-1"
              />
              <line
                x1="0"
                y1="140"
                x2="640"
                y2="140"
                className="stroke-border stroke-1"
              />
              <text
                x="0"
                y="11"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {formatBalanceCentsToBrl(chart.hi, true)}
              </text>
              <text
                x="0"
                y="73"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {formatBalanceCentsToBrl(chart.mid, true)}
              </text>
              <text
                x="0"
                y="135"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {formatBalanceCentsToBrl(chart.lo, true)}
              </text>
              <polyline
                points={chart.polylinePoints}
                className="fill-none stroke-foreground stroke-2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={chart.lastCoord.x}
                cy={chart.lastCoord.y}
                r="4"
                className="fill-foreground"
              />
              {chart.coords.map((pt, idx) => {
                const anchor =
                  idx === 0
                    ? "start"
                    : idx === chart.coords.length - 1
                      ? "end"
                      : "middle";
                return (
                  <text
                    key={pt.date || idx}
                    x={pt.x}
                    y="162"
                    textAnchor={anchor}
                    className="fill-muted-foreground font-sans text-[12px]"
                  >
                    {formatMonthShortName(pt.date)}
                  </text>
                );
              })}
            </svg>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {chart.lo !== 0
                ? messages.overview.chartCaptionNonZero(
                    formatBalanceCentsToBrl(chart.lo, true),
                  )
                : messages.overview.chartCaptionZero}
            </p>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-border py-3 text-left text-sm font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {messages.overview.whatYouHave}
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border py-3 text-right text-sm font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {messages.overview.valueInBrl}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ledger.assets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="border-b border-border py-3 text-muted-foreground"
                      >
                        {messages.overview.emptyClassRow}
                      </td>
                    </tr>
                  ) : (
                    overview.ledger.assets.map((row) => (
                      <tr key={row.accountClass}>
                        <td className="border-b border-border py-3">
                          {accountClassLabel(row.accountClass)}
                        </td>
                        <td
                          className={`border-b border-border py-3 text-right font-mono tabular-nums ${balanceColorClass(
                            row.balanceCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.balanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="font-semibold">
                    <td className="border-b border-border py-3">
                      {messages.overview.whatYouHaveTotal}
                    </td>
                    <td
                      className={`border-b border-border py-3 text-right font-mono tabular-nums ${balanceColorClass(
                        overview.ledger.assetsTotalCents,
                      )}`}
                    >
                      {formatBalanceCentsToBrl(
                        overview.ledger.assetsTotalCents,
                      )}
                    </td>
                  </tr>
                </tbody>

                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-border pt-6 pb-3 text-left text-sm font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {messages.overview.whatYouOwe}
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border pt-6 pb-3 text-right text-sm font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {messages.overview.valueInBrl}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ledger.liabilities.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="border-b border-border py-3 text-muted-foreground"
                      >
                        {messages.overview.emptyClassRow}
                      </td>
                    </tr>
                  ) : (
                    overview.ledger.liabilities.map((row) => (
                      <tr key={row.accountClass}>
                        <td className="border-b border-border py-3">
                          {accountClassLabel(row.accountClass)}
                        </td>
                        <td
                          className={`border-b border-border py-3 text-right font-mono tabular-nums ${balanceColorClass(
                            row.balanceCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.balanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="font-semibold">
                    <td className="border-b border-border py-3">
                      {messages.overview.whatYouOweTotal}
                    </td>
                    <td
                      className={`border-b border-border py-3 text-right font-mono tabular-nums ${balanceColorClass(
                        overview.ledger.liabilitiesTotalCents,
                      )}`}
                    >
                      {formatBalanceCentsToBrl(
                        overview.ledger.liabilitiesTotalCents,
                      )}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="border-t-2 border-foreground pt-4">
                      {title}
                    </td>
                    <td
                      className={`border-t-2 border-foreground pt-4 text-right font-mono tabular-nums ${balanceColorClass(
                        overview.ledger.netTotalCents,
                      )}`}
                    >
                      {formatBalanceCentsToBrl(
                        overview.ledger.netTotalCents,
                        true,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <section className="mt-8 border-t border-border pt-6">
              <h2 className="text-base font-semibold text-foreground">
                {messages.overview.byCurrencyTitle}
              </h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="border-b border-border py-2.5 text-left text-sm font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {messages.overview.currencyHeader}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-border py-2.5 text-right text-sm font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {messages.overview.originalBalanceHeader}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-border py-2.5 text-right text-sm font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {messages.overview.valueInBrl}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byCurrency.map((row) => (
                      <tr key={row.currency}>
                        <td className="border-b border-border py-2.5">
                          {row.currency}
                        </td>
                        <td
                          className={`border-b border-border py-2.5 text-right font-mono tabular-nums ${balanceColorClass(
                            row.originalCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.originalCents)}
                        </td>
                        <td
                          className={`border-b border-border py-2.5 text-right font-mono tabular-nums ${balanceColorClass(
                            row.brlCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.brlCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 border-t border-border pt-6">
              <h2 className="text-base font-semibold text-foreground">
                {messages.overview.byInstitutionTitle}
              </h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="border-b border-border py-2.5 text-left text-sm font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {messages.overview.institutionHeader}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-border py-2.5 text-right text-sm font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {messages.overview.valueInBrl}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byInstitution.map((row) => {
                      const label =
                        row.institution ?? messages.overview.noInstitution;
                      return (
                        <tr key={label}>
                          <td className="border-b border-border py-2.5">
                            {label}
                          </td>
                          <td
                            className={`border-b border-border py-2.5 text-right font-mono tabular-nums ${balanceColorClass(
                              row.brlCents,
                            )}`}
                          >
                            {formatBalanceCentsToBrl(row.brlCents)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </article>

          <aside className="flex w-full flex-col gap-6 min-[60rem]:w-80 min-[60rem]:shrink-0">
            <section className="border-b border-border pb-6">
              <h2 className="text-base font-semibold text-foreground">
                {messages.overview.monthSummaryTitle}
              </h2>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {messages.overview.moneyIn}
                  </dt>
                  <dd
                    className={`font-mono tabular-nums ${signedColorClass(
                      overview.monthSummary.inCents,
                    )}`}
                  >
                    {formatSignedCentsToBrl(
                      overview.monthSummary.inCents,
                      true,
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {messages.overview.moneyOut}
                  </dt>
                  <dd
                    className={`font-mono tabular-nums ${balanceColorClass(
                      overview.monthSummary.outCents,
                    )}`}
                  >
                    {formatBalanceCentsToBrl(
                      overview.monthSummary.outCents,
                      true,
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2 font-semibold">
                  <dt className="text-foreground">
                    {messages.overview.moneyLeft}
                  </dt>
                  <dd
                    className={`font-mono tabular-nums ${signedColorClass(
                      overview.monthSummary.leftCents,
                    )}`}
                  >
                    {formatSignedCentsToBrl(
                      overview.monthSummary.leftCents,
                      true,
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                {scopeTransferNote(overview.scope)}
              </p>
            </section>

            <section className="border-b border-border pb-6">
              <h2 className="text-base font-semibold text-foreground">
                {messages.overview.fxTitle}
              </h2>
              {overview.fxConversions.length === 0 &&
              overview.excludedAccounts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {messages.overview.fxEmpty}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3 text-sm">
                  {overview.fxConversions.map((conv) => {
                    const formattedDate = formatShortDatePtBr(conv.rateDate);
                    const isOlderDate =
                      conv.stale || conv.rateDate < overview.asOfDate;
                    return (
                      <div key={conv.accountId} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {messages.overview.fxRateLabel(
                              conv.accountName,
                              conv.currency,
                              formattedDate,
                            )}
                          </span>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {messages.overview.fxRateValue(
                            formatRatePtBr(conv.buyRate),
                            formatRatePtBr(conv.sellRate),
                          )}
                        </span>
                        {isOlderDate ? (
                          <p className="text-xs font-medium text-muted-foreground">
                            {conv.stale
                              ? messages.overview.fxStaleNote(formattedDate)
                              : messages.overview.fxEarlierDateNote(
                                  formattedDate,
                                )}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}

                  {overview.excludedAccounts.length > 0 ? (
                    <div className="mt-1 border-t border-border pt-2">
                      <p className="text-xs font-medium text-negative">
                        {messages.overview.fxExcludedTitle}:{" "}
                        {overview.excludedAccounts
                          .map(
                            (account) =>
                              `${account.accountName} (${account.currency})`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
