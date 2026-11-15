import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createExpenseAction } from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { listAccounts } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const [accounts, categories] = await Promise.all([
    listAccounts(session.user.id),
    ensureDefaultCategories(session.user.id),
  ]);
  const expenseCategories = categories.filter(
    (category) => category.kind === "expense" && category.parentId,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.transactions.newExpense}</h1>
      <TransactionForm
        mode="expense"
        action={createExpenseAction}
        accounts={accounts}
        categories={expenseCategories}
      />
    </main>
  );
}
