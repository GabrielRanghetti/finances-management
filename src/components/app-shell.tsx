"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { OverviewScope } from "@/domain/overview";
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

const scopeItems: { value: OverviewScope; label: string }[] = [
  { value: "pf", label: messages.overview.scopePf },
  { value: "pj", label: messages.overview.scopePj },
  { value: "all", label: messages.overview.scopeAll },
];

const scopedPaths = new Set(["/app", "/app/accounts", "/app/transactions"]);

function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ScopeGrooveButtons({
  activeScope,
  onSelect,
}: {
  activeScope: OverviewScope;
  onSelect?: (scope: OverviewScope) => void;
}) {
  return (
    <div
      className="groove"
      role="group"
      aria-label={messages.overview.scopeAria}
    >
      {scopeItems.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={activeScope === item.value}
          onClick={() => onSelect?.(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ScopeGroove({ pathname }: { pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawScope = searchParams?.get("scope");
  const activeScope: OverviewScope =
    rawScope === "pf" || rawScope === "pj" ? rawScope : "all";

  function handleSelect(nextScope: OverviewScope) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("scope", nextScope);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <ScopeGrooveButtons activeScope={activeScope} onSelect={handleSelect} />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMoreActive = moreNavItems.some((item) =>
    isCurrentPath(pathname, item.href),
  );
  const showScopeGroove = pathname ? scopedPaths.has(pathname) : false;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bar">
        <Link
          href="/app"
          className="inline-flex min-h-10 items-center text-[1.2rem] font-semibold tracking-tight text-foreground no-underline"
        >
          {messages.appName}
        </Link>

        <nav aria-label={messages.nav.mainAria} className="nav">
          {mainNavItems.map((item) => {
            const active = isCurrentPath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          <details className="relative">
            <summary data-active={isMoreActive ? "true" : undefined}>
              {messages.nav.more}
            </summary>
            <div className="sheet absolute right-0 top-full z-20 mt-1 flex min-w-44 flex-col gap-0.5 p-1.5 min-[60rem]:left-0 min-[60rem]:right-auto">
              {moreNavItems.map((item) => {
                const active = isCurrentPath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </nav>

        {showScopeGroove && pathname ? (
          <Suspense fallback={<ScopeGrooveButtons activeScope="all" />}>
            <ScopeGroove pathname={pathname} />
          </Suspense>
        ) : null}

        <Link href="/app/transactions" className="btn btn--ink">
          {messages.nav.newTransaction}
        </Link>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
