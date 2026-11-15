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
import type { AccountType } from "@/db/schema";
import {
  statementPeriodContaining,
  statementTotalCents,
} from "@/domain/installments";
import { accountBalanceCents, formatCentsToBrl } from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ statementDate?: string }>;
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
  const account = await getAccountWithEntity(session.user.id, id);

  if (!account) {
    notFound();
  }

  const amounts = (await listAccountAmounts(session.user.id, account.id)) ?? [];
  const balanceCents = accountBalanceCents(amounts);
  const archive = archiveAccountAction.bind(null, account.id);
  const typeLabel =
    messages.accounts.types[account.type as AccountType] ?? account.type;

  const today = new Date().toISOString().slice(0, 10);
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <Link className="underline" href={`/app/accounts/${account.id}/edit`}>
          {messages.accounts.edit}
        </Link>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">{messages.accounts.balance}</dt>
          <dd>{messages.money(formatCentsToBrl(balanceCents))}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.type}</dt>
          <dd>{typeLabel}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.currency}</dt>
          <dd>{account.currency}</dd>
        </div>
        <div>
          <dt className="font-medium">{messages.accounts.institution}</dt>
          <dd>{account.institution || messages.emptyValue}</dd>
        </div>
        {account.type === "credit_card" ? (
          <div>
            <dt className="font-medium">{messages.accounts.closingDay}</dt>
            <dd>{account.closingDay ?? messages.emptyValue}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium">{messages.accounts.entity}</dt>
          <dd>
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
        {account.archived ? (
          <div>
            <dt className="font-medium">{messages.accounts.archived}</dt>
            <dd>{messages.accounts.archivedYes}</dd>
          </div>
        ) : null}
      </dl>
      {!account.archived ? (
        <form action={archive}>
          <button className="rounded border px-3 py-2 text-sm" type="submit">
            {messages.accounts.archive}
          </button>
        </form>
      ) : null}

      {statement ? (
        <section className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-xl font-semibold">{messages.accounts.statement}</h2>
          <form className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {messages.accounts.statementDate}
              <input
                className="rounded border px-3 py-2"
                type="date"
                name="statementDate"
                defaultValue={statementDate}
              />
            </label>
            <button className="rounded bg-black px-3 py-2 text-white" type="submit">
              {messages.transactions.filter}
            </button>
          </form>
          <p className="text-sm">
            {messages.accounts.statementPeriod(statement.from, statement.to)}
          </p>
          <p className="text-sm">
            {messages.accounts.statementTotal}:{" "}
            {messages.money(formatCentsToBrl(statementTotal))}
          </p>
          {statementRows.length === 0 ? (
            <p className="text-sm">{messages.accounts.statementEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {statementRows.map((row) => (
                <li key={row.id} className="flex flex-wrap gap-x-3 border-b py-2">
                  <span>{row.date}</span>
                  <span>{messages.money(formatCentsToBrl(row.amountCents))}</span>
                  <span>{row.description}</span>
                  <Link
                    className="underline"
                    href={`/app/transactions/${row.id}/edit`}
                  >
                    {messages.transactions.edit}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {loanTerms ? (
        <section className="flex flex-col gap-3 border-t pt-4">
          <h2 className="text-xl font-semibold">
            {messages.accounts.loanSchedule}
          </h2>
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="inline font-medium">
                {messages.accounts.loanPrincipal}:{" "}
              </dt>
              <dd className="inline">
                {messages.money(formatCentsToBrl(loanTerms.principalCents))}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">
                {messages.accounts.loanSystem}:{" "}
              </dt>
              <dd className="inline">
                {loanTerms.system === "sac"
                  ? messages.accounts.loanSystemSac
                  : messages.accounts.loanSystemPrice}
              </dd>
            </div>
          </dl>
          <div className="overflow-x-auto text-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">{messages.accounts.loanInstallment}</th>
                  <th className="py-1 pr-2">{messages.transactions.date}</th>
                  <th className="py-1 pr-2">{messages.accounts.loanPayment}</th>
                  <th className="py-1 pr-2">{messages.accounts.loanInterest}</th>
                  <th className="py-1 pr-2">
                    {messages.accounts.loanAmortization}
                  </th>
                  <th className="py-1">{messages.accounts.loanOutstanding}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((line) => (
                  <tr key={line.installment} className="border-b">
                    <td className="py-1 pr-2">{line.installment}</td>
                    <td className="py-1 pr-2">{line.date}</td>
                    <td className="py-1 pr-2">
                      {messages.money(formatCentsToBrl(line.paymentCents))}
                    </td>
                    <td className="py-1 pr-2">
                      {messages.money(formatCentsToBrl(line.interestCents))}
                    </td>
                    <td className="py-1 pr-2">
                      {messages.money(
                        formatCentsToBrl(line.amortizationCents),
                      )}
                    </td>
                    <td className="py-1">
                      {messages.money(
                        formatCentsToBrl(line.outstandingCents),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextInstallment > loanTerms.termMonths ? (
            <p className="text-sm">{messages.accounts.loanPaid}</p>
          ) : paymentAccounts.length > 0 ? (
            <LoanPaymentForm
              action={recordPayment}
              installment={nextInstallment}
              termMonths={loanTerms.termMonths}
              paymentAccounts={paymentAccounts}
            />
          ) : (
            <p className="text-sm">{messages.accounts.errorLoanPayment}</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
