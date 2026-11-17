"use client";

import { messages } from "@/messages/pt-BR";

type ErrorProps = {
  error?: Error & { digest?: string };
  reset?: () => void;
};

export default function ConnectionsError({ reset }: ErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 min-[60rem]:px-10 min-[60rem]:py-10">
      <article role="alert" className="sheet p-6 min-[60rem]:p-10">
        <h1 className="neg text-lg font-semibold">
          {messages.screens.connectionsErrorTitle}
        </h1>
        <p className="lbl mt-2">{messages.overview.errorUnchanged}</p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => reset?.()}
            className="btn btn--ink"
          >
            {messages.overview.errorRetry}
          </button>
        </div>
      </article>
    </main>
  );
}
