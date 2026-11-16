"use client";

import { messages } from "@/messages/pt-BR";

type ErrorProps = {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
};

export default function OverviewError({ retry, reset }: ErrorProps) {
  const handleRetry = retry ?? reset;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <article
        role="alert"
        className="rounded-lg border border-border bg-card p-6 shadow-xs min-[60rem]:p-10"
      >
        <h1 className="text-lg font-semibold text-negative">
          {messages.overview.errorTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {messages.overview.errorUnchanged}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => handleRetry?.()}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-[transform,opacity] duration-150 hover:opacity-90 active:translate-y-px min-[60rem]:min-h-10"
          >
            {messages.overview.errorRetry}
          </button>
        </div>
      </article>
    </main>
  );
}
