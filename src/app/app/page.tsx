import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Área logada</h1>
      <p>Olá, {session.user.name}.</p>
      <a className="text-sm underline" href="/app/security">
        Segurança (2FA e passkeys)
      </a>
    </main>
  );
}
