"use client";

import { messages } from "@/messages/pt-BR";

type ErrorProps = {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
};

export default function TransactionsError({ retry, reset }: ErrorProps) {
  const handleRetry = retry ?? reset;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <section
        role="alert"
        className="sheet flex min-h-80 flex-col justify-center gap-4 p-6 min-[60rem]:px-8 min-[60rem]:py-10"
      >
        <h1 className="neg text-xl font-semibold">
          {messages.transactions.errorTitle}
        </h1>
        <p className="text-sm text-foreground">
          {messages.transactions.errorBody}
        </p>
        <div>
          <button
            type="button"
            onClick={() => handleRetry?.()}
            className="btn btn--ink"
          >
            {messages.transactions.errorRetry}
          </button>
        </div>
      </section>
    </main>
  );
}
