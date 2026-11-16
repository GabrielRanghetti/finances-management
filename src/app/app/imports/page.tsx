import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{messages.imports.title}</h1>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link className="underline" href="/app/imports/ofx">
            {messages.imports.ofxLink}
          </Link>
        </li>
        <li>
          <Link className="underline" href="/app/imports/csv">
            {messages.imports.csvLink}
          </Link>
        </li>
        <li>
          <Link className="underline" href="/app/imports/pdf">
            {messages.imports.pdfLink}
          </Link>
        </li>
      </ul>
    </main>
  );
}
