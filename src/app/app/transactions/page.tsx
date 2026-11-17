import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LedgerFilters } from "./ledger-filters";
import { QuickTransactionForm } from "./quick-transaction-form";
import { listAccountsWithEntities } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import { listLoanTerms } from "@/db/loans";
import { listTransactions } from "@/db/transactions";
import { todayInSaoPaulo } from "@/domain/date";
import {
  formatBalanceCentsToBrl,
  formatSignedCentsToBrl,
} from "@/domain/money";
import {
  isLoanOpeningEntry,
  monthSummaryCents,
  type MonthSummaryEntry,
  type OverviewScope,
} from "@/domain/overview";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type SearchParams = {
  month?: string;
  scope?: string;
  entity?: string;
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  q?: string;
  busca?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function parseScope(
  scopeParam: string | undefined,
  entityParam: string | undefined,
): OverviewScope {
  const raw = scopeParam ?? entityParam;
  if (raw === "pf" || raw === "pj") {
    return raw;
  }
  return "all";
}

function resolveMonth(
  monthParam: string | undefined,
  fromParam: string | undefined,
  today: string,
): string {
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return monthParam;
  }
  if (fromParam && /^\d{4}-(0[1-9]|1[0-2])/.test(fromParam)) {
    return fromParam.slice(0, 7);
  }
  return today.slice(0, 7);
}

function monthDateRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: lastDay };
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function capitalize(word: string): string {
  if (!word) {
    return "";
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatMonthHeading(month: string): {
  monthCap: string;
  heading: string;
} {
  const [year, m] = month.split("-").map(Number);
  const monthName = messages.overview.monthsFull[(m ?? 1) - 1] ?? "";
  const monthCap = capitalize(monthName);
  return {
    monthCap,
    heading: messages.transactions.monthHeading(monthCap, year),
  };
}

function formatDayMonth(isoDate: string): string {
  const [, month = "", day = ""] = isoDate.split("-");
  return `${day}/${month}`;
}

function buildMonthHref(
  targetMonth: string,
  current: {
    scope: OverviewScope;
    accountId: string;
    categoryId: string;
    q: string;
  },
): string {
  const params = new URLSearchParams();
  params.set("month", targetMonth);
  if (current.scope !== "all") {
    params.set("scope", current.scope);
  }
  if (current.accountId) {
    params.set("accountId", current.accountId);
  }
  if (current.categoryId) {
    params.set("categoryId", current.categoryId);
  }
  if (current.q) {
    params.set("q", current.q);
  }
  return `/app/transactions?${params.toString()}`;
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

export default async function TransactionsListPage({ searchParams }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const today = todayInSaoPaulo();
  const scope = parseScope(params.scope, params.entity);
  const month = resolveMonth(params.month, params.from, today);
  const range = monthDateRange(month);
  const from = params.from ?? range.from;
  const to = params.to ?? range.to;
  const accountId = params.accountId ?? "";
  const categoryId = params.categoryId ?? "";
  const q = (params.q ?? params.busca ?? "").trim();

  const [monthRows, accountsWithEntities, categories, loanTerms] =
    await Promise.all([
      listTransactions(session.user.id, { from, to }),
      listAccountsWithEntities(session.user.id, { includeArchived: true }),
      ensureDefaultCategories(session.user.id),
      listLoanTerms(session.user.id),
    ]);

  const accountById = new Map(
    accountsWithEntities.map((account) => [account.id, account]),
  );
  const accountName = new Map(
    accountsWithEntities.map((account) => [account.id, account.name]),
  );
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const termsByAccountId = new Map(
    loanTerms.map((term) => [term.accountId, term]),
  );

  const scopedAccounts = accountsWithEntities.filter((account) => {
    if (scope === "all") {
      return true;
    }
    const entityType = account.entity?.type === "pj" ? "pj" : "pf";
    return entityType === scope;
  });
  const scopedAccountIds = new Set(scopedAccounts.map((account) => account.id));
  const activeScopedAccounts = scopedAccounts.filter(
    (account) => !account.archived,
  );
  const typingAccounts =
    activeScopedAccounts.length > 0
      ? activeScopedAccounts
      : accountsWithEntities.filter((account) => !account.archived);
  const childCategories = categories.filter((category) => category.parentId);

  // Pair transfers across all month rows so we know origin/destination and entity types
  const rowsByTransferId = new Map<string, typeof monthRows>();
  for (const row of monthRows) {
    if (!row.transferId) {
      continue;
    }
    const list = rowsByTransferId.get(row.transferId) ?? [];
    list.push(row);
    rowsByTransferId.set(row.transferId, list);
  }

  // Compute month summary for the shown month and scope
  const summaryEntries: MonthSummaryEntry[] = [];
  for (const row of monthRows) {
    if (!scopedAccountIds.has(row.accountId)) {
      continue;
    }
    const account = accountById.get(row.accountId);
    if (!account) {
      continue;
    }
    if (
      isLoanOpeningEntry(
        {
          amountCents: row.amountCents,
          transferId: row.transferId,
          date: row.date,
          accountType: account.type,
        },
        termsByAccountId.get(row.accountId),
      )
    ) {
      continue;
    }
    const accountEntityType = account.entity?.type === "pj" ? "pj" : "pf";
    let otherAccountEntityType: "pf" | "pj" | null = null;
    if (row.transferId) {
      const mates = rowsByTransferId.get(row.transferId) ?? [];
      const other = mates.find((mate) => mate.id !== row.id);
      if (other) {
        const otherAcc = accountById.get(other.accountId);
        otherAccountEntityType =
          otherAcc?.entity?.type === "pj" ? "pj" : "pf";
      }
    }
    summaryEntries.push({
      amountCents: row.amountCents,
      transferId: row.transferId,
      accountEntityType,
      otherAccountEntityType,
    });
  }
  const monthSummary = monthSummaryCents(summaryEntries, scope);

  // Filter rows for display
  const queryLower = q.toLowerCase();
  const visibleRows = monthRows.filter((row) => {
    if (!scopedAccountIds.has(row.accountId)) {
      return false;
    }
    if (accountId && row.accountId !== accountId) {
      return false;
    }
    if (categoryId && row.categoryId !== categoryId) {
      return false;
    }
    if (queryLower && !row.description.toLowerCase().includes(queryLower)) {
      return false;
    }
    return true;
  });

  // Group visible transfer legs so when both legs are visible they collapse into one row
  const visibleByTransferId = new Map<string, typeof visibleRows>();
  for (const row of visibleRows) {
    if (!row.transferId) {
      continue;
    }
    const list = visibleByTransferId.get(row.transferId) ?? [];
    list.push(row);
    visibleByTransferId.set(row.transferId, list);
  }

  type DisplayRow = {
    id: string;
    date: string;
    description: string;
    isTransfer: boolean;
    categoryLabel: string | null;
    accountLabel: string;
    amountCents: number;
  };

  const seenTransfers = new Set<string>();
  const displayRows: DisplayRow[] = [];

  for (const row of visibleRows) {
    if (row.transferId) {
      const visibleLegs = visibleByTransferId.get(row.transferId) ?? [];
      const fromLeg = visibleLegs.find((leg) => leg.amountCents < 0);
      const toLeg = visibleLegs.find((leg) => leg.amountCents > 0);

      if (fromLeg && toLeg) {
        if (seenTransfers.has(row.transferId)) {
          continue;
        }
        seenTransfers.add(row.transferId);
        const fromName =
          accountName.get(fromLeg.accountId) ?? fromLeg.accountId;
        const toName = accountName.get(toLeg.accountId) ?? toLeg.accountId;
        displayRows.push({
          id: fromLeg.id,
          date: fromLeg.date,
          description: fromLeg.description,
          isTransfer: true,
          categoryLabel: messages.transactions.ownTransferCategory,
          accountLabel: messages.transactions.transferFromTo(fromName, toName),
          amountCents: Math.abs(fromLeg.amountCents),
        });
        continue;
      }

      displayRows.push({
        id: row.id,
        date: row.date,
        description: row.description,
        isTransfer: true,
        categoryLabel: messages.transactions.ownTransferCategory,
        accountLabel: accountName.get(row.accountId) ?? row.accountId,
        amountCents: Math.abs(row.amountCents),
      });
      continue;
    }

    displayRows.push({
      id: row.id,
      date: row.date,
      description: row.description,
      isTransfer: false,
      categoryLabel: row.categoryId
        ? (categoryName.get(row.categoryId) ?? null)
        : null,
      accountLabel: accountName.get(row.accountId) ?? row.accountId,
      amountCents: row.amountCents,
    });
  }

  const { monthCap, heading } = formatMonthHeading(month);
  const prevHref = buildMonthHref(shiftMonth(month, -1), {
    scope,
    accountId,
    categoryId,
    q,
  });
  const nextHref = buildMonthHref(shiftMonth(month, 1), {
    scope,
    accountId,
    categoryId,
    q,
  });
  const defaultTypingDate =
    today.slice(0, 7) === month ? today : `${month}-01`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            className="btn btn--card"
            aria-label={messages.transactions.previousMonthAria}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="fill-none stroke-current stroke-[1.5]"
            >
              <path d="M10 3 5 8l5 5" />
            </svg>
          </Link>
          <h1 className="text-[1.44rem] font-semibold tracking-tight text-foreground">
            {heading}
          </h1>
          <Link
            href={nextHref}
            className="btn btn--card"
            aria-label={messages.transactions.nextMonthAria}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="fill-none stroke-current stroke-[1.5]"
            >
              <path d="m6 3 5 5-5 5" />
            </svg>
          </Link>
        </div>

        <LedgerFilters
          month={month}
          scope={scope}
          q={q}
          accountId={accountId}
          categoryId={categoryId}
          accounts={scopedAccounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
          }))}
          categories={childCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
          }))}
        />
      </div>

      <section className="sheet p-5 min-[60rem]:px-8 min-[60rem]:pt-6 min-[60rem]:pb-8">
        <QuickTransactionForm
          accounts={typingAccounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
          }))}
          categories={childCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
          }))}
          defaultDate={defaultTypingDate}
          defaultAccountId={accountId || typingAccounts[0]?.id}
        />

        <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-xs">
          <Link className="lbl hover:text-foreground" href="/app/transactions/new/income">
            {messages.transactions.newIncome}
          </Link>
          <Link className="lbl hover:text-foreground" href="/app/transactions/new/expense">
            {messages.transactions.newExpense}
          </Link>
          <Link className="lbl hover:text-foreground" href="/app/transactions/new/transfer">
            {messages.transactions.newTransfer}
          </Link>
        </div>

        {displayRows.length === 0 ? (
          <div className="flex min-h-64 flex-col justify-center gap-3 py-10">
            <h2 className="text-lg font-semibold text-foreground">
              {messages.transactions.emptyMonthTitle(monthCap)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.transactions.emptyMonthBody}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link className="btn btn--ink" href="/app/imports">
                {messages.transactions.emptyImportAction}
              </Link>
              <a className="btn btn--card" href="#n-desc">
                {messages.transactions.emptyTypeAction}
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{messages.transactions.date}</th>
                  <th scope="col">{messages.transactions.description}</th>
                  <th scope="col">{messages.transactions.category}</th>
                  <th scope="col">{messages.transactions.account}</th>
                  <th scope="col" className="num">
                    {messages.transactions.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fig">{formatDayMonth(row.date)}</td>
                    <td>
                      <Link
                        href={`/app/transactions/${row.id}/edit`}
                        className="inline-block max-w-[200px] truncate align-bottom min-[60rem]:max-w-none"
                      >
                        {row.description}
                      </Link>
                    </td>
                    <td>
                      {row.isTransfer ? (
                        <span className="lbl">{row.categoryLabel}</span>
                      ) : row.categoryLabel ? (
                        row.categoryLabel
                      ) : (
                        <span className="tag">
                          {messages.transactions.uncategorized}
                        </span>
                      )}
                    </td>
                    <td>{row.accountLabel}</td>
                    <td
                      className={`num fig ${
                        row.isTransfer
                          ? "text-foreground"
                          : signedColorClass(row.amountCents)
                      }`}
                    >
                      {row.isTransfer
                        ? formatBalanceCentsToBrl(row.amountCents)
                        : formatSignedCentsToBrl(row.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-x-10 gap-y-4 pt-6 text-sm">
          <p>
            {messages.overview.moneyIn}{" "}
            <span
              className={`fig ml-2 font-semibold ${signedColorClass(
                monthSummary.inCents,
              )}`}
            >
              {formatSignedCentsToBrl(monthSummary.inCents)}
            </span>
          </p>
          <p>
            {messages.overview.moneyOut}{" "}
            <span
              className={`fig ml-2 font-semibold ${balanceColorClass(
                monthSummary.outCents,
              )}`}
            >
              {formatBalanceCentsToBrl(monthSummary.outCents)}
            </span>
          </p>
          <p>
            {messages.overview.moneyLeft}{" "}
            <span
              className={`fig ml-2 font-semibold ${signedColorClass(
                monthSummary.leftCents,
              )}`}
            >
              {formatSignedCentsToBrl(monthSummary.leftCents)}
            </span>
          </p>
        </div>
        <p className="lbl mt-2 text-right">
          {messages.transactions.footerTransferNote}
        </p>
      </section>
    </main>
  );
}
