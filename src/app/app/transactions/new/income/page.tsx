import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createIncomeAction } from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { listAccounts } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewIncomePage() {
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
  const incomeCategories = categories.filter(
    (category) => category.kind === "income" && category.parentId,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet flex flex-col gap-6 p-6 min-[60rem]:p-8">
        <h1 className="text-[1.44rem] font-semibold tracking-tight text-foreground">
          {messages.transactions.newIncome}
        </h1>
        <TransactionForm
          mode="income"
          action={createIncomeAction}
          accounts={accounts}
          categories={incomeCategories}
        />
      </section>
    </main>
  );
}
