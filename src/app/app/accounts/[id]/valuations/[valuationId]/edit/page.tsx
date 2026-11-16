import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  deleteValuationAction,
  updateValuationAction,
} from "../../../../actions";
import { ValuationForm } from "../../../../valuation-form";
import { getAccount } from "@/db/accounts";
import { getValuation } from "@/db/valuations";
import { formatCentsToBrl } from "@/domain/money";
import { isValuedAccountType } from "@/domain/valuations";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; valuationId: string }>;
};

export default async function EditValuationPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const { id, valuationId } = await params;
  const account = await getAccount(session.user.id, id);
  if (!account || !isValuedAccountType(account.type)) {
    notFound();
  }

  const valuation = await getValuation(session.user.id, valuationId);
  if (!valuation || valuation.accountId !== account.id) {
    notFound();
  }

  const action = updateValuationAction.bind(null, account.id, valuation.id);
  const remove = deleteValuationAction.bind(null, account.id, valuation.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">
        {messages.accounts.valuationEdit}
      </h1>
      <ValuationForm
        accountId={account.id}
        action={action}
        defaults={{
          date: valuation.date,
          value: formatCentsToBrl(valuation.valueCents),
        }}
      />
      <form action={remove}>
        <button className="rounded border px-3 py-2 text-sm" type="submit">
          {messages.accounts.valuationDelete}
        </button>
      </form>
    </main>
  );
}
