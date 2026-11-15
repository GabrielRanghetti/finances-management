import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  deleteTransactionAction,
  updateExpenseAction,
  updateIncomeAction,
  updateTransferAction,
} from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { listAccounts } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import {
  getTransaction,
  getTransferPair,
} from "@/db/transactions";
import { formatCentsToBrl } from "@/domain/money";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditTransactionPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const transaction = await getTransaction(session.user.id, id);
  if (!transaction) {
    notFound();
  }

  const [accounts, categories] = await Promise.all([
    listAccounts(session.user.id, { includeArchived: true }),
    ensureDefaultCategories(session.user.id),
  ]);

  const deleteAction = deleteTransactionAction.bind(null, transaction.id);

  if (transaction.transferId) {
    const pair = await getTransferPair(session.user.id, transaction.id);
    if (!pair) {
      notFound();
    }
    const transferCategories = categories.filter(
      (category) => category.parentId && category.kind === "income",
    );
    const action = updateTransferAction.bind(null, pair.transferId);

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">
          {messages.transactions.editTransfer}
        </h1>
        <TransactionForm
          mode="transfer"
          action={action}
          accounts={accounts}
          categories={transferCategories}
          defaults={{
            date: pair.from.date,
            amount: formatCentsToBrl(Math.abs(pair.from.amountCents)),
            description: pair.from.description,
            notes: pair.from.notes,
            categoryId: pair.from.categoryId,
            fromAccountId: pair.from.accountId,
            toAccountId: pair.to.accountId,
          }}
        />
        <form action={deleteAction}>
          <button className="rounded border px-3 py-2 text-sm" type="submit">
            {messages.transactions.delete}
          </button>
        </form>
      </main>
    );
  }

  const mode = transaction.amountCents >= 0 ? "income" : "expense";
  const action =
    mode === "income"
      ? updateIncomeAction.bind(null, transaction.id)
      : updateExpenseAction.bind(null, transaction.id);
  const title =
    mode === "income"
      ? messages.transactions.editIncome
      : messages.transactions.editExpense;
  const kindCategories = categories.filter(
    (category) =>
      category.parentId &&
      category.kind === (mode === "income" ? "income" : "expense"),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <TransactionForm
        mode={mode}
        action={action}
        accounts={accounts}
        categories={kindCategories}
        defaults={{
          date: transaction.date,
          amount: formatCentsToBrl(Math.abs(transaction.amountCents)),
          description: transaction.description,
          notes: transaction.notes,
          categoryId: transaction.categoryId,
          accountId: transaction.accountId,
        }}
      />
      <form action={deleteAction}>
        <button className="rounded border px-3 py-2 text-sm" type="submit">
          {messages.transactions.delete}
        </button>
      </form>
    </main>
  );
}
