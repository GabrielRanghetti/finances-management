"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/messages/pt-BR";

const mainNavItems = [
  { href: "/app", label: messages.nav.dashboard },
  { href: "/app/accounts", label: messages.nav.accounts },
  { href: "/app/transactions", label: messages.nav.transactions },
  { href: "/app/imports", label: messages.nav.imports },
  { href: "/app/connections", label: messages.nav.connections },
] as const;

const moreNavItems = [
  { href: "/app/entities", label: messages.nav.entities },
  { href: "/app/investments", label: messages.nav.investments },
  { href: "/app/budget", label: messages.nav.budget },
  { href: "/app/taxes", label: messages.nav.taxes },
  { href: "/app/calendar", label: messages.nav.calendar },
  { href: "/app/documents", label: messages.nav.documents },
  { href: "/app/security", label: messages.nav.security },
] as const;

function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMoreActive = moreNavItems.some((item) =>
    isCurrentPath(pathname, item.href),
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-card px-4 py-3 min-[60rem]:flex-nowrap min-[60rem]:px-10">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight text-foreground no-underline min-[60rem]:min-h-9"
        >
          {messages.appName}
        </Link>

        <nav
          aria-label={messages.nav.mainAria}
          className="order-3 flex w-full min-w-0 items-center gap-1 min-[60rem]:order-2 min-[60rem]:w-auto min-[60rem]:flex-1"
        >
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {mainNavItems.map((item) => {
              const active = isCurrentPath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium no-underline transition-opacity duration-150 min-[60rem]:min-h-9 ${
                    active
                      ? "bg-accent text-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <details className="relative shrink-0">
            <summary
              className={` inline-flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 text-sm font-medium select-none min-[60rem]:min-h-9 [&::-webkit-details-marker]:hidden ${
                isMoreActive
                  ? "bg-accent text-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              {messages.nav.more}
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 flex min-w-44 flex-col gap-0.5 rounded-lg border border-border bg-card p-1.5 shadow-sm min-[60rem]:left-0 min-[60rem]:right-auto">
              {moreNavItems.map((item) => {
                const active = isCurrentPath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap no-underline min-[60rem]:min-h-9 ${
                      active
                        ? "bg-accent text-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </nav>

        <Link
          href="/app/transactions/new/expense"
          className="order-2 inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground no-underline transition-[transform,opacity] duration-150 hover:opacity-90 active:translate-y-px min-[60rem]:order-3 min-[60rem]:min-h-10"
        >
          {messages.transactions.newExpense}
        </Link>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
