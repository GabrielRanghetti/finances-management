import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { createValuationAction } from "../../../actions";
import { ValuationForm } from "../../../valuation-form";
import { getAccount } from "@/db/accounts";
import { isValuedAccountType } from "@/domain/valuations";
import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewValuationPage({ params }: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const account = await getAccount(session.user.id, id);
  if (!account || !isValuedAccountType(account.type)) {
    notFound();
  }

  const action = createValuationAction.bind(null, account.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section className="sheet flex flex-col gap-6 p-6 min-[60rem]:p-8">
        <h1 className="text-[1.44rem] font-semibold tracking-tight text-foreground">
          {messages.accounts.valuationCreate}
        </h1>
        <ValuationForm accountId={account.id} action={action} />
      </section>
    </main>
  );
}
