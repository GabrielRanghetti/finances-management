import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getNetWorthOverview,
  type OverviewHistoryPoint,
  type OverviewMonthSummary,
} from "@/db/overview";
import { todayInSaoPaulo } from "@/domain/date";
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
    return "pos";
  }
  if (cents < 0) {
    return "neg";
  }
  return "text-foreground";
}

function balanceColorClass(cents: number): string {
  return cents < 0 ? "neg" : "text-foreground";
}

function accountClassLabel(accountClass: string): string {
  const types = messages.accounts.types as Record<string, string>;
  return types[accountClass] ?? accountClass;
}

function computeChartGeometry(
  points: readonly OverviewHistoryPoint[],
  box: { xStart: number; xEnd: number; yTop: number; yBottom: number },
) {
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

  const { xStart, xEnd, yTop, yBottom } = box;
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

function MonthSummaryBlock({
  monthSummary,
  scope,
}: {
  monthSummary: OverviewMonthSummary;
  scope: OverviewScope;
}) {
  return (
    <>
      <h2 className="text-base font-semibold text-foreground">
        {messages.overview.monthSummaryTitle}
      </h2>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="row">
          <dt className="text-muted-foreground">{messages.overview.moneyIn}</dt>
          <dd className={`fig ${signedColorClass(monthSummary.inCents)}`}>
            {formatSignedCentsToBrl(monthSummary.inCents, true)}
          </dd>
        </div>
        <div className="row">
          <dt className="text-muted-foreground">
            {messages.overview.moneyOut}
          </dt>
          <dd className={`fig ${balanceColorClass(monthSummary.outCents)}`}>
            {formatBalanceCentsToBrl(monthSummary.outCents, true)}
          </dd>
        </div>
        <div className="row border-t border-border pt-2 font-semibold">
          <dt className="text-foreground">{messages.overview.moneyLeft}</dt>
          <dd className={`fig ${signedColorClass(monthSummary.leftCents)}`}>
            {formatSignedCentsToBrl(monthSummary.leftCents, true)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {scopeTransferNote(scope)}
      </p>
    </>
  );
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
  const today = todayInSaoPaulo();
  const overview = await getNetWorthOverview(session.user.id, scope, today);
  const title = scopeTitle(overview.scope);

  const desktopChart = computeChartGeometry(overview.history, {
    xStart: 104,
    xEnd: 632,
    yTop: 16,
    yBottom: 140,
  });
  const mobileChart = computeChartGeometry(overview.history, {
    xStart: 96,
    xEnd: 294,
    yTop: 16,
    yBottom: 124,
  });
  const firstPointCents = overview.history[0]?.netWorthCents ?? 0;
  const lastPointCents =
    overview.history[overview.history.length - 1]?.netWorthCents ??
    overview.netWorthCents;
  const chartAriaLabel = messages.overview.chartAria(
    title,
    formatBalanceCentsToBrl(firstPointCents, true),
    formatBalanceCentsToBrl(lastPointCents, true),
  );
  const mobileLabelIndices = new Set([
    0,
    2,
    4,
    6,
    8,
    Math.max(mobileChart.coords.length - 1, 0),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      {!overview.hasAccounts ? (
        <article className="sheet p-6 min-[60rem]:p-10">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="lbl mt-2 max-w-xl">{messages.overview.emptyBody}</p>
          <div className="mt-6">
            <Link href="/app/accounts/new" className="btn btn--ink">
              {messages.overview.emptyAction}
            </Link>
          </div>
        </article>
      ) : (
        <div className="flex flex-col gap-6 min-[60rem]:flex-row min-[60rem]:items-start min-[60rem]:gap-10">
          <article className="sheet min-w-0 flex-1 p-5 min-[60rem]:px-12 min-[60rem]:pt-10 min-[60rem]:pb-8">
            <div>
              <p className="lbl">
                {messages.overview.headingWithDate(
                  title,
                  formatFullDatePtBr(overview.asOfDate),
                )}
              </p>
              <h1
                className={`fig mt-1 text-[2.5rem] leading-[1.15] font-semibold tracking-tight break-words whitespace-normal min-[60rem]:text-[3.5rem] min-[60rem]:leading-[1.1] ${balanceColorClass(
                  overview.netWorthCents,
                )}`}
              >
                {formatBalanceCentsToBrl(overview.netWorthCents, true)}
              </h1>
              <p className="mt-1 text-sm text-foreground min-[60rem]:mt-2 min-[60rem]:text-base">
                <span
                  className={`fig ${signedColorClass(
                    overview.changeMonthCents,
                  )}`}
                >
                  {formatSignedCentsToBrl(overview.changeMonthCents, true)}
                </span>{" "}
                {messages.overview.inMonth(
                  formatMonthFullName(overview.asOfDate),
                )}{" "}
                <span
                  className={`fig ${signedColorClass(
                    overview.change12MonthsCents,
                  )}`}
                >
                  {formatSignedCentsToBrl(overview.change12MonthsCents, true)}
                </span>{" "}
                {messages.overview.in12Months}
              </p>
            </div>

            {/* Desktop chart (640x170 viewBox) */}
            <svg
              viewBox="0 0 640 170"
              role="img"
              aria-label={chartAriaLabel}
              className="mt-8 hidden h-auto w-full min-[60rem]:block"
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
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(desktopChart.hi, true)}
              </text>
              <text
                x="0"
                y="73"
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(desktopChart.mid, true)}
              </text>
              <text
                x="0"
                y="135"
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(desktopChart.lo, true)}
              </text>
              <polyline
                points={desktopChart.polylinePoints}
                className="fill-none stroke-foreground stroke-2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={desktopChart.lastCoord.x}
                cy={desktopChart.lastCoord.y}
                r="4"
                className="fill-foreground"
              />
              {desktopChart.coords.map((pt, idx) => {
                const anchor =
                  idx === 0
                    ? "start"
                    : idx === desktopChart.coords.length - 1
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

            {/* Phone chart (300x150 viewBox so 11px text stays >= 11px at 390px) */}
            <svg
              viewBox="0 0 300 150"
              role="img"
              aria-label={chartAriaLabel}
              className="mt-4 block h-auto w-full min-[60rem]:hidden"
            >
              <line
                x1="0"
                y1="16"
                x2="300"
                y2="16"
                className="stroke-border stroke-1"
              />
              <line
                x1="0"
                y1="70"
                x2="300"
                y2="70"
                className="stroke-border stroke-1"
              />
              <line
                x1="0"
                y1="124"
                x2="300"
                y2="124"
                className="stroke-border stroke-1"
              />
              <text
                x="0"
                y="11"
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(mobileChart.hi, true)}
              </text>
              <text
                x="0"
                y="65"
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(mobileChart.mid, true)}
              </text>
              <text
                x="0"
                y="119"
                className="fill-muted-foreground font-sans text-[11px] tabular-nums"
              >
                {formatBalanceCentsToBrl(mobileChart.lo, true)}
              </text>
              <polyline
                points={mobileChart.polylinePoints}
                className="fill-none stroke-foreground stroke-2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={mobileChart.lastCoord.x}
                cy={mobileChart.lastCoord.y}
                r="4"
                className="fill-foreground"
              />
              {mobileChart.coords.map((pt, idx) => {
                if (!mobileLabelIndices.has(idx)) {
                  return null;
                }
                const anchor =
                  idx === 0
                    ? "start"
                    : idx === mobileChart.coords.length - 1
                      ? "end"
                      : "middle";
                return (
                  <text
                    key={pt.date || idx}
                    x={pt.x}
                    y="144"
                    textAnchor={anchor}
                    className="fill-muted-foreground font-sans text-[11px]"
                  >
                    {formatMonthShortName(pt.date)}
                  </text>
                );
              })}
            </svg>

            <p className="lbl mt-1 text-xs min-[60rem]:text-sm">
              {desktopChart.lo !== 0
                ? messages.overview.chartCaptionNonZero(
                    formatBalanceCentsToBrl(desktopChart.lo, true),
                  )
                : messages.overview.chartCaptionZero}
            </p>

            {/* Phone order: Net worth -> Month summary -> Tables */}
            <section className="mt-6 border-t border-border pt-5 min-[60rem]:hidden">
              <MonthSummaryBlock
                monthSummary={overview.monthSummary}
                scope={overview.scope}
              />
            </section>

            <div className="mt-6 overflow-x-auto min-[60rem]:mt-8">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">{messages.overview.whatYouHave}</th>
                    <th scope="col" className="num">
                      {messages.overview.valueInBrl}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ledger.assets.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-muted-foreground">
                        {messages.overview.emptyClassRow}
                      </td>
                    </tr>
                  ) : (
                    overview.ledger.assets.map((row) => (
                      <tr key={row.accountClass}>
                        <td>{accountClassLabel(row.accountClass)}</td>
                        <td
                          className={`num fig ${balanceColorClass(
                            row.balanceCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.balanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="sum">
                    <td>{messages.overview.whatYouHaveTotal}</td>
                    <td
                      className={`num fig ${balanceColorClass(
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
                    <th scope="col" className="pt-6">
                      {messages.overview.whatYouOwe}
                    </th>
                    <th scope="col" className="num pt-6">
                      {messages.overview.valueInBrl}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ledger.liabilities.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-muted-foreground">
                        {messages.overview.emptyClassRow}
                      </td>
                    </tr>
                  ) : (
                    overview.ledger.liabilities.map((row) => (
                      <tr key={row.accountClass}>
                        <td>{accountClassLabel(row.accountClass)}</td>
                        <td
                          className={`num fig ${balanceColorClass(
                            row.balanceCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.balanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="sum">
                    <td>{messages.overview.whatYouOweTotal}</td>
                    <td
                      className={`num fig ${balanceColorClass(
                        overview.ledger.liabilitiesTotalCents,
                      )}`}
                    >
                      {formatBalanceCentsToBrl(
                        overview.ledger.liabilitiesTotalCents,
                      )}
                    </td>
                  </tr>
                  <tr className="net">
                    <td>{title}</td>
                    <td
                      className={`num fig ${balanceColorClass(
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
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">{messages.overview.currencyHeader}</th>
                      <th scope="col" className="num">
                        {messages.overview.originalBalanceHeader}
                      </th>
                      <th scope="col" className="num">
                        {messages.overview.valueInBrl}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byCurrency.map((row) => (
                      <tr key={row.currency}>
                        <td>{row.currency}</td>
                        <td
                          className={`num fig ${balanceColorClass(
                            row.originalCents,
                          )}`}
                        >
                          {formatBalanceCentsToBrl(row.originalCents)}
                        </td>
                        <td
                          className={`num fig ${balanceColorClass(
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
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">{messages.overview.institutionHeader}</th>
                      <th scope="col" className="num">
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
                          <td>{label}</td>
                          <td
                            className={`num fig ${balanceColorClass(
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
            <section className="hidden border-b border-border pb-6 min-[60rem]:block">
              <MonthSummaryBlock
                monthSummary={overview.monthSummary}
                scope={overview.scope}
              />
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
                        <span className="fig text-xs text-muted-foreground">
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
                      <p className="neg text-xs font-medium">
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
