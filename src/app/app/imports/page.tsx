import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { messages } from "@/messages/pt-BR";

export const dynamic = "force-dynamic";

const importSources = [
  {
    href: "/app/imports/ofx",
    title: messages.imports.ofxLink,
    description: messages.screens.importsOfxDescription,
  },
  {
    href: "/app/imports/csv",
    title: messages.imports.csvLink,
    description: messages.screens.importsCsvDescription,
  },
  {
    href: "/app/imports/pdf",
    title: messages.imports.pdfLink,
    description: messages.screens.importsPdfDescription,
  },
] as const;

export default async function ImportsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {messages.imports.title}
        </h1>
        <p className="lbl mt-1">{messages.screens.importsSubtitle}</p>
      </div>

      <section className="sheet divide-y divide-border p-5 min-[60rem]:p-8">
        {importSources.map((source) => (
          <div
            key={source.href}
            className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Link
                className="text-base font-semibold text-foreground"
                href={source.href}
              >
                {source.title}
              </Link>
              <p className="lbl mt-1">{source.description}</p>
            </div>
            <Link className="btn btn--card" href={source.href}>
              {messages.screens.importsOpenFlow}
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
