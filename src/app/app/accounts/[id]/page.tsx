import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { archiveAccountAction, recordLoanPaymentAction } from "../actions";
import { LoanPaymentForm } from "../loan-payment-form";
import { getAccountWithEntity, listAccounts } from "@/db/accounts";
import {
  countPaidInstallments,
  getLoanTerms,
  scheduleForTerms,
} from "@/db/loans";
import {
  listAccountAmounts,
  listTransactions,
} from "@/db/transactions";
import { listValuations } from "@/db/valuations";
import type { AccountType } from "@/db/schema";
import { todayInSaoPaulo } from "@/domain/date";
import {
  statementPeriodContaining,
  statementTotalCents,
} from "@/domain/installments";
import { accountBalanceCents, formatCentsToBrl } from "@/domain/money";
import { accountBalanceOnDate } from "@/domain/networth";
import { isValuedAccountType } from "@/domain/valuations";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    statementDate?: string;
    imported?: string;
    ledger?: string;
  }>;
};

export default async function AccountDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const query = (await searchParams) ?? {};
  const importedCount = query.imported ? Number(query.imported) : null;
  const ledgerBalanceCents =
    query.ledger !== undefined && query.ledger !== ""
      ? Number(query.ledger)
      : null;
  const account = await getAccountWithEntity(session.user.id, id);

  if (!account) {
    notFound();
  }

  const amounts = (await listAccountAmounts(session.user.id, account.id)) ?? [];
  const today = todayInSaoPaulo();
  const valuationRows = isValuedAccountType(account.type)
    ? await listValuations(session.user.id, account.id)
    : [];
  const balanceCents = accountBalanceOnDate(
    {
      type: account.type,
      transactionBalanceCents: accountBalanceCents(amounts),
      acquisitionCostCents: account.acquisitionCostCents,
      valuations: valuationRows,
    },
    today,
  );
  const archive = archiveAccountAction.bind(null, account.id);
  const typeLabel =
    messages.accounts.types[account.type as AccountType] ?? account.type;
  const statementDate = query.statementDate || today;
  const statement =
    account.type === "credit_card" && account.closingDay
      ? statementPeriodContaining(account.closingDay, statementDate)
      : null;
  const statementRows = statement
    ? await listTransactions(session.user.id, {
        accountId: account.id,
        from: statement.from,
        to: statement.to,
      })
    : [];
  const statementTotal = statement
    ? statementTotalCents(statementRows.map((row) => row.amountCents))
    : 0;

  const loanTerms =
    account.type === "loan"
      ? await getLoanTerms(session.user.id, account.id)
      : null;
  const schedule = loanTerms ? scheduleForTerms(loanTerms) : [];
  const paidCount = loanTerms
    ? await countPaidInstallments(session.user.id, account.id)
    : 0;
  const nextInstallment = paidCount + 1;
  const paymentAccounts = loanTerms
    ? (await listAccounts(session.user.id)).filter(
        (row) =>
          row.id !== account.id &&
          (row.type === "bank" || row.type === "cash"),
      )
    : [];
  const recordPayment = recordLoanPaymentAction.bind(null, account.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <article className="sheet p-6 min-[60rem]:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {account.name}
            </h1>
            <p className="lbl mt-3">
              {isValuedAccountType(account.type)
                ? messages.accounts.currentValue
                : messages.accounts.balance}
            </p>
            <p
              className={`fig mt-1 text-4xl font-semibold tracking-tight break-words whitespace-normal min-[60rem]:text-5xl ${
                balanceCents < 0 ? "neg" : "text-foreground"
              }`}
            >
              {formatAccountCurrencyBalance(balanceCents, account.currency)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="btn btn--card"
              href={`/app/accounts/${account.id}/edit`}
            >
              {messages.accounts.edit}
            </Link>
            {!account.archived ? (
              <form action={archive}>
                <button className="btn btn--card" type="submit">
                  {messages.accounts.archive}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {importedCount !== null && Number.isFinite(importedCount) ? (
          <p className="lbl mt-4">{messages.imports.saved(importedCount)}</p>
        ) : null}

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2 min-[60rem]:grid-cols-3">
          <div>
            <dt className="lbl">{messages.accounts.type}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{typeLabel}</dd>
          </div>
          <div>
            <dt className="lbl">{messages.accounts.currency}</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {account.currency}
            </dd>
          </div>
          <div>
            <dt className="lbl">{messages.accounts.institution}</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {account.institution || messages.emptyValue}
            </dd>
          </div>
          <div>
            <dt className="lbl">{messages.accounts.entity}</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {account.entity
                ? messages.entities.linkLabel(
                    account.entity.name,
                    account.entity.type === "pj"
                      ? messages.entities.typePj
                      : messages.entities.typePf,
                  )
                : messages.emptyValue}
            </dd>
          </div>
          {account.type === "credit_card" ? (
            <div>
              <dt className="lbl">{messages.accounts.closingDay}</dt>
              <dd className="fig mt-0.5 font-medium text-foreground">
                {account.closingDay ?? messages.emptyValue}
              </dd>
            </div>
          ) : null}
          {isValuedAccountType(account.type) ? (
            <>
              <div>
                <dt className="lbl">{messages.accounts.acquisitionCost}</dt>
                <dd className="fig mt-0.5 font-medium text-foreground">
                  {account.acquisitionCostCents != null
                    ? formatAccountCurrencyBalance(
                        account.acquisitionCostCents,
                        account.currency,
                      )
                    : messages.emptyValue}
                </dd>
              </div>
              <div>
                <dt className="lbl">{messages.accounts.acquisitionDate}</dt>
                <dd className="fig mt-0.5 font-medium text-foreground">
                  {account.acquisitionDate
                    ? formatDateDdMmYyyy(account.acquisitionDate)
                    : messages.emptyValue}
                </dd>
              </div>
            </>
          ) : null}
          {ledgerBalanceCents !== null &&
          Number.isFinite(ledgerBalanceCents) ? (
            <div>
              <dt className="lbl">{messages.imports.ledgerBalance}</dt>
              <dd
                className={`fig mt-0.5 font-medium ${
                  ledgerBalanceCents < 0 ? "neg" : "text-foreground"
                }`}
              >
                {formatAccountCurrencyBalance(
                  ledgerBalanceCents,
                  account.currency,
                )}
              </dd>
            </div>
          ) : null}
          {account.archived ? (
            <div>
              <dt className="lbl">{messages.accounts.archived}</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {messages.accounts.archivedYes}
              </dd>
            </div>
          ) : null}
        </dl>

        {statement ? (
          <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="text-base font-semibold text-foreground">
              {messages.accounts.statement}
            </h2>
            <form className="flex flex-wrap items-end gap-3 text-sm">
              <label className="field">
                <span className="lbl">{messages.accounts.statementDate}</span>
                <input
                  className="inp w-auto"
                  type="date"
                  name="statementDate"
                  defaultValue={statementDate}
                />
              </label>
              <button className="btn btn--card" type="submit">
                {messages.transactions.filter}
              </button>
            </form>
            <div className="flex flex-wrap items-baseline justify-between gap-4 text-sm">
              <p className="lbl">
                {messages.accounts.statementPeriod(
                  formatDateDdMmYyyy(statement.from),
                  formatDateDdMmYyyy(statement.to),
                )}
              </p>
              <p>
                <span className="lbl">
                  {messages.accounts.statementTotal}:{" "}
                </span>
                <span
                  className={`fig font-semibold ${
                    statementTotal < 0 ? "neg" : "text-foreground"
                  }`}
                >
                  {formatAccountCurrencyBalance(
                    statementTotal,
                    account.currency,
                  )}
                </span>
              </p>
            </div>
            {statementRows.length === 0 ? (
              <p className="lbl">{messages.accounts.statementEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">{messages.transactions.date}</th>
                      <th scope="col">{messages.transactions.description}</th>
                      <th scope="col" className="num">
                        {messages.transactions.amount}
                      </th>
                      <th scope="col" className="num !pl-4">
                        {messages.transactions.edit}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.map((row) => (
                      <tr key={row.id}>
                        <td className="fig">{formatDateDdMmYyyy(row.date)}</td>
                        <td>{row.description}</td>
                        <td
                          className={`num fig ${
                            row.amountCents > 0
                              ? "pos"
                              : row.amountCents < 0
                                ? "neg"
                                : "text-foreground"
                          }`}
                        >
                          {formatSignedAmount(row.amountCents)}
                        </td>
                        <td className="num !pl-4">
                          <Link href={`/app/transactions/${row.id}/edit`}>
                            {messages.transactions.edit}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {isValuedAccountType(account.type) ? (
          <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">
                {messages.accounts.valuations}
              </h2>
              <Link
                className="btn btn--ink"
                href={`/app/accounts/${account.id}/valuations/new`}
              >
                {messages.accounts.valuationCreate}
              </Link>
            </div>
            {valuationRows.length === 0 ? (
              <p className="lbl">{messages.accounts.valuationEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">{messages.accounts.valuationDate}</th>
                      <th scope="col" className="num">
                        {messages.accounts.valuationValue}
                      </th>
                      <th scope="col" className="num !pl-4">
                        {messages.transactions.edit}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuationRows.map((row) => (
                      <tr key={row.id}>
                        <td className="fig">{formatDateDdMmYyyy(row.date)}</td>
                        <td className="num fig">
                          {formatCentsToBrl(row.valueCents)}
                        </td>
                        <td className="num !pl-4">
                          <Link
                            href={`/app/accounts/${account.id}/valuations/${row.id}/edit`}
                          >
                            {messages.transactions.edit}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {loanTerms ? (
          <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="text-base font-semibold text-foreground">
              {messages.accounts.loanSchedule}
            </h2>
            <dl className="flex flex-wrap gap-6 text-sm">
              <div>
                <dt className="lbl inline">
                  {messages.accounts.loanPrincipal}:{" "}
                </dt>
                <dd className="fig inline font-medium text-foreground">
                  {formatAccountCurrencyBalance(
                    loanTerms.principalCents,
                    account.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt className="lbl inline">{messages.accounts.loanSystem}: </dt>
                <dd className="inline font-medium text-foreground">
                  {loanTerms.system === "sac"
                    ? messages.accounts.loanSystemSac
                    : messages.accounts.loanSystemPrice}
                </dd>
              </div>
            </dl>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">{messages.accounts.loanInstallment}</th>
                    <th scope="col">{messages.transactions.date}</th>
                    <th scope="col" className="num">
                      {messages.accounts.loanPayment}
                    </th>
                    <th scope="col" className="num">
                      {messages.accounts.loanInterest}
                    </th>
                    <th scope="col" className="num">
                      {messages.accounts.loanAmortization}
                    </th>
                    <th scope="col" className="num">
                      {messages.accounts.loanOutstanding}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((line) => (
                    <tr key={line.installment}>
                      <td className="fig">{line.installment}</td>
                      <td className="fig">{formatDateDdMmYyyy(line.date)}</td>
                      <td className="num fig">
                        {formatCentsToBrl(line.paymentCents)}
                      </td>
                      <td className="num fig">
                        {formatCentsToBrl(line.interestCents)}
                      </td>
                      <td className="num fig">
                        {formatCentsToBrl(line.amortizationCents)}
                      </td>
                      <td className="num fig">
                        {formatCentsToBrl(line.outstandingCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextInstallment > loanTerms.termMonths ? (
              <p className="lbl">{messages.accounts.loanPaid}</p>
            ) : paymentAccounts.length > 0 ? (
              <LoanPaymentForm
                action={recordPayment}
                installment={nextInstallment}
                termMonths={loanTerms.termMonths}
                paymentAccounts={paymentAccounts}
              />
            ) : (
              <p className="neg text-sm">
                {messages.accounts.errorLoanPayment}
              </p>
            )}
          </section>
        ) : null}
      </article>
    </main>
  );
}

function formatDateDdMmYyyy(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return day && month && year ? `${day}/${month}/${year}` : isoDate;
}

function formatAccountCurrencyBalance(cents: number, currency: string): string {
  const abs = formatCentsToBrl(Math.abs(cents));
  const symbol = currency === "BRL" ? "R$" : currency;
  return cents < 0 ? `− ${symbol} ${abs}` : `${symbol} ${abs}`;
}

function formatSignedAmount(cents: number): string {
  const abs = formatCentsToBrl(Math.abs(cents));
  if (cents > 0) {
    return `+${abs}`;
  }
  if (cents < 0) {
    return `−${abs}`;
  }
  return abs;
}
