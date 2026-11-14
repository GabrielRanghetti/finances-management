import Link from "next/link";

import { messages } from "@/messages/pt-BR";

const navItems = [
  { href: "/app", label: messages.nav.dashboard },
  { href: "/app/accounts", label: messages.nav.accounts },
  { href: "/app/investments", label: messages.nav.investments },
  { href: "/app/budget", label: messages.nav.budget },
  { href: "/app/taxes", label: messages.nav.taxes },
  { href: "/app/calendar", label: messages.nav.calendar },
  { href: "/app/documents", label: messages.nav.documents },
  { href: "/app/security", label: messages.nav.security },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <header className="border-b border-zinc-200 px-4 py-3 md:hidden">
        <p className="font-semibold">{messages.appName}</p>
        <nav className="mt-2 flex gap-3 overflow-x-auto text-sm">
          {navItems.map((item) => (
            <Link key={item.href} className="whitespace-nowrap underline" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 p-4 md:block">
        <p className="mb-4 text-lg font-semibold">{messages.appName}</p>
        <nav className="flex flex-col gap-2 text-sm">
          {navItems.map((item) => (
            <Link key={item.href} className="underline" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
