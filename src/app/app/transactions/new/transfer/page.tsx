import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createTransferAction } from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { listAccounts } from "@/db/accounts";
import { ensureDefaultCategories } from "@/db/categories";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function NewTransferPage() {
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
  // PJ→PF tags: pró-labore and distribuição de lucros (income children)
  const transferCategories = categories.filter(
    (category) =>
      category.parentId &&
      (category.name === "Pró-labore" ||
        category.name === "Distribuição de lucros" ||
        category.kind === "income"),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.transactions.newTransfer}</h1>
      <TransactionForm
        mode="transfer"
        action={createTransferAction}
        accounts={accounts}
        categories={transferCategories}
      />
    </main>
  );
}
