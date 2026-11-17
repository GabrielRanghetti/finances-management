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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet flex flex-col gap-6 p-6 min-[60rem]:p-8">
        <h1 className="text-[1.44rem] font-semibold tracking-tight text-foreground">
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
        <form action={remove} className="border-t border-border pt-4">
          <button className="btn btn--card" type="submit">
            {messages.accounts.valuationDelete}
          </button>
        </form>
      </section>
    </main>
  );
}
