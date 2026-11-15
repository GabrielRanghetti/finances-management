import { headers } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { ensureDefaultPfEntity } from "@/db/entities";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    await ensureDefaultPfEntity(session.user.id);
  }

  return <AppShell>{children}</AppShell>;
}
